import { Router, Request, Response } from 'express';
import { z } from 'zod';
import type { BeatPlan, BeatPlanRetailer } from '@salestrack/types';
import { supabaseAdmin } from '../config/supabase';

const router = Router();

const BeatPlanSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  assigned_agent_id: z.string().uuid('Invalid agent ID'),
  plan_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'plan_date must be YYYY-MM-DD'),
  retailer_ids: z.array(z.string().uuid()).min(1, 'At least one retailer is required'),
});

const BeatPlanUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  assigned_agent_id: z.string().uuid().optional(),
  plan_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['draft', 'active', 'completed']).optional(),
});

const ReorderSchema = z.object({
  retailer_ids: z.array(z.string().uuid()).min(1),
});

// GET /api/beat-plans
router.get('/', async (req: Request, res: Response) => {
  const { agent_id, date } = req.query;

  let query = supabaseAdmin
    .from('beat_plans')
    .select('*, assigned_agent:users(id, full_name, phone)')
    .eq('org_id', req.orgId)
    .order('plan_date', { ascending: false });

  if (typeof agent_id === 'string' && agent_id.length > 0) {
    query = query.eq('assigned_agent_id', agent_id);
  }
  if (typeof date === 'string' && date.length > 0) {
    query = query.eq('plan_date', date);
  }

  const { data, error } = await query;
  if (error) throw error;
  res.json({ success: true, data });
});

// GET /api/beat-plans/:id — with retailers in sequence order
router.get('/:id', async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('beat_plans')
    .select(
      '*, assigned_agent:users(id, full_name, phone), beat_plan_retailers(*, retailer:retailers(id, name, owner_name, phone, area, city, outstanding_balance, latitude, longitude))',
    )
    .eq('id', req.params['id'])
    .eq('org_id', req.orgId)
    .order('sequence_order', { referencedTable: 'beat_plan_retailers', ascending: true })
    .single();

  if (error || !data) {
    res.status(404).json({ success: false, error: 'Beat plan not found' });
    return;
  }
  res.json({ success: true, data });
});

// POST /api/beat-plans
router.post('/', async (req: Request, res: Response) => {
  const parsed = BeatPlanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(', '),
    });
    return;
  }
  const { name, assigned_agent_id, plan_date, retailer_ids } = parsed.data;

  // Step 1: Insert beat plan
  const { data: beatPlan, error: bpError } = await supabaseAdmin
    .from('beat_plans')
    .insert({ name, assigned_agent_id, plan_date, status: 'draft', org_id: req.orgId })
    .select()
    .single();
  if (bpError || !beatPlan) throw bpError ?? new Error('Failed to create beat plan');

  // Step 2: Insert beat_plan_retailers using array index as sequence_order
  const bprRows = retailer_ids.map((retailer_id, index) => ({
    org_id: req.orgId,
    beat_plan_id: (beatPlan as BeatPlan).id,
    retailer_id,
    sequence_order: index,
  }));

  const { error: bprError } = await supabaseAdmin.from('beat_plan_retailers').insert(bprRows);
  if (bprError) {
    await supabaseAdmin.from('beat_plans').delete().eq('id', (beatPlan as BeatPlan).id);
    throw bprError;
  }

  res.status(201).json({ success: true, data: beatPlan as BeatPlan });
});

// PUT /api/beat-plans/:id
router.put('/:id', async (req: Request, res: Response) => {
  const parsed = BeatPlanUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(', '),
    });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('beat_plans')
    .update(parsed.data)
    .eq('id', req.params['id'])
    .eq('org_id', req.orgId)
    .select()
    .single();
  if (error || !data) {
    res.status(404).json({ success: false, error: 'Beat plan not found' });
    return;
  }
  res.json({ success: true, data: data as BeatPlan });
});

// PUT /api/beat-plans/:id/reorder
router.put('/:id/reorder', async (req: Request, res: Response) => {
  const parsed = ReorderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(', '),
    });
    return;
  }

  const beatPlanId = req.params['id'];

  // Verify the beat plan belongs to the org
  const { data: plan, error: planError } = await supabaseAdmin
    .from('beat_plans')
    .select('id')
    .eq('id', beatPlanId)
    .eq('org_id', req.orgId)
    .single();
  if (planError || !plan) {
    res.status(404).json({ success: false, error: 'Beat plan not found' });
    return;
  }

  // Update sequence_order for each retailer in parallel
  const updates = await Promise.all(
    parsed.data.retailer_ids.map((retailer_id, index) =>
      supabaseAdmin
        .from('beat_plan_retailers')
        .update({ sequence_order: index })
        .eq('beat_plan_id', beatPlanId)
        .eq('retailer_id', retailer_id)
        .eq('org_id', req.orgId),
    ),
  );

  const failed = updates.find((u) => u.error);
  if (failed?.error) throw failed.error;

  res.json({ success: true, data: { message: 'Sequence updated' } });
});

// DELETE /api/beat-plans/:id — hard delete, only if status = 'draft'
router.delete('/:id', async (req: Request, res: Response) => {
  const { data: plan, error: fetchError } = await supabaseAdmin
    .from('beat_plans')
    .select('id, status')
    .eq('id', req.params['id'])
    .eq('org_id', req.orgId)
    .single();
  if (fetchError || !plan) {
    res.status(404).json({ success: false, error: 'Beat plan not found' });
    return;
  }

  const bp = plan as BeatPlan;
  if (bp.status !== 'draft') {
    res.status(409).json({
      success: false,
      error: `Cannot delete a beat plan with status '${bp.status}'. Only draft plans can be deleted.`,
    });
    return;
  }

  const { error: deleteError } = await supabaseAdmin
    .from('beat_plans')
    .delete()
    .eq('id', bp.id)
    .eq('org_id', req.orgId);
  if (deleteError) throw deleteError;

  res.json({ success: true, data: { message: 'Beat plan deleted' } });
});

export default router;
