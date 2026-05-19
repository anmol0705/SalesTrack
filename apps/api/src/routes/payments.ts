import { Router, Request, Response } from 'express';
import { z } from 'zod';
import type { Payment } from '@salestrack/types';
import { generateWhatsAppReceiptLink } from '@salestrack/utils';
import { supabaseAdmin } from '../config/supabase';

const router = Router();

const PaymentSchema = z
  .object({
    visit_id: z.string().uuid('Invalid visit_id'),
    retailer_id: z.string().uuid('Invalid retailer_id'),
    amount: z.number().positive('Amount must be positive'),
    method: z.enum(['cash', 'cheque', 'upi']),
    reference_number: z.string().optional(),
  })
  .refine(
    (d) => {
      if ((d.method === 'cheque' || d.method === 'upi') && !d.reference_number) return false;
      return true;
    },
    { message: 'Reference number is required for cheque and UPI payments' },
  );

// GET /api/payments
router.get('/', async (req: Request, res: Response) => {
  const { agent_id, retailer_id, status, date } = req.query;

  let query = supabaseAdmin
    .from('payments')
    .select('*, retailer:retailers(id, name), agent:users(id, full_name)')
    .eq('org_id', req.orgId)
    .order('created_at', { ascending: false });

  if (typeof agent_id === 'string' && agent_id.length > 0) query = query.eq('agent_id', agent_id);
  if (typeof retailer_id === 'string' && retailer_id.length > 0) query = query.eq('retailer_id', retailer_id);
  if (typeof status === 'string' && status.length > 0) query = query.eq('status', status);
  if (typeof date === 'string' && date.length > 0) {
    query = query
      .gte('created_at', `${date}T00:00:00.000Z`)
      .lte('created_at', `${date}T23:59:59.999Z`);
  }

  const { data, error } = await query;
  if (error) throw error;
  res.json({ success: true, data: data as Payment[] });
});

// GET /api/payments/:id
router.get('/:id', async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('*, retailer:retailers(id, name, phone), agent:users(id, full_name)')
    .eq('id', req.params['id'])
    .eq('org_id', req.orgId)
    .single();

  if (error || !data) {
    res.status(404).json({ success: false, error: 'Payment not found' });
    return;
  }
  res.json({ success: true, data: data as Payment });
});

// POST /api/payments — log a payment
router.post('/', async (req: Request, res: Response) => {
  const parsed = PaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(', '),
    });
    return;
  }
  const { visit_id, retailer_id, amount, method, reference_number } = parsed.data;

  // Fetch retailer + org in parallel for WhatsApp receipt
  const [retailerResult, orgResult] = await Promise.all([
    supabaseAdmin
      .from('retailers')
      .select('phone, name, outstanding_balance')
      .eq('id', retailer_id)
      .eq('org_id', req.orgId)
      .single(),
    supabaseAdmin.from('organisations').select('name').eq('id', req.orgId).single(),
  ]);

  if (retailerResult.error || !retailerResult.data) {
    res.status(404).json({ success: false, error: 'Retailer not found' });
    return;
  }

  const paymentInsert: Record<string, unknown> = {
    org_id: req.orgId,
    visit_id,
    retailer_id,
    agent_id: req.user.id,
    amount,
    method,
    status: method === 'cash' ? 'confirmed' : 'pending',
  };
  if (reference_number !== undefined) paymentInsert['reference_number'] = reference_number;

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from('payments')
    .insert(paymentInsert)
    .select()
    .single();
  if (paymentError || !payment) throw paymentError ?? new Error('Failed to record payment');

  // Decrement outstanding_balance (read-then-write; acceptable for MVP)
  // Floor at 0: overpayments record the full amount but don't push balance negative
  const currentBalance = (retailerResult.data as { outstanding_balance: number }).outstanding_balance ?? 0;
  await supabaseAdmin
    .from('retailers')
    .update({ outstanding_balance: Math.max(0, currentBalance - amount) })
    .eq('id', retailer_id)
    .eq('org_id', req.orgId);

  const retailer = retailerResult.data as { phone: string; name: string };
  const orgName = orgResult.data ? (orgResult.data as { name: string }).name : 'SalesTrack';
  const whatsapp_link = generateWhatsAppReceiptLink(
    retailer.phone,
    amount,
    orgName,
    (payment as Payment).id,
  );

  res.status(201).json({ success: true, data: { payment: payment as Payment, whatsapp_link } });
});

// PUT /api/payments/:id/confirm — owner/manager only
router.put('/:id/confirm', async (req: Request, res: Response) => {
  if (req.user.role !== 'owner' && req.user.role !== 'manager') {
    res.status(403).json({ success: false, error: 'Only owners and managers can confirm payments' });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('payments')
    .update({ status: 'confirmed' })
    .eq('id', req.params['id'])
    .eq('org_id', req.orgId)
    .neq('status', 'confirmed') // idempotent guard
    .select()
    .single();
  if (error || !data) {
    res.status(404).json({ success: false, error: 'Payment not found or already confirmed' });
    return;
  }
  res.json({ success: true, data: data as Payment });
});

export default router;
