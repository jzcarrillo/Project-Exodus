import { ScanCommand, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLES, identity, writeGuard, log, response, failure } from '@/lib/server';
import { services, validateApplication } from '@/lib/services';

export async function GET(req: Request) {
  try {
    const u = await identity();
    const params = new URL(req.url).searchParams;
    const applicationId = params.get('application');

    if (applicationId) {
      const a = await ddb.send(new GetCommand({ TableName: TABLES.applications, Key: { id: applicationId } }));
      if (!a.Item || (a.Item.owner !== u.userId && u.role !== 'reviewer')) return response({ error: 'Application not found.' }, 404);
      const [docs, acts] = await Promise.all([
        ddb.send(new ScanCommand({ TableName: TABLES.documents, FilterExpression: 'application = :a', ExpressionAttributeValues: { ':a': applicationId } })),
        ddb.send(new ScanCommand({ TableName: TABLES.activity, FilterExpression: 'application = :a', ExpressionAttributeValues: { ':a': applicationId } })),
      ]);
      return response({ documents: docs.Items || [], activity: (acts.Items || []).sort((a, b) => b.created.localeCompare(a.created)) });
    }

    const reviewer = params.get('review') === '1';
    if (reviewer && u.role !== 'reviewer') return response({ error: 'A BI reviewer role is required.' }, 403);

    const [appsResult, profileResult, docsResult, actResult] = await Promise.all([
      reviewer
        ? ddb.send(new ScanCommand({ TableName: TABLES.applications, FilterExpression: '#s <> :draft', ExpressionAttributeNames: { '#s': 'status' }, ExpressionAttributeValues: { ':draft': 'Draft' }, Limit: 200 }))
        : ddb.send(new ScanCommand({ TableName: TABLES.applications, FilterExpression: 'owner = :o', ExpressionAttributeValues: { ':o': u.userId }, Limit: 200 })),
      ddb.send(new GetCommand({ TableName: TABLES.profiles, Key: { owner: u.userId } })),
      ddb.send(new ScanCommand({ TableName: TABLES.documents, FilterExpression: 'owner = :o', ExpressionAttributeValues: { ':o': u.userId }, Limit: 200 })),
      ddb.send(new ScanCommand({ TableName: TABLES.activity, FilterExpression: 'owner = :o', ExpressionAttributeValues: { ':o': u.userId }, Limit: 100 })),
    ]);

    const apps = (appsResult.Items || []).map(r => ({ ...r, data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data }));
    return response({
      user: { name: u.displayName, email: u.email, role: u.role },
      profile: profileResult.Item ? (typeof profileResult.Item.data === 'string' ? JSON.parse(profileResult.Item.data) : profileResult.Item.data) : {},
      applications: apps.sort((a, b) => b.updated.localeCompare(a.updated)),
      documents: (docsResult.Items || []).sort((a, b) => b.created.localeCompare(a.created)),
      activity: (actResult.Items || []).sort((a, b) => b.created.localeCompare(a.created)),
    });
  } catch (e) { return failure(e); }
}

