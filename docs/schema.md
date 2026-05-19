# SalesTrack — Database Schema

Migration file: `apps/api/supabase/migrations/001_initial_schema.sql`

## Key Architectural Decisions

### Multi-tenancy via org_id
Every table has an `org_id UUID` column. All queries are scoped to the authenticated
user's organisation. Never query across organisations. Even when using `supabaseAdmin`
(which bypasses RLS), every query must manually include `.eq('org_id', req.orgId)`.

### Row Level Security (RLS) on all tables
RLS policies enforce org isolation at the database level using `auth_org_id()` — a
helper that reads `org_id` from the JWT `app_metadata`. Even if application-level
checks fail, the DB enforces isolation.

### JWT app_metadata carries org_id
When a user is created, their `org_id` is written to Supabase Auth `app_metadata`.

```sql
CREATE OR REPLACE FUNCTION auth_org_id() RETURNS UUID AS $$
  SELECT ((auth.jwt() -> 'app_metadata') ->> 'org_id')::UUID;
$$ LANGUAGE SQL STABLE;
```

### No product catalog — free-text order lines
`order_items` uses `item_description TEXT` + `unit TEXT` + `unit_price` instead of a
foreign key to a products table. Eliminates the onboarding friction of setting up a
catalog before agents can take orders.

### All tables share these columns
`id uuid pk`, `org_id uuid`, `created_at timestamptz`, `updated_at timestamptz`  
`updated_at` is auto-set by the `update_updated_at_column()` trigger on every table.

### Soft-delete pattern
Never `DELETE` rows (except beat_plans in 'draft' status). Set `is_active = false`.

---

## Tables (in dependency order)

### 1. organisations
```
id            UUID PK
name          TEXT NOT NULL
owner_email   TEXT NOT NULL
plan          TEXT CHECK ('starter','growth','business') DEFAULT 'starter'
is_active     BOOLEAN DEFAULT true
created_at    TIMESTAMPTZ
updated_at    TIMESTAMPTZ
```
Index: `owner_email`

### 2. users
```
id            UUID PK → auth.users(id) ON DELETE CASCADE
org_id        UUID → organisations(id) ON DELETE CASCADE
full_name     TEXT NOT NULL
phone         TEXT NOT NULL
role          TEXT CHECK ('owner','manager','agent')
is_active     BOOLEAN DEFAULT true
created_at    TIMESTAMPTZ
updated_at    TIMESTAMPTZ
```
Indexes: `org_id`, `phone`

### 3. retailers
```
id                  UUID PK
org_id              UUID → organisations(id)
name                TEXT NOT NULL
owner_name          TEXT NOT NULL
phone               TEXT NOT NULL
address             TEXT NOT NULL
area                TEXT NOT NULL
city                TEXT NOT NULL
latitude            NUMERIC(10,8)
longitude           NUMERIC(11,8)
outstanding_balance NUMERIC(12,2) DEFAULT 0
is_active           BOOLEAN DEFAULT true
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```
Indexes: `org_id`, `city`, `area`

### 4. beat_plans
```
id                UUID PK
org_id            UUID → organisations(id)
name              TEXT NOT NULL
assigned_agent_id UUID → users(id)
plan_date         DATE NOT NULL
status            TEXT CHECK ('draft','active','completed') DEFAULT 'draft'
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```
Indexes: `org_id`, `assigned_agent_id`, `plan_date`

### 5. beat_plan_retailers
```
id             UUID PK
org_id         UUID → organisations(id)
beat_plan_id   UUID → beat_plans(id) ON DELETE CASCADE
retailer_id    UUID → retailers(id) ON DELETE CASCADE
sequence_order INTEGER NOT NULL
is_visited     BOOLEAN DEFAULT false
created_at     TIMESTAMPTZ
updated_at     TIMESTAMPTZ
```
Indexes: `org_id`, `beat_plan_id`, `retailer_id`

### 6. visits
```
id                    UUID PK
org_id                UUID → organisations(id)
beat_plan_retailer_id UUID → beat_plan_retailers(id)
agent_id              UUID → users(id)
retailer_id           UUID → retailers(id)
check_in_lat          NUMERIC(10,8) NOT NULL
check_in_lng          NUMERIC(11,8) NOT NULL
check_in_time         TIMESTAMPTZ NOT NULL
check_out_time        TIMESTAMPTZ
outcome               TEXT CHECK ('visited','not_available','refused','pending') DEFAULT 'pending'
notes                 TEXT
photo_url             TEXT
created_at            TIMESTAMPTZ
updated_at            TIMESTAMPTZ
```
Indexes: `org_id`, `agent_id`, `retailer_id`, `check_in_time`

### 7. orders
```
id           UUID PK
org_id       UUID → organisations(id)
visit_id     UUID → visits(id)
agent_id     UUID → users(id)
retailer_id  UUID → retailers(id)
total_amount NUMERIC(12,2) NOT NULL
status       TEXT CHECK ('draft','confirmed','cancelled') DEFAULT 'draft'
notes        TEXT
created_at   TIMESTAMPTZ
updated_at   TIMESTAMPTZ
```
Indexes: `org_id`, `visit_id`, `agent_id`, `retailer_id`, `status`

### 8. order_items
```
id               UUID PK
org_id           UUID → organisations(id)
order_id         UUID → orders(id) ON DELETE CASCADE
item_description TEXT NOT NULL
unit             TEXT DEFAULT 'piece'
quantity         NUMERIC(10,2) NOT NULL
unit_price       NUMERIC(10,2) NOT NULL
total_price      NUMERIC(10,2) NOT NULL
created_at       TIMESTAMPTZ
updated_at       TIMESTAMPTZ
```
Indexes: `org_id`, `order_id`

### 9. payments
```
id                   UUID PK
org_id               UUID → organisations(id)
visit_id             UUID → visits(id)
agent_id             UUID → users(id)
retailer_id          UUID → retailers(id)
amount               NUMERIC(12,2) NOT NULL
method               TEXT CHECK ('cash','cheque','upi')
reference_number     TEXT
razorpay_order_id    TEXT
razorpay_payment_id  TEXT
status               TEXT CHECK ('pending','confirmed','failed') DEFAULT 'pending'
whatsapp_sent        BOOLEAN DEFAULT false
created_at           TIMESTAMPTZ
updated_at           TIMESTAMPTZ
```
Indexes: `org_id`, `visit_id`, `agent_id`, `retailer_id`, `status`

---

## RLS Policy Pattern (applied to all tables)

```sql
-- SELECT
CREATE POLICY "<table>_select" ON <table>
  FOR SELECT USING (org_id = auth_org_id());

-- INSERT
CREATE POLICY "<table>_insert" ON <table>
  FOR INSERT WITH CHECK (org_id = auth_org_id());

-- UPDATE
CREATE POLICY "<table>_update" ON <table>
  FOR UPDATE USING (org_id = auth_org_id());

-- DELETE
CREATE POLICY "<table>_delete" ON <table>
  FOR DELETE USING (org_id = auth_org_id());
```

`organisations` only has SELECT + UPDATE policies (no INSERT/DELETE via RLS — created
during signup via supabaseAdmin with compensation pattern).
