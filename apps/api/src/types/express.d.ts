import 'express';

declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        email: string;
        role: string;
        org_id: string;
      };
      orgId: string;
    }
  }
}

export {};
