import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
    return;
  }

  req.user = {
    id: data.user.id,
    email: data.user.email ?? '',
    role: (data.user.app_metadata['role'] as string | undefined) ?? 'agent',
    org_id: (data.user.app_metadata['org_id'] as string | undefined) ?? '',
  };

  next();
}
