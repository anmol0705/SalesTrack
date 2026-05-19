import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // next is required for Express to recognise this as an error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
): void {
  console.error(err);

  if (process.env['NODE_ENV'] === 'development') {
    res.status(500).json({ success: false, error: err.message, stack: err.stack });
    return;
  }

  res.status(500).json({ success: false, error: 'Something went wrong' });
}
