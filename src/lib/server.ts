import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { GetCommand, PutCommand, UpdateCommand, ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLES } from '@/lib/db';
import { getIdentity } from '@/lib/auth';

export { ddb, TABLES };

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const BUCKET = process.env.S3_BUCKET || 'bi-documents';

export const s3Get = (key: string) => s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
export const s3Put = (key: string, body: ReadableStream | Buffer, contentType: string) =>
  s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body as any, ContentType: contentType }));
export const s3Delete = (key: string) => s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));

export async function identity() {
  const u = await getIdentity();
  if (!u) throw new Error('Sign in to save and manage your applications.');
  const reviewers = (process.env.BI_REVIEWER_EMAILS || '').split(',').map(x => x.trim().toLowerCase());
  return { ...u, role: reviewers.includes(u.email.toLowerCase()) ? 'reviewer' : 'applicant' };
}

export function writeGuard(req: Request) {
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) throw new Error('Request origin is not allowed.');
}

export async function log(owner: string, application: string, action: string, note = '') {
  await ddb.send(new PutCommand({
    TableName: TABLES.activity,
    Item: { id: crypto.randomUUID(), owner, application, action, note, created: new Date().toISOString(), seen: 0 },
  }));
}

export const response = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export const failure = (e: unknown) => {
  const message = e instanceof Error ? e.message : 'Please try again.';
  console.error(message);
  return response({ error: message }, message.startsWith('Sign in') ? 401 : 400);
};

export { GetCommand, PutCommand, UpdateCommand, ScanCommand, BatchWriteCommand };
