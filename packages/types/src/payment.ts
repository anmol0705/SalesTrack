export type PaymentMethod = 'cash' | 'cheque' | 'upi';
export type PaymentStatus = 'pending' | 'confirmed' | 'failed';

export interface Payment {
  id: string;
  org_id: string;
  visit_id: string;
  agent_id: string;
  retailer_id: string;
  amount: number;
  method: PaymentMethod;
  reference_number: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  status: PaymentStatus;
  whatsapp_sent: boolean;
  created_at: string;
  updated_at: string;
}
