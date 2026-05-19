import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth';
import { tenantMiddleware } from './middleware/tenant';
import { errorHandler } from './middleware/errorHandler';
import authRouter from './routes/auth';
import retailersRouter from './routes/retailers';
import beatPlansRouter from './routes/beat-plans';
import visitsRouter from './routes/visits';
import ordersRouter from './routes/orders';
import paymentsRouter from './routes/payments';
import analyticsRouter from './routes/analytics';

const app = express();

app.use(helmet());

const allowedOrigins = (process.env['ALLOWED_ORIGINS'] ?? '').split(',').filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.use(express.json());

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }),
);

// Health check — no auth required
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes are mounted BEFORE the global auth middleware.
// Public routes (signup, login) bypass auth entirely.
// Protected auth routes (invite-agent, logout) apply authMiddleware at the route level.
app.use('/api/auth', authRouter);

// All remaining /api/* routes require a valid JWT and an org_id in app_metadata.
app.use('/api', authMiddleware, tenantMiddleware);

app.use('/api/retailers', retailersRouter);
app.use('/api/beat-plans', beatPlansRouter);
app.use('/api/visits', visitsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/analytics', analyticsRouter);

app.use(errorHandler);

const port = parseInt(process.env['PORT'] ?? '4000', 10);
app.listen(port, () => {
  console.log(`SalesTrack API running on http://localhost:${port}`);
  console.log(`Environment : ${process.env['NODE_ENV'] ?? 'development'}`);
  console.log(`Allowed origins: ${allowedOrigins.join(', ') || '(none)'}`);
});
