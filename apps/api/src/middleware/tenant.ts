import { Request, Response, NextFunction } from 'express';

export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  const orgId = req.user.org_id;
  if (!orgId) {
    res.status(403).json({ success: false, error: 'No organisation associated with this account' });
    return;
  }
  req.orgId = orgId;
  next();
}
