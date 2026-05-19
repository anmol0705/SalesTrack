# SalesTrack

Field sales management SaaS for wholesale distributors in India.

## Non-negotiable rules
- TypeScript strict mode everywhere — no `any`
- Every Supabase query must filter by `org_id` (multi-tenant isolation)
- No try/catch in Express 5 route handlers — throw errors, let errorHandler catch
- Tailwind v4 CSS-first — no tailwind.config.js exists, do not create one
- shadcn components import from `@/components/ui/<name>`
- All tokens via CSS variables (bg-background, text-foreground, etc.)
- Never hard-delete records — soft delete via is_active = false

## Reference files (read when relevant, not always)
- Database schema + RLS decisions → docs/schema.md
- Full tech stack + versions → docs/stack.md
- Session history + what was built → docs/sessions.md
- Supabase skill → docs/skills/supabase.md (read before any Supabase work)
- Tailwind v4 skill → docs/skills/tailwind.md (read before any styling work)
- Expo skill → docs/skills/expo.md (read before any mobile work)

## Monorepo layout
apps/api        → Node.js + Express 5 + TypeScript (PORT 4000)
apps/dashboard  → Next.js 16, App Router, shadcn radix-nova, Tailwind v4
apps/mobile     → React Native Expo (not started yet)
packages/types  → shared TypeScript interfaces
packages/utils  → formatCurrency, formatDate, generateWhatsAppReceiptLink

## Current status
Sessions 1–5 complete. API fully built + audited. Dashboard scaffold built.

### Dashboard scaffold (Session 5)
- shadcn v4, style radix-nova, Tailwind v4 CSS-first (no tailwind.config.js)
- All Tailwind tokens via CSS variables in globals.css
- Leaflet requires `dynamic(..., { ssr: false })` + CDN URL icon fix (not PNG import)
- src/lib/api.ts — Axios instance, Bearer interceptor, 401→/login redirect, typed API
- src/store/auth.ts — Zustand store, manual localStorage, JWT exp check in hydrate()
- src/providers/query-provider.tsx — React Query, staleTime 30s, no refetchOnWindowFocus
- Pages built: /login, /signup, /dashboard, /beat-plans, /beat-plans/new, /retailers, /agents
- Shared components: EmptyState, LeafletMap
- API addition: GET /api/auth/users?role= (auth.ts)
- ThemeProvider (next-themes 0.4.6) incompatible with React 19 children — removed; light mode only
- FormData is a reserved browser global — use FormValues as the local type alias
- z.preprocess conflicts with exactOptionalPropertyTypes — use z.string().optional() + manual Number() cast
- Droppable/Draggable render-prop `provided` needs explicit DroppableProvided/DraggableProvided types

Next: Session 6 — visits page, payments page, orders page, mobile app scaffold.
