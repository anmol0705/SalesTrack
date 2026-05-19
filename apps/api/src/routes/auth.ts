import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';

const router = Router();

const SignupSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  business_name: z.string().min(1, 'Business name is required'),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const InviteSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
  email: z.string().email('Invalid email format'),
  role: z.enum(['agent', 'manager']),
});

// POST /api/auth/signup — public, owner registration
router.post('/signup', async (req: Request, res: Response) => {
  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(', '),
    });
    return;
  }
  const { full_name, email, password, business_name, phone } = parsed.data;

  // Step 1: Create Supabase auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authData.user) {
    res.status(400).json({ success: false, error: authError?.message ?? 'Failed to create user' });
    return;
  }
  const authUser = authData.user;

  const compensate = () => supabaseAdmin.auth.admin.deleteUser(authUser.id);

  // Step 2: Insert organisation
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organisations')
    .insert({ name: business_name, owner_email: email })
    .select()
    .single();
  if (orgError || !org) {
    await compensate();
    throw orgError ?? new Error('Failed to create organisation');
  }

  // Step 3: Insert user record linked to auth user
  const { error: userError } = await supabaseAdmin.from('users').insert({
    id: authUser.id,
    org_id: org.id,
    full_name,
    phone,
    role: 'owner',
  });
  if (userError) {
    await compensate();
    throw userError;
  }

  // Step 4: Stamp org_id + role into app_metadata so RLS and JWT work
  const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
    app_metadata: { org_id: org.id, role: 'owner' },
  });
  if (metaError) {
    await compensate();
    throw metaError;
  }

  res.status(201).json({
    success: true,
    data: { org_id: org.id, user_id: authUser.id, email: authUser.email },
  });
});

// POST /api/auth/login — public
router.post('/login', async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(', '),
    });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.session) {
    res.status(401).json({ success: false, error: error?.message ?? 'Invalid credentials' });
    return;
  }

  res.json({
    success: true,
    data: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: data.user,
    },
  });
});

// POST /api/auth/invite-agent — protected (owner/manager only)
router.post(
  '/invite-agent',
  authMiddleware,
  tenantMiddleware,
  async (req: Request, res: Response) => {
    if (req.user.role !== 'owner' && req.user.role !== 'manager') {
      res.status(403).json({ success: false, error: 'Only owners and managers can invite agents' });
      return;
    }

    const parsed = InviteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(', '),
      });
      return;
    }
    const { full_name, phone, email, role } = parsed.data;

    // Create the invited auth user first to get their ID
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { org_id: req.orgId, role },
      });
    if (inviteError || !inviteData.user) {
      res.status(400).json({
        success: false,
        error: inviteError?.message ?? 'Failed to send invite',
      });
      return;
    }

    // Stamp app_metadata so RLS works once they accept
    await supabaseAdmin.auth.admin.updateUserById(inviteData.user.id, {
      app_metadata: { org_id: req.orgId, role },
    });

    // Insert user record pre-populated with org membership
    const { error: userError } = await supabaseAdmin.from('users').insert({
      id: inviteData.user.id,
      org_id: req.orgId,
      full_name,
      phone,
      role,
    });
    if (userError) throw userError;

    res.status(201).json({
      success: true,
      data: { message: 'Invite sent', user_id: inviteData.user.id },
    });
  },
);

// GET /api/auth/users — protected, owner/manager only
router.get(
  '/users',
  authMiddleware,
  tenantMiddleware,
  async (req: Request, res: Response) => {
    if (req.user.role !== 'owner' && req.user.role !== 'manager') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    let query = supabaseAdmin
      .from('users')
      .select('id, org_id, full_name, phone, role, is_active, created_at, updated_at')
      .eq('org_id', req.orgId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    const role = req.query['role'] as string | undefined;
    if (role) query = query.eq('role', role);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data: data ?? [] });
  },
);

// POST /api/auth/logout — protected
router.post('/logout', authMiddleware, async (req: Request, res: Response) => {
  // admin.signOut(jwt) invalidates the specific session server-side
  const token = (req.headers['authorization'] as string).slice(7);
  const { error } = await supabaseAdmin.auth.admin.signOut(token);
  if (error) throw error;
  res.json({ success: true });
});

export default router;
