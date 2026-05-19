import { Router, Request, Response } from 'express';
import { z } from 'zod';
import type { Order, OrderItem } from '@salestrack/types';
import { supabaseAdmin } from '../config/supabase';

const router = Router();

const OrderItemSchema = z.object({
  item_description: z.string().min(1, 'Item description is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().min(1, 'Unit is required'),
  unit_price: z.number().positive('Unit price must be positive'),
});

const OrderSchema = z.object({
  visit_id: z.string().uuid('Invalid visit_id'),
  retailer_id: z.string().uuid('Invalid retailer_id'),
  items: z.array(OrderItemSchema).min(1, 'At least one item is required'),
  notes: z.string().optional(),
});

const OrderStatusSchema = z.object({
  status: z.enum(['confirmed', 'cancelled']),
});

// GET /api/orders
router.get('/', async (req: Request, res: Response) => {
  const { agent_id, retailer_id, status } = req.query;

  let query = supabaseAdmin
    .from('orders')
    .select('*, retailer:retailers(id, name), agent:users(id, full_name)')
    .eq('org_id', req.orgId)
    .order('created_at', { ascending: false });

  if (typeof agent_id === 'string' && agent_id.length > 0) query = query.eq('agent_id', agent_id);
  if (typeof retailer_id === 'string' && retailer_id.length > 0) query = query.eq('retailer_id', retailer_id);
  if (typeof status === 'string' && status.length > 0) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  res.json({ success: true, data: data as Order[] });
});

// GET /api/orders/:id — with all order_items
router.get('/:id', async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(
      '*, retailer:retailers(id, name, phone), agent:users(id, full_name), order_items(*)',
    )
    .eq('id', req.params['id'])
    .eq('org_id', req.orgId)
    .single();

  if (error || !data) {
    res.status(404).json({ success: false, error: 'Order not found' });
    return;
  }
  res.json({ success: true, data });
});

// POST /api/orders — create order with line items
router.post('/', async (req: Request, res: Response) => {
  const parsed = OrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(', '),
    });
    return;
  }
  const { visit_id, retailer_id, items, notes } = parsed.data;

  const itemsWithTotals = items.map((item) => ({
    ...item,
    total_price: Math.round(item.quantity * item.unit_price * 100) / 100,
  }));
  const total_amount =
    Math.round(itemsWithTotals.reduce((sum, item) => sum + item.total_price, 0) * 100) / 100;

  // Step 1: Insert the order
  const orderInsert: Record<string, unknown> = {
    org_id: req.orgId,
    visit_id,
    retailer_id,
    agent_id: req.user.id,
    total_amount,
    status: 'draft',
  };
  if (notes !== undefined) orderInsert['notes'] = notes;

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert(orderInsert)
    .select()
    .single();
  if (orderError || !order) throw orderError ?? new Error('Failed to create order');

  const orderId = (order as Order).id;

  // Step 2: Bulk insert order_items
  const orderItemRows = itemsWithTotals.map((item) => ({
    org_id: req.orgId,
    order_id: orderId,
    item_description: item.item_description,
    unit: item.unit,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price,
  }));

  const { data: orderItems, error: itemsError } = await supabaseAdmin
    .from('order_items')
    .insert(orderItemRows)
    .select();
  if (itemsError) {
    // Compensation: remove the orphaned order
    await supabaseAdmin.from('orders').delete().eq('id', orderId);
    throw itemsError;
  }

  res.status(201).json({
    success: true,
    data: { ...(order as Order), order_items: orderItems as OrderItem[] },
  });
});

// PUT /api/orders/:id/status
router.put('/:id/status', async (req: Request, res: Response) => {
  const parsed = OrderStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(', '),
    });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('orders')
    .update({ status: parsed.data.status })
    .eq('id', req.params['id'])
    .eq('org_id', req.orgId)
    .select()
    .single();
  if (error || !data) {
    res.status(404).json({ success: false, error: 'Order not found' });
    return;
  }
  res.json({ success: true, data: data as Order });
});

export default router;