export async function POST(req: Request) {
  try {
    writeGuard(req);
    const u = await identity();
    if (Number(req.headers.get('content-length') || 0) > 100000) return response({ error: 'Request too large' }, 413);
    const body = await req.json() as any;
    const now = new Date().toISOString();

    if (body.action === 'profile') {
      const allowed = ['firstName', 'lastName', 'birthDate', 'nationality', 'phone', 'street', 'barangay', 'city', 'province', 'postalCode', 'provinceCode', 'cityCode', 'barangayCode'];
      const data = Object.fromEntries(allowed.map(k => [k, String(body.data?.[k] || '').slice(0, 500)]));
      await ddb.send(new PutCommand({ TableName: TABLES.profiles, Item: { owner: u.userId, data: JSON.stringify(data), updated: now } }));
      await log(u.userId, '', 'Profile updated');
      return response({ ok: true });
    }

    if (body.action === 'read') {
      // Mark all activity as seen for this user — scan then batch update
      const acts = await ddb.send(new ScanCommand({ TableName: TABLES.activity, FilterExpression: 'owner = :o AND seen = :z', ExpressionAttributeValues: { ':o': u.userId, ':z': 0 } }));
      await Promise.all((acts.Items || []).map(a => ddb.send(new UpdateCommand({ TableName: TABLES.activity, Key: { id: a.id }, UpdateExpression: 'SET seen = :one', ExpressionAttributeValues: { ':one': 1 } }))));
      return response({ ok: true });
    }

    if (body.action === 'save') {
      const service = services.find(s => s.id === body.service);
      if (!service) return response({ error: 'Choose a valid service.' }, 400);
      const keys = new Set([...service.sections.flatMap(s => s.fields.map(f => f.key)), 'provinceCode', 'cityCode', 'barangayCode']);
      const data = Object.fromEntries(Object.entries(body.data || {}).filter(([k, v]) => keys.has(k) && typeof v === 'string').map(([k, v]) => [k, (v as string).slice(0, 5000)]));
      const id = body.id || 'BI-' + crypto.randomUUID();

      if (body.id) {
        const old = await ddb.send(new GetCommand({ TableName: TABLES.applications, Key: { id } }));
        if (!old.Item || old.Item.owner !== u.userId || !['Draft', 'For correction'].includes(old.Item.status)) return response({ error: 'This application cannot be edited.' }, 409);
        if (old.Item.version !== body.version) return response({ error: 'This draft changed in another window. Reload before editing.' }, 409);
        await ddb.send(new UpdateCommand({ TableName: TABLES.applications, Key: { id }, UpdateExpression: 'SET #d = :d, updated = :u, version = :v', ExpressionAttributeNames: { '#d': 'data' }, ExpressionAttributeValues: { ':d': JSON.stringify(data), ':u': now, ':v': body.version + 1 } }));
      } else {
        await ddb.send(new PutCommand({ TableName: TABLES.applications, Item: { id, owner: u.userId, service: service.id, status: 'Draft', data: JSON.stringify(data), created: now, updated: now, version: 1 } }));
        await log(u.userId, id, 'Draft created', service.name);
      }
      return response({ id, version: (body.id ? Number(body.version) : 0) + 1 });
    }

    if (body.action === 'submit') {
      const a = await ddb.send(new GetCommand({ TableName: TABLES.applications, Key: { id: body.id } }));
      if (!a.Item || a.Item.owner !== u.userId || !['Draft', 'For correction'].includes(a.Item.status)) return response({ error: 'Application is no longer editable.' }, 409);
      const missing = validateApplication(a.Item.service, typeof a.Item.data === 'string' ? JSON.parse(a.Item.data) : a.Item.data);
      if (missing.length) return response({ error: 'Complete these fields: ' + missing.join(', ') }, 400);
      const s = services.find(s => s.id === a.Item!.service)!;
      const uploaded = await ddb.send(new ScanCommand({ TableName: TABLES.documents, FilterExpression: 'application = :a', ExpressionAttributeValues: { ':a': body.id } }));
      const uploadedKinds = (uploaded.Items || []).map(d => d.kind);
      const required = s.documents.filter(kind => !uploadedKinds.includes(kind));
      if (required.length) return response({ error: 'Upload: ' + required.join(', ') }, 400);
      await ddb.send(new UpdateCommand({ TableName: TABLES.applications, Key: { id: body.id }, UpdateExpression: 'SET #s = :s, updated = :u, version = version + :one', ExpressionAttributeNames: { '#s': 'status' }, ExpressionAttributeValues: { ':s': 'Submitted', ':u': now, ':one': 1 } }));
      await log(u.userId, body.id, 'Application submitted', 'Saved in the preview workspace. Not transmitted to BI.');
      return response({ ok: true });
    }

    if (body.action === 'review') {
      if (u.role !== 'reviewer') return response({ error: 'A BI reviewer role is required.' }, 403);
      if (!['Under review', 'For correction', 'Approved', 'Disapproved', 'Endorsed'].includes(body.status)) return response({ error: 'Invalid processing action.' }, 400);
      if (!String(body.note || '').trim()) return response({ error: 'Add a processing note.' }, 400);
      const a = await ddb.send(new GetCommand({ TableName: TABLES.applications, Key: { id: body.id } }));
      if (!a.Item || a.Item.status === 'Draft') return response({ error: 'Application not found.' }, 404);
      if (['Approved', 'Disapproved'].includes(a.Item.status)) return response({ error: 'This application has a final decision.' }, 409);
      await ddb.send(new UpdateCommand({ TableName: TABLES.applications, Key: { id: body.id }, UpdateExpression: 'SET #s = :s, updated = :u, version = version + :one', ExpressionAttributeNames: { '#s': 'status' }, ExpressionAttributeValues: { ':s': body.status, ':u': now, ':one': 1 } }));
      await log(a.Item.owner, body.id, body.status, String(body.note).slice(0, 5000) + ' · Reviewer: ' + u.email);
      return response({ ok: true });
    }

    return response({ error: 'Unknown action.' }, 400);
  } catch (e) { return failure(e); }
}
