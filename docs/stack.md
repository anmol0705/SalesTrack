# SalesTrack — Tech Stack & Infrastructure

## Tech Stack

| Layer      | Technology                                          |
|------------|-----------------------------------------------------|
| Mobile     | React Native, Expo SDK ~50, expo-router             |
| Dashboard  | Next.js 16.2.6, App Router, shadcn radix-nova, Tailwind v4 |
| API        | Node.js, Express 5.2.1, TypeScript 6.0.3            |
| Database   | Supabase (PostgreSQL + Auth + Storage)              |
| Payments   | Razorpay                                            |
| Shared     | TypeScript strict mode, npm workspaces              |

## Pinned Package Versions (as of 2026-05-15)

### API (`apps/api`)
| Package                | Version  |
|------------------------|----------|
| express                | 5.2.1    |
| @supabase/supabase-js  | 2.105.4  |
| helmet                 | 8.1.0    |
| express-rate-limit     | 8.5.2    |
| zod                    | 4.4.3    |
| tsx                    | 4.22.0   |
| vitest                 | 4.1.6    |
| typescript             | 6.0.3    |
| dotenv                 | 17.4.2   |

### Dashboard (`apps/dashboard`)
| Package                | Version   |
|------------------------|-----------|
| next                   | 16.2.6    |
| react                  | 19.2.4    |
| react-dom              | 19.2.4    |
| tailwindcss            | ^4        |
| shadcn                 | ^4.7.0    |
| radix-ui               | ^1.4.3    |
| @supabase/supabase-js  | ^2.105.4  |
| @tanstack/react-query  | ^5.100.10 |
| react-hook-form        | ^7.76.0   |
| @hookform/resolvers    | ^5.2.2    |
| zustand                | ^5.0.13   |
| sonner                 | ^2.0.7    |
| lucide-react           | ^1.16.0   |
| next-themes            | ^0.4.6    |
| axios                  | ^1.16.1   |
| date-fns               | ^4.1.0    |
| zod                    | (via shadcn)|
| leaflet                | ^1.9.4    |
| react-leaflet          | ^5.0.0    |
| @hello-pangea/dnd      | ^18.0.1   |

## Monorepo Folder Structure

```
salestrack/
  apps/
    api/                        ← Express API (PORT 4000)
      src/
        config/supabase.ts      ← supabaseAdmin + supabaseClient
        middleware/
          auth.ts               ← Bearer token → req.user
          tenant.ts             ← req.orgId, 403 if missing
          errorHandler.ts       ← 4-param global handler
        routes/
          auth.ts               ← signup, login, invite-agent, logout
          retailers.ts          ← CRUD, soft-delete, search
          beat-plans.ts         ← CRUD, reorder, draft-only delete
          visits.ts             ← checkin/checkout, today filter
          orders.ts             ← create with bulk items + compensation
          payments.ts           ← log payment + balance + WhatsApp
          analytics.ts          ← dashboard KPIs + agent perf
        types/express.d.ts      ← Request augmentation
        index.ts                ← helmet, cors, rate-limit, listen
      supabase/
        migrations/
          001_initial_schema.sql
    dashboard/                  ← Next.js 16 (App Router)
      src/
        app/                    ← App Router pages
        components/ui/          ← shadcn components
        lib/utils.ts            ← cn() helper
        hooks/                  ← custom React hooks
    mobile/                     ← Expo React Native (not started)
  packages/
    types/src/                  ← Shared TypeScript interfaces
    utils/src/                  ← formatCurrency, formatDate, etc.
  package.json                  ← npm workspaces root
  tsconfig.base.json            ← strict TS base config
```

## Workspace Package Names

- `@salestrack/api`
- `@salestrack/dashboard`
- `@salestrack/mobile`
- `@salestrack/types`
- `@salestrack/utils`

## Deployment Targets

| App       | Platform  | Notes                                    |
|-----------|-----------|------------------------------------------|
| API       | Railway   | `apps/api/railway.toml` + `Dockerfile`   |
| Dashboard | Vercel    | Next.js App Router, auto-detected        |
| Database  | Supabase  | Hosted PostgreSQL + Auth + Storage       |
| Mobile    | Expo EAS  | Build service (not started yet)          |

## Environment Variables

### API (`apps/api/.env`)
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
PORT=4000
NODE_ENV=development
```

### Dashboard (`apps/dashboard/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## shadcn Configuration

- **Style**: `radix-nova`
- **Base**: Radix UI primitives
- **Tailwind**: v4 CSS-first (no `tailwind.config.js`)
- **Tokens**: CSS variables in `src/app/globals.css`
- **Aliases**: `@/components/ui`, `@/lib/utils`, `@/hooks`
- **Icon library**: Lucide React
- **Preset**: `b2fA` (neutral color scheme)
- **Installed components**: avatar, badge, button, card, dialog, dropdown-menu, input, label, select, sheet, sonner, table

## TypeScript Configuration

`tsconfig.base.json` enables:
- `strict`, `strictNullChecks`, `noImplicitAny`
- `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- `noImplicitReturns`, `noFallthroughCasesInSwitch`

API overrides: `rootDir: "../.."`, `ignoreDeprecations: "6.0"` (TypeScript 6 only)  
Dashboard overrides: `moduleResolution: bundler`, `jsx: preserve`, `types: ["node"]`

## Indian Locale Defaults

- Currency: `formatCurrency()` → `en-IN` locale → ₹1,23,456
- Dates: `formatDate()` → "15 Jan 2026"
- WhatsApp receipts: Hindi/English bilingual pre-filled messages
