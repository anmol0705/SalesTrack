import { Router, Request, Response } from 'express';
import { z } from 'zod';
import type { Retailer } from '@salestrack/types';
import { supabaseAdmin } from '../config/supabase';

const router = Router();

const RetailerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  owner_name: z.string().min(1, 'Owner name is required'),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
  address: z.string().min(1, 'Address is required'),
  area: z.string().min(1, 'Area is required'),
  city: z.string().min(1, 'City is required'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

const RetailerUpdateSchema = RetailerSchema.partial();

// GET /retailers
router.get('/', async (req: Request, res: Response) => {
  const { area, search } = req.query;

  let query = supabaseAdmin
    .from('retailers')
    .select('*')
    .eq('org_id', req.orgId)
    .eq('is_active', true);

  if (typeof area === 'string' && area.length > 0) {
    query = query.ilike('area', `%${area}%`);
  }

  if (typeof search === 'string' && search.length > 0) {
    // Strip PostgREST filter-string metacharacters to prevent filter injection via .or()
    const s = search.replace(/[,()]/g, '');
    query = query.or(`name.ilike.%${s}%,owner_name.ilike.%${s}%,phone.ilike.%${s}%`);
  }

  const { data, error } = await query.order('name');

  if (error) throw error;

  res.json({ success: true, data: data as Retailer[] });
});

// GET /retailers/:id
router.get('/:id', async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('retailers')
    .select('*')
    .eq('id', req.params['id'])
    .eq('org_id', req.orgId)
    .single();

  if (error || !data) {
    res.status(404).json({ success: false, error: 'Retailer not found' });
    return;
  }

  res.json({ success: true, data: data as Retailer });
});

// POST /retailers
router.post('/', async (req: Request, res: Response) => {
  const result = RetailerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: result.error.issues.map((i) => i.message).join(', '),
    });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('retailers')
    .insert({ ...result.data, org_id: req.orgId })
    .select()
    .single();

  if (error) throw error;

  res.status(201).json({ success: true, data: data as Retailer });
});

// PUT /retailers/:id
router.put('/:id', async (req: Request, res: Response) => {
  const result = RetailerUpdateSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: result.error.issues.map((i) => i.message).join(', '),
    });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('retailers')
    .update(result.data)
    .eq('id', req.params['id'])
    .eq('org_id', req.orgId)
    .select()
    .single();

  if (error || !data) {
    res.status(404).json({ success: false, error: 'Retailer not found' });
    return;
  }

  res.json({ success: true, data: data as Retailer });
});

// DELETE /retailers/:id — soft delete, never hard delete
router.delete('/:id', async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('retailers')
    .update({ is_active: false })
    .eq('id', req.params['id'])
    .eq('org_id', req.orgId)
    .select('id')
    .single();

  if (error || !data) {
    res.status(404).json({ success: false, error: 'Retailer not found' });
    return;
  }

  res.json({ success: true, data: { message: 'Retailer deactivated' } });
});

export default router;
