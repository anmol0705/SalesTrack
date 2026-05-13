# SalesTrack — Claude Code Project Memory

## Project Name
**SalesTrack** — Field Sales Management Platform for wholesale distributors in India.

## Tech Stack
| Layer      | Technology                              |
|------------|-----------------------------------------|
| Mobile     | React Native (Expo ~50, expo-router)    |
| Dashboard  | Next.js 14 (App Router, Tailwind CSS)   |
| API        | Node.js + Express + TypeScript          |
| Database   | Supabase (PostgreSQL + Auth + Storage)  |
| Payments   | Razorpay                                |
| Shared     | TypeScript strict mode, npm workspaces  |

## Folder Structure
```
salestrack/
  apps/
    api/                    ← Express API
      src/                  ← TypeScript source
      supabase/
        migrations/         ← SQL migration files
    dashboard/              ← Next.js 14 dashboard
    mobile/                 ← Expo React Native app
  packages/
    types/                  ← Shared TypeScript interfaces (src/)
    utils/                  ← Shared helpers (src/)
  package.json              ← Root — npm workspaces
  tsconfig.base.json        ← Strict TypeScript base config
```

## Workspace Package Names
- `@salestrack/api`
- `@salestrack/dashboard`
- `@salestrack/mobile`
- `@salestrack/types`
- `@salestrack/utils`

## Key Architectural Decisions

### Multi-tenancy via org_id
Every table has an `org_id UUID` column. All queries are scoped to the
authenticated user's organisation. Never query across organisations.

### Row Level Security (RLS) on all tables
Supabase RLS policies enforce org isolation at the database level using
`auth_org_id()` — a helper that reads `org_id` from the JWT `app_metadata`.
This means even if application-level checks fail, the DB enforces isolation.

### JWT app_metadata carries org_id
When a user is created, their `org_id` is written to Supabase Auth
`app_metadata`. The RLS helper `auth_org_id()` reads it as:
```sql
((auth.jwt() -> 'app_metadata') ->> 'org_id')::UUID
```

### TypeScript strict mode everywhere
`tsconfig.base.json` enables `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, and `noImplicitReturns`. All workspaces extend it.

### Shared types and utils
- Import types from `@salestrack/types` — never redefine domain interfaces locally.
- Import helpers from `@salestrack/utils` — currency, date, WhatsApp deep links.

### Indian locale defaults
- Currency: `formatCurrency()` uses `en-IN` locale → ₹1,23,456
- Dates: `formatDate()` → "15 Jan 2026"
- WhatsApp receipts: Hindi/English bilingual pre-filled messages

## Database Tables (in dependency order)
1. `organisations`
2. `users` (references `auth.users`)
3. `retailers`
4. `products`
5. `beat_plans`
6. `beat_plan_retailers`
7. `visits`
8. `orders`
9. `order_items`
10. `payments`

All tables have: `id uuid pk`, `org_id uuid`, `created_at timestamptz`, `updated_at timestamptz`.
`updated_at` is auto-set by the `update_updated_at_column()` trigger on every table.

## Session Log

### Session 1 — 2026-05-13 ✅ COMPLETE
- Initialized monorepo with npm workspaces
- Created all workspace `package.json` files (renamed from `@fms/*` → `@salestrack/*`)
- Created `tsconfig.base.json`, `.gitignore`
- Created `packages/types/src/` — all 8 domain interfaces + enums
- Created `packages/utils/src/` — `formatCurrency`, `formatDate`, `formatTime`, `generateWhatsAppReceiptLink`
- Created `apps/api/supabase/migrations/001_initial_schema.sql` — full schema with RLS

## Next Session — Session 2
- Create Supabase project and run migration
- API boilerplate: Express app, Supabase client, auth middleware, org middleware
- First API routes: `/auth`, `/retailers`, `/products`
- Environment variable setup (`.env.example`)
