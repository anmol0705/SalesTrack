# SalesTrack

Field sales management platform for wholesale distributors in India.

## What it does

SalesTrack helps FMCG/wholesale businesses manage their field sales teams:
- **Beat planning** — assign daily retailer visit routes to agents
- **Visit tracking** — GPS check-in, photo capture, outcome logging
- **Order taking** — create orders on-site at retailer locations
- **Payment collection** — cash/cheque/UPI with WhatsApp receipts
- **Dashboard** — real-time visibility for managers and owners

## Monorepo Structure

```
apps/
  api/          Node.js + Express + TypeScript backend
  dashboard/    Next.js 14 management dashboard
  mobile/       React Native Expo app for field agents
packages/
  types/        Shared TypeScript interfaces
  utils/        Shared helper functions
```

## Quick Start

```bash
# Install all workspace dependencies
npm install

# Run all apps in dev mode
npm run dev

# Type-check all workspaces
npm run typecheck
```

## Tech Stack

- **Mobile**: React Native (Expo)
- **Dashboard**: Next.js 14 with Tailwind CSS
- **API**: Node.js, Express, TypeScript
- **Database**: Supabase (PostgreSQL + Auth + Storage + RLS)
- **Payments**: Razorpay

## Architecture

Multi-tenant SaaS — every row in every table is scoped to an `org_id`.
Supabase Row Level Security enforces isolation at the database level.
The `org_id` is stored in Supabase Auth `app_metadata` and read by RLS policies.
