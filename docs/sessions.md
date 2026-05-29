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

## Session 5 — ✅ COMPLETE

**Goal:** Build dashboard pages + mobile scaffold.

- Dashboard pages built: /login, /signup, /dashboard (KPIs), /beat-plans (list+new), /retailers,
  /agents (invite), /visits, /payments, /orders (sheet detail)
- Mobile scaffold: Expo SDK 52, expo-router v4, SecureStore auth, today route screen, GPS check-in
- Full tech stack: shadcn radix-nova, Tailwind v4 CSS-first, React Query, Zustand

---

## Session 6 — ✅ COMPLETE

**Goal:** Mobile order entry + payment collection screens.

- Mobile order screen: multi-item form, unit picker modal, computed totals, skip/submit footer
- Mobile payment screen: cash/UPI/cheque selection, reference number, WhatsApp receipt
- Today route: check-in → order entry → payment → checkout flow wired end-to-end
- Checkout modal: outcome pills (visited/not_available/refused) + notes
- TypeScript: 0 errors across all packages

---

## Session 7 — 2026-05-27 ✅ COMPLETE

**Goal:** Completion sprint — close all remaining gaps before deployment.

### Beat Plan Status Management (Tasks 1–2)

- Added `DropdownMenu` to beat-plans list page — Set Active / Mark Completed / Revert to Draft
- Added `api.beatPlans.updateStatus(id, status)` to dashboard API client
- Created `/beat-plans/[id]` detail page (server shell + `BeatPlanDetail` client component):
  - Shows plan name, status badge, change-status dropdown, Refresh button (when active)
  - Info cards: assigned agent + phone, plan date, progress (visited/total)
  - Retailers sequence table: #, name, area/city, outstanding balance (red if > 0), visited ✓/—
- Added `BeatPlanWithDetail` and `BeatPlanStop` types to dashboard `api.ts`
- Next.js 16 note: `params` in server page.tsx is `Promise<{ id: string }>` — must `await params`

### Mobile Checkout Flow (Task 3)

Already complete from Session 6 — verified all states present:
  - `checkoutModalVisible`, `checkoutVisitId`, `checkoutOutcome`, `checkoutNotes` state
  - `handleCheckout` calls `api.visits.checkout` and invalidates queries
  - Checkout modal with outcome pills + notes + Cancel/Complete buttons

### Dashboard Data (Tasks 4–6)

Already complete — verified all pages use joined relation names, not raw UUIDs:
  - Payments: `p.agent.full_name`, `p.retailer.name`, `generateWhatsAppReceiptLink(p.retailer.phone,...)`
  - Orders: `order.agent.full_name`, `order.retailer.name`
  - Visits: `visit.agent.full_name`, `visit.retailer.name`, `visit.retailer.area`

### Analytics IST Timezone Fix (Task 7)

- Extracted `istDayBounds()` helper in `analytics.ts` — computes UTC start/end for IST midnight→midnight
- Applied IST bounds to `GET /api/analytics/dashboard` (all 4 parallel queries)
- Fixed `GET /api/analytics/agent/:id` default date range to use IST date strings
- Fixed `GET /api/visits/today` in `visits.ts` to use IST day boundaries
- Root cause: Supabase stores UTC; India is UTC+5:30; naive UTC-midnight filter misses first 5.5h of IST day

### Mobile States (Task 8)

Already complete — all 3 states present in `(tabs)/index.tsx`:
  - Loading: centered `ActivityIndicator`
  - No beat plan: icon + "No route assigned today" + subtitle
  - Beat plan: `FlatList` with progress bar header + retailer cards

### shadcn Components (Task 9)

- `form.tsx` created manually (shadcn CLI skips unknown registry styles silently)
- All required components present: button, input, label, card, dialog, dropdown-menu, select,
  sheet, skeleton, sonner, table, navigation-menu, form, badge, avatar

### TypeScript (Task 10)

All 5 packages: **0 errors** (`npm run typecheck --workspaces`)

---

## Session 8 — 2026-05-27 ✅ COMPLETE

**Goal:** Upgrade Expo SDK 52 → SDK 54.

### Package upgrades
- `expo` ^52 → ^54.0.0
- `expo-router` ~4.0.22 → ~6.0.23 (v4 → v6)
- `expo-location` ~18.0.10 → ~19.0.8
- `expo-secure-store` ~14.0.1 → ~15.0.8
- `expo-camera` ~16.0.18 → ~17.0.10
- `expo-status-bar` ~2.0.1 → ~3.0.9
- `react` 18.3.1 → 19.1.0
- `react-native` 0.76.9 → 0.81.5
- `react-native-safe-area-context` ~4.12.0 → ~5.6.0
- `react-native-screens` ~4.4.0 → ~4.16.0
- `@types/react` pinned to ~19.1.10 (SDK 54 expected version)

### Breaking changes — all clear
- **expo-router v4 → v6**: `href: null` (hide tab), `router.replace`, `router.push` with params — no API changes affecting our codebase
- **expo-secure-store v14 → v15**: `getItemAsync`/`setItemAsync`/`deleteItemAsync` API unchanged
- **expo-location v18 → v19**: `requestForegroundPermissionsAsync`/`getCurrentPositionAsync` API unchanged  
- **React 19 + @types/react v19.1**: No type errors introduced; tsc passes clean
- **react-native 0.81.5**: New Architecture default — no impact on our StyleSheet/component usage

### TypeScript: 0 errors (apps/mobile)
### Metro: HTTP 200, `packager-status:running` ✅
