export type Role = 'owner' | 'manager' | 'agent';

export interface User {
  id: string;
  org_id: string;
  full_name: string;
  phone: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
