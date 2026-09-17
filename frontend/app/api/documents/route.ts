import { GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLES, s3Get, s3Put, s3Delete, identity, writeGuard, log, response, failure } from '@/lib/server';
import { services } from '@/lib/services';

export async function GET(req: Request) {
  try {
    const u = await identity();
    const id = new URL(req.url).searchParams.get('id');
    const d = await ddb.send(new GetCommand({ TableName: TABLES.documents, Key: { id } }));
    if (!d.Item || (d.Item.owner !== u.userId && u.role !== 'reviewer')) return response({ error: 'Document not found.' }, 404);
    const object = await s3Get(String(d.Item.id));
    const body = object.Body as ReadableStream;
    return new Response(body, {
      headers: {
        'Content-Type': String(d.Item.mime),
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(String(d.Item.name))}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) { return failure(e); }
}

export async function POST(req: Request) {
  try {
    writeGuard(req);
    const u = await identity();
    const query = new URL(req.url).searchParams;
    const app = query.get('application');
    const kind = query.get('kind') || '';
    const name = (query.get('name') || 'document').slice(0, 200);

    const a = await ddb.send(new GetCommand({ TableName: TABLES.applications, Key: { id: app } }));
    if (!a.Item || a.Item.owner !== u.userId || !['Draft', 'For correction'].includes(a.Item.status))
      return response({ error: 'Save an editable draft before uploading.' }, 400);

    const s = services.find(s => s.id === a.Item!.service);
    if (!s?.documents.includes(kind)) return response({ error: 'Invalid document category.' }, 400);

    const ext = name.split('.').pop()?.toLowerCase();
    const types: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    if (!ext || !types[ext] || (kind.includes('.xlsx') && ext !== 'xlsx') || (kind === 'Facial image' && !['jpg', 'jpeg', 'png'].includes(ext)))
      return response({ error: 'Use a supported PDF, JPG, PNG, or XLSX file for this requirement.' }, 400);

    const max = ext === 'xlsx' ? 105906176 : 10485760;
    const size = Number(req.headers.get('content-length'));
    if (!Number.isSafeInteger(size) || size <= 0 || size > max)
      return response({ error: ext === 'xlsx' ? 'Manifest limit is 101 MB.' : 'Document limit is 10 MB.' }, 413);

    if (!req.body) return response({ error: 'Empty upload.' }, 400);

    const id = crypto.randomUUID();
    await s3Put(id, req.body as any, types[ext]);

    try {
      await ddb.send(new PutCommand({ TableName: TABLES.documents, Item: { id, owner: u.userId, application: app, name, kind, mime: types[ext], size, created: new Date().toISOString() } }));
      await log(u.userId, app!, 'Document uploaded', kind);
    } catch (e) {
      await s3Delete(id);
      throw e;
    }

    return response({ id });
  } catch (e) { return failure(e); }
}
