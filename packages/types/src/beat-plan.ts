export type BeatPlanStatus = 'draft' | 'active' | 'completed';

export interface BeatPlan {
  id: string;
  org_id: string;
  name: string;
  assigned_agent_id: string;
  plan_date: string;
  status: BeatPlanStatus;
  created_at: string;
  updated_at: string;
}

export interface BeatPlanRetailer {
  id: string;
  org_id: string;
  beat_plan_id: string;
  retailer_id: string;
  sequence_order: number;
  is_visited: boolean;
  created_at: string;
  updated_at: string;
}
