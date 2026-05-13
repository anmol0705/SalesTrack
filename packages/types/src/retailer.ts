export interface Retailer {
  id: string;
  org_id: string;
  name: string;
  owner_name: string;
  phone: string;
  address: string;
  area: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  outstanding_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
