export type OrgPlan = 'starter' | 'growth' | 'business';

export interface Organisation {
  id: string;
  name: string;
  owner_email: string;
  plan: OrgPlan;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
