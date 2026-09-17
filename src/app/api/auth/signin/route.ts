import { cookies } from 'next/headers';
import { response } from '@/lib/server';

export async function POST(req: Request) {
  const { email, name } = await req.json();
  if (!email || !name) return response({ error: 'Email and name are required.' }, 400);

  const cookieStore = await cookies();
  cookieStore.set('poc_user', JSON.stringify({ userId: email, email, displayName: name }), {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24, // 1 day
  });

  return response({ ok: true });
}
