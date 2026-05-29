import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

const router = Router();

// Compute IST "today" boundaries as UTC timestamps.
// Supabase stores all timestamps in UTC; IST = UTC+5:30.
// A naive UTC-midnight filter misses the first 5.5 h of the IST day.
function istDayBounds(): { start: string; end: string } {
  const ISToffset = 5.5 * 60 * 60 * 1000;
  const now = new Date();
  const nowIST = new Date(now.getTime() + ISToffset);
  const startIST = new Date(nowIST);
  startIST.setUTCHours(0, 0, 0, 0);
  const endIST = new Date(nowIST);
  endIST.setUTCHours(23, 59, 59, 999);
  return {
    start: new Date(startIST.getTime() - ISToffset).toISOString(),
    end: new Date(endIST.getTime() - ISToffset).toISOString(),
  };
}

// GET /api/analytics/dashboard — owner summary for today
router.get('/dashboard', async (req: Request, res: Response) => {
  const { start, end } = istDayBounds();

  const [visitsResult, ordersResult, paymentsResult, agentsResult] = await Promise.all([
    supabaseAdmin
      .from('visits')
      .select('outcome')
      .eq('org_id', req.orgId)
      .gte('check_in_time', start)
      .lte('check_in_time', end),
    supabaseAdmin
      .from('orders')
      .select('total_amount')
      .eq('org_id', req.orgId)
      .neq('status', 'cancelled')
      .gte('created_at', start)
      .lte('created_at', end),
    supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('org_id', req.orgId)
      .eq('status', 'confirmed')
      .gte('created_at', start)
      .lte('created_at', end),
    supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', req.orgId)
      .eq('role', 'agent')
      .eq('is_active', true),
  ]);

  if (visitsResult.error) throw visitsResult.error;
  if (ordersResult.error) throw ordersResult.error;
  if (paymentsResult.error) throw paymentsResult.error;
  if (agentsResult.error) throw agentsResult.error;

  const visits = visitsResult.data ?? [];
  const orders = ordersResult.data ?? [];
  const payments = paymentsResult.data ?? [];

  const visitsPlanned = visits.length;
  const visitsCompleted = visits.filter((v) => (v as { outcome: string }).outcome === 'visited').length;
  const ordersValue = orders.reduce((sum, o) => sum + ((o as { total_amount: number }).total_amount ?? 0), 0);
  const collectionsTotal = payments.reduce((sum, p) => sum + ((p as { amount: number }).amount ?? 0), 0);
  const activeAgents = agentsResult.count ?? 0;

  res.json({
    success: true,
    data: {
      date: new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0],
      visits: { planned: visitsPlanned, completed: visitsCompleted },
      orders: { value: Math.round(ordersValue * 100) / 100 },
      collections: { total: Math.round(collectionsTotal * 100) / 100 },
      active_agents: activeAgents,
    },
  });
});

// GET /api/analytics/agent/:id — agent performance for a date range
router.get('/agent/:id', async (req: Request, res: Response) => {
  const agentId = req.params['id'];
  const ISToffset = 5.5 * 60 * 60 * 1000;
  const todayIST = new Date(Date.now() + ISToffset).toISOString().split('T')[0] as string;
  const sevenDaysAgoIST = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + ISToffset)
    .toISOString()
    .split('T')[0] as string;

  const from = typeof req.query['from'] === 'string' ? req.query['from'] : sevenDaysAgoIST;
  const to = typeof req.query['to'] === 'string' ? req.query['to'] : todayIST;

  // Convert IST day boundaries to UTC for Supabase queries
  const fromTs = new Date(
    new Date(`${from}T00:00:00.000Z`).getTime() - ISToffset,
  ).toISOString();
  const toTs = new Date(
    new Date(`${to}T23:59:59.999Z`).getTime() - ISToffset,
  ).toISOString();

  const [visitsResult, ordersResult, paymentsResult] = await Promise.all([
    supabaseAdmin
      .from('visits')
      .select('id, outcome')
      .eq('org_id', req.orgId)
      .eq('agent_id', agentId)
      .gte('check_in_time', fromTs)
      .lte('check_in_time', toTs),
    supabaseAdmin
      .from('orders')
      .select('id, total_amount')
      .eq('org_id', req.orgId)
      .eq('agent_id', agentId)
      .neq('status', 'cancelled')
      .gte('created_at', fromTs)
      .lte('created_at', toTs),
    supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('org_id', req.orgId)
      .eq('agent_id', agentId)
      .eq('status', 'confirmed')
      .gte('created_at', fromTs)
      .lte('created_at', toTs),
  ]);

  if (visitsResult.error) throw visitsResult.error;
  if (ordersResult.error) throw ordersResult.error;
  if (paymentsResult.error) throw paymentsResult.error;

  const visits = visitsResult.data ?? [];
  const orders = ordersResult.data ?? [];
  const payments = paymentsResult.data ?? [];

  const ordersValue = orders.reduce((sum, o) => sum + ((o as { total_amount: number }).total_amount ?? 0), 0);
  const collected = payments.reduce((sum, p) => sum + ((p as { amount: number }).amount ?? 0), 0);

  res.json({
    success: true,
    data: {
      agent_id: agentId,
      period: { from, to },
      visits: {
        completed: visits.filter((v) => (v as { outcome: string }).outcome === 'visited').length,
        total: visits.length,
      },
      orders: {
        count: orders.length,
        value: Math.round(ordersValue * 100) / 100,
      },
      payments: {
        collected: Math.round(collected * 100) / 100,
      },
    },
  });
});

export default router;
