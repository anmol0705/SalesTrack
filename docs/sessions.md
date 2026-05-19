# SalesTrack — Session History

## Session 1 — 2026-05-13 ✅ COMPLETE

**Goal:** Initialize monorepo scaffold.

- Initialized monorepo with npm workspaces
- Created all workspace `package.json` files (renamed from `@fms/*` → `@salestrack/*`)
- Created `tsconfig.base.json`, `.gitignore`
- Created `packages/types/src/` — all 8 domain interfaces + enums
- Created `packages/utils/src/` — `formatCurrency`, `formatDate`, `formatTime`, `generateWhatsAppReceiptLink`
- Created `apps/api/supabase/migrations/001_initial_schema.sql` — full schema with RLS

---

## Session 2 — 2026-05-15 ✅ COMPLETE

**Goal:** Build Express API foundation — middleware, config, first route.

**Package versions pinned:** express 5.2.1, @supabase/supabase-js 2.105.4, helmet 8.1.0,
express-rate-limit 8.5.2, zod 4.4.3, tsx 4.22.0, vitest 4.1.6, typescript 6.0.3, dotenv 17.4.2

- Updated `apps/api/package.json` — replaced ts-node-dev with tsx, added express-rate-limit + vitest
- Updated `apps/api/tsconfig.json` — added paths for `@salestrack/types` and `@salestrack/utils`
- Created `apps/api/src/config/supabase.ts` — supabaseAdmin + supabaseClient, startup env check
- Created `apps/api/src/types/express.d.ts` — augmented Request with `user` and `orgId`
- Created `apps/api/src/middleware/auth.ts` — Bearer token verification via supabaseAdmin
- Created `apps/api/src/middleware/tenant.ts` — org_id extraction to req.orgId
- Created `apps/api/src/middleware/errorHandler.ts` — global error handler
- Created `apps/api/src/routes/retailers.ts` — full CRUD with Zod, area/search filters, soft-delete
- Created `apps/api/src/index.ts` — full Express app, verified `/health` returns 200
- Created `apps/api/.env.example`

---

## Session 3 — 2026-05-15 ✅ COMPLETE

**Goal:** Build all remaining API routes.

- Created `apps/api/src/routes/auth.ts` — signup (4-step with compensation), login, invite-agent, logout
- Created `apps/api/src/routes/beat-plans.ts` — CRUD + reorder + draft-only delete
- Created `apps/api/src/routes/visits.ts` — checkin/checkout + today filter (literal route before /:id)
- Created `apps/api/src/routes/orders.ts` — create with bulk items + total calculation + compensation
- Created `apps/api/src/routes/payments.ts` — log payment + outstanding_balance update + WhatsApp link
- Created `apps/api/src/routes/analytics.ts` — dashboard + agent performance (parallel Supabase queries)
- Updated `apps/api/src/index.ts` — auth router mounted before global middleware, all routers wired
- Created `apps/api/railway.toml` and `apps/api/Dockerfile`
- Verified: `/health` ✅, `/api/retailers` (no token → 401) ✅, `POST /api/auth/signup` → 201 ✅

---

## Session 4 — 2026-05-15 ✅ COMPLETE (Quality Audit)

**Goal:** Full security, data-integrity, TypeScript, and edge-case audit of the API.

### Security Fixes

**Error message leakage** — GET/list handlers used `res.status(500).json({ error: error.message })`
directly, bypassing the global `errorHandler` (which sanitizes messages in prod). Fixed with
`throw error` across 5 route files: retailers, beat-plans, visits, orders, payments.

**PostgREST filter injection** — `search` param in retailers was interpolated raw into
`.or('name.ilike.%${search}%,...')`. A `,` in the value adds extra filter conditions.
Fixed: strip `,()` metacharacters before interpolation.

**Cross-tenant checkin** — `supabaseAdmin` bypasses RLS, so `retailer_id` from the body could
reference a retailer from another org. Fixed: ownership verification query before visit insert.

### Data Integrity Fix

**Negative balance** — No floor on `outstanding_balance` update in payments.
Fixed: `Math.max(0, currentBalance - amount)`.

### TypeScript Fixes (zero errors)

- `ignoreDeprecations: "6.0"` added to `apps/api/tsconfig.json` (TS 6 deprecated `moduleResolution: node`)
- `rootDir: "../.."` set in `apps/api/tsconfig.json` to fix TS6059 (cross-package path aliases were outside rootDir)
- `apps/api/package.json` `main`/`start` updated to `dist/apps/api/src/index.js` (output path shifted)

### Dashboard tsconfig Fixes

- Scaffolded by `create-next-app` — corrected to extend monorepo base config
- `jsx: "react-jsx"` → `"preserve"` (Next.js handles JSX transform)
- Added `"types": ["node"]` to prevent implicit react-native type discovery
- Added `@salestrack/types` and `@salestrack/utils` path aliases

### Confirmed Clean (no changes needed)
- No try/catch in any route handler (Express 5 propagates async errors)
- Error handler correctly has 4 params
- Zod `.issues` used everywhere (not deprecated `.errors`)
- `.refine()` on PaymentSchema correctly chained
- `PUT /api/orders/:id/status` uses `z.enum(['confirmed','cancelled'])` — invalid status → 400
- Every supabaseAdmin query includes `.eq('org_id', req.orgId)`
- Order compensation (delete order if items fail) runs correctly before `throw`

---

## Session 5 — NEXT

**Goal:** Build dashboard pages.

Planned:
- Owner login page (Supabase Auth)
- Dashboard home — call `GET /api/analytics/dashboard`, display today's KPIs
- Retailers list page — call `GET /api/retailers`, search/filter UI
- Visits, orders, payments pages
- Mobile app scaffold (Expo)
