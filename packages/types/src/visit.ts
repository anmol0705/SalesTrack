export type VisitOutcome = 'visited' | 'not_available' | 'refused' | 'pending';

export interface Visit {
  id: string;
  org_id: string;
  beat_plan_retailer_id: string;
  agent_id: string;
  retailer_id: string;
  check_in_lat: number;
  check_in_lng: number;
  check_in_time: string;
  check_out_time: string | null;
  outcome: VisitOutcome;
  notes: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}
