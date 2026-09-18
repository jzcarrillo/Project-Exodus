import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

export type AppUser = {
  userId: string;
  displayName: string;
  email: string;
};

const USER_ID_HEADER = 'x-user-id';
const USER_EMAIL_HEADER = 'x-user-email';
const USER_NAME_HEADER = 'x-user-name';

export async function getIdentity(): Promise<AppUser | null> {
  // Check ALB/Cognito headers first (production)
  const h = await headers();
  const userId = h.get(USER_ID_HEADER);
  const email = h.get(USER_EMAIL_HEADER);
  if (userId && email) return { userId, email, displayName: h.get(USER_NAME_HEADER) ?? email };

  // Fallback to POC cookie
  const cookieStore = await cookies();
  const poc = cookieStore.get('poc_user');
  if (poc) {
    try { return JSON.parse(poc.value) as AppUser; } catch { return null; }
  }
  return null;
}

export async function requireIdentity(returnTo: string): Promise<AppUser> {
  const user = await getIdentity();
  if (user) return user;
  redirect(`/signin?return_to=${encodeURIComponent(returnTo)}`);
}
