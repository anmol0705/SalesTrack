export type ProductUnit = 'piece' | 'box' | 'kg' | 'litre' | 'dozen';

export interface Product {
  id: string;
  org_id: string;
  name: string;
  sku: string;
  unit: ProductUnit;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
