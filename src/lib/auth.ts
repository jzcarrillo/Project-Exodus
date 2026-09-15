import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export type AppUser = {
  userId: string;
  displayName: string;
  email: string;
};

// AWS ALB / Cognito inject these headers after authentication.
// Replace header names to match your ALB listener rule or Cognito config.
const USER_ID_HEADER = 'x-user-id';
const USER_EMAIL_HEADER = 'x-user-email';
const USER_NAME_HEADER = 'x-user-name';

export async function getIdentity(): Promise<AppUser | null> {
  const h = await headers();
  const userId = h.get(USER_ID_HEADER);
  const email = h.get(USER_EMAIL_HEADER);
  if (!userId || !email) return null;
  return { userId, email, displayName: h.get(USER_NAME_HEADER) ?? email };
}

export async function requireIdentity(returnTo: string): Promise<AppUser> {
  const user = await getIdentity();
  if (user) return user;
  redirect(`/signin?return_to=${encodeURIComponent(returnTo)}`);
}
