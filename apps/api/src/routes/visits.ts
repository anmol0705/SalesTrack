import { Router, Request, Response } from 'express';
import { z } from 'zod';
import type { Visit } from '@salestrack/types';
import { supabaseAdmin } from '../config/supabase';

const router = Router();

const CheckinSchema = z.object({
  beat_plan_retailer_id: z.string().uuid('Invalid beat_plan_retailer_id'),
  retailer_id: z.string().uuid('Invalid retailer_id'),
  check_in_lat: z.number().min(-90).max(90),
  check_in_lng: z.number().min(-180).max(180),
});

const CheckoutSchema = z.object({
  outcome: z.enum(['visited', 'not_available', 'refused']),
  notes: z.string().optional(),
  photo_url: z.string().url().optional(),
});

// GET /api/visits/today — must be defined before /:id
router.get('/today', async (req: Request, res: Response) => {
  // Use IST day boundaries (UTC+5:30) so agents in India see their full workday
  const ISToffset = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(Date.now() + ISToffset);
  const startIST = new Date(nowIST);
  startIST.setUTCHours(0, 0, 0, 0);
  const endIST = new Date(nowIST);
  endIST.setUTCHours(23, 59, 59, 999);
  const todayStart = new Date(startIST.getTime() - ISToffset).toISOString();
  const todayEnd = new Date(endIST.getTime() - ISToffset).toISOString();

  const { data, error } = await supabaseAdmin
    .from('visits')
    .select('*, retailer:retailers(id, name, phone, area)')
    .eq('org_id', req.orgId)
    .eq('agent_id', req.user.id)
    .gte('check_in_time', todayStart)
    .lte('check_in_time', todayEnd)
    .order('check_in_time', { ascending: false });

  if (error) throw error;
  res.json({ success: true, data: data as Visit[] });
});

// GET /api/visits
router.get('/', async (req: Request, res: Response) => {
  const { agent_id, date, retailer_id } = req.query;

  let query = supabaseAdmin
    .from('visits')
    .select('*, retailer:retailers(id, name, phone, area), agent:users(id, full_name)')
    .eq('org_id', req.orgId)
    .order('check_in_time', { ascending: false });

  if (typeof agent_id === 'string' && agent_id.length > 0) {
    query = query.eq('agent_id', agent_id);
  }
  if (typeof retailer_id === 'string' && retailer_id.length > 0) {
    query = query.eq('retailer_id', retailer_id);
  }
  if (typeof date === 'string' && date.length > 0) {
    query = query.gte('check_in_time', `${date}T00:00:00.000Z`).lte('check_in_time', `${date}T23:59:59.999Z`);
  }

  const { data, error } = await query;
  if (error) throw error;
  res.json({ success: true, data: data as Visit[] });
});

// GET /api/visits/:id — with order and payment summary
router.get('/:id', async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('visits')
    .select(
      '*, retailer:retailers(id, name, owner_name, phone, area), orders(id, total_amount, status), payments(id, amount, method, status)',
    )
    .eq('id', req.params['id'])
    .eq('org_id', req.orgId)
    .single();

  if (error || !data) {
    res.status(404).json({ success: false, error: 'Visit not found' });
    return;
  }
  res.json({ success: true, data });
});

// POST /api/visits/checkin
router.post('/checkin', async (req: Request, res: Response) => {
  const parsed = CheckinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(', '),
    });
    return;
  }
  const { beat_plan_retailer_id, retailer_id, check_in_lat, check_in_lng } = parsed.data;

  // Verify the retailer belongs to the requesting org (supabaseAdmin bypasses RLS)
  const { data: retailerCheck, error: retailerCheckError } = await supabaseAdmin
    .from('retailers')
    .select('id')
    .eq('id', retailer_id)
    .eq('org_id', req.orgId)
    .single();
  if (retailerCheckError || !retailerCheck) {
    res.status(404).json({ success: false, error: 'Retailer not found' });
    return;
  }

  // Insert visit
  const { data: visit, error: visitError } = await supabaseAdmin
    .from('visits')
    .insert({
      org_id: req.orgId,
      beat_plan_retailer_id,
      retailer_id,
      agent_id: req.user.id,
      check_in_lat,
      check_in_lng,
      check_in_time: new Date().toISOString(),
      outcome: 'pending',
    })
    .select()
    .single();
  if (visitError || !visit) throw visitError ?? new Error('Failed to create visit');

  // Mark the beat plan stop as visited
  await supabaseAdmin
    .from('beat_plan_retailers')
    .update({ is_visited: true })
    .eq('id', beat_plan_retailer_id)
    .eq('org_id', req.orgId);

  res.status(201).json({ success: true, data: visit as Visit });
});

// PUT /api/visits/:id/checkout
router.put('/:id/checkout', async (req: Request, res: Response) => {
  const parsed = CheckoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(', '),
    });
    return;
  }

  const updatePayload: Record<string, unknown> = {
    check_out_time: new Date().toISOString(),
    outcome: parsed.data.outcome,
  };
  if (parsed.data.notes !== undefined) updatePayload['notes'] = parsed.data.notes;
  if (parsed.data.photo_url !== undefined) updatePayload['photo_url'] = parsed.data.photo_url;

  const { data, error } = await supabaseAdmin
    .from('visits')
    .update(updatePayload)
    .eq('id', req.params['id'])
    .eq('org_id', req.orgId)
    .select()
    .single();
  if (error || !data) {
    res.status(404).json({ success: false, error: 'Visit not found' });
    return;
  }
  res.json({ success: true, data: data as Visit });
});

export default router;
