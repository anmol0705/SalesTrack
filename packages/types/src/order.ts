export type OrderStatus = 'draft' | 'confirmed' | 'cancelled';

export interface Order {
  id: string;
  org_id: string;
  visit_id: string;
  agent_id: string;
  retailer_id: string;
  total_amount: number;
  status: OrderStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  org_id: string;
  order_id: string;
  item_description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  updated_at: string;
}
