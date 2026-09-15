export interface UserIdentity {
  userId: string;
  email: string;
  displayName: string;
  role: 'applicant' | 'reviewer';
}

export interface ApplicationRecord {
  id: string;
  owner: string;
  service: string;
  status: string;
  data: Record<string, string>;
  created: string;
  updated: string;
  version: number;
}

export interface DocumentRecord {
  id: string;
  owner: string;
  application: string;
  name: string;
  kind: string;
  mime: string;
  size: number;
  created: string;
}

export interface ActivityRecord {
  id: string;
  owner: string;
  application: string;
  action: string;
  note: string;
  created: string;
  seen: number;
}
