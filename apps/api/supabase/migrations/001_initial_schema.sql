-- =============================================================================
-- SalesTrack — Initial Schema
-- Migration: 001_initial_schema.sql
-- Multi-tenant field sales management platform for wholesale distributors
-- All tables enforce org_id isolation via RLS policies
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: auto-update updated_at on every table
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 1. organisations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organisations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  owner_email   TEXT NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'starter'
                  CHECK (plan IN ('starter', 'growth', 'business')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organisations_owner_email ON organisations (owner_email);

CREATE TRIGGER trg_organisations_updated_at
  BEFORE UPDATE ON organisations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 2. users
-- References auth.users so Supabase Auth manages identity.
-- org_id links to organisations.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  org_id        UUID NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  phone         TEXT NOT NULL,
  role          TEXT NOT NULL
                  CHECK (role IN ('owner', 'manager', 'agent')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_org_id ON users (org_id);
CREATE INDEX idx_users_phone  ON users (phone);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 3. retailers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS retailers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  owner_name          TEXT NOT NULL,
  phone               TEXT NOT NULL,
  address             TEXT NOT NULL,
  area                TEXT NOT NULL,
  city                TEXT NOT NULL,
  latitude            NUMERIC(10, 8),
  longitude           NUMERIC(11, 8),
  outstanding_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_retailers_org_id ON retailers (org_id);
CREATE INDEX idx_retailers_city   ON retailers (city);
CREATE INDEX idx_retailers_area   ON retailers (area);

CREATE TRIGGER trg_retailers_updated_at
  BEFORE UPDATE ON retailers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 4. beat_plans
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS beat_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  assigned_agent_id UUID NOT NULL REFERENCES users (id),
  plan_date         DATE NOT NULL,
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'active', 'completed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_beat_plans_org_id           ON beat_plans (org_id);
CREATE INDEX idx_beat_plans_assigned_agent_id ON beat_plans (assigned_agent_id);
CREATE INDEX idx_beat_plans_plan_date         ON beat_plans (plan_date);

CREATE TRIGGER trg_beat_plans_updated_at
  BEFORE UPDATE ON beat_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5. beat_plan_retailers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS beat_plan_retailers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  beat_plan_id   UUID NOT NULL REFERENCES beat_plans (id) ON DELETE CASCADE,
  retailer_id    UUID NOT NULL REFERENCES retailers (id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL,
  is_visited     BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_beat_plan_retailers_org_id       ON beat_plan_retailers (org_id);
CREATE INDEX idx_beat_plan_retailers_beat_plan_id ON beat_plan_retailers (beat_plan_id);
CREATE INDEX idx_beat_plan_retailers_retailer_id  ON beat_plan_retailers (retailer_id);

CREATE TRIGGER trg_beat_plan_retailers_updated_at
  BEFORE UPDATE ON beat_plan_retailers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 7. visits
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS visits (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  beat_plan_retailer_id UUID NOT NULL REFERENCES beat_plan_retailers (id),
  agent_id              UUID NOT NULL REFERENCES users (id),
  retailer_id           UUID NOT NULL REFERENCES retailers (id),
  check_in_lat          NUMERIC(10, 8) NOT NULL,
  check_in_lng          NUMERIC(11, 8) NOT NULL,
  check_in_time         TIMESTAMPTZ NOT NULL,
  check_out_time        TIMESTAMPTZ,
  outcome               TEXT NOT NULL DEFAULT 'pending'
                          CHECK (outcome IN ('visited', 'not_available', 'refused', 'pending')),
  notes                 TEXT,
  photo_url             TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_visits_org_id         ON visits (org_id);
CREATE INDEX idx_visits_agent_id       ON visits (agent_id);
CREATE INDEX idx_visits_retailer_id    ON visits (retailer_id);
CREATE INDEX idx_visits_check_in_time  ON visits (check_in_time);

CREATE TRIGGER trg_visits_updated_at
  BEFORE UPDATE ON visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 8. orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  visit_id     UUID NOT NULL REFERENCES visits (id),
  agent_id     UUID NOT NULL REFERENCES users (id),
  retailer_id  UUID NOT NULL REFERENCES retailers (id),
  total_amount NUMERIC(12, 2) NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_org_id      ON orders (org_id);
CREATE INDEX idx_orders_visit_id    ON orders (visit_id);
CREATE INDEX idx_orders_agent_id    ON orders (agent_id);
CREATE INDEX idx_orders_retailer_id ON orders (retailer_id);
CREATE INDEX idx_orders_status      ON orders (status);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 9. order_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  order_id         UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  item_description TEXT NOT NULL,
  unit             TEXT NOT NULL DEFAULT 'piece',
  quantity         NUMERIC(10, 2) NOT NULL,
  unit_price       NUMERIC(10, 2) NOT NULL,
  total_price      NUMERIC(10, 2) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_org_id   ON order_items (org_id);
CREATE INDEX idx_order_items_order_id ON order_items (order_id);

CREATE TRIGGER trg_order_items_updated_at
  BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 10. payments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  visit_id             UUID NOT NULL REFERENCES visits (id),
  agent_id             UUID NOT NULL REFERENCES users (id),
  retailer_id          UUID NOT NULL REFERENCES retailers (id),
  amount               NUMERIC(12, 2) NOT NULL,
  method               TEXT NOT NULL
                         CHECK (method IN ('cash', 'cheque', 'upi')),
  reference_number     TEXT,
  razorpay_order_id    TEXT,
  razorpay_payment_id  TEXT,
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'confirmed', 'failed')),
  whatsapp_sent        BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_org_id      ON payments (org_id);
CREATE INDEX idx_payments_visit_id    ON payments (visit_id);
CREATE INDEX idx_payments_agent_id    ON payments (agent_id);
CREATE INDEX idx_payments_retailer_id ON payments (retailer_id);
CREATE INDEX idx_payments_status      ON payments (status);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Row Level Security
-- All tables use org_id from JWT app_metadata to enforce tenant isolation.
-- JWT claim path: auth.jwt() -> app_metadata -> org_id
-- =============================================================================

ALTER TABLE organisations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE retailers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE beat_plans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE beat_plan_retailers ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits              ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments            ENABLE ROW LEVEL SECURITY;

-- Helper to extract org_id from JWT app_metadata
CREATE OR REPLACE FUNCTION auth_org_id() RETURNS UUID AS $$
  SELECT ((auth.jwt() -> 'app_metadata') ->> 'org_id')::UUID;
$$ LANGUAGE SQL STABLE;

-- ---------------------------------------------------------------------------
-- RLS Policies — organisations
-- ---------------------------------------------------------------------------
CREATE POLICY "org_select" ON organisations
  FOR SELECT USING (id = auth_org_id());

CREATE POLICY "org_update" ON organisations
  FOR UPDATE USING (id = auth_org_id());

-- ---------------------------------------------------------------------------
-- RLS Policies — users
-- ---------------------------------------------------------------------------
CREATE POLICY "users_select" ON users
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "users_insert" ON users
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "users_update" ON users
  FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY "users_delete" ON users
  FOR DELETE USING (org_id = auth_org_id());

-- ---------------------------------------------------------------------------
-- RLS Policies — retailers
-- ---------------------------------------------------------------------------
CREATE POLICY "retailers_select" ON retailers
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "retailers_insert" ON retailers
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "retailers_update" ON retailers
  FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY "retailers_delete" ON retailers
  FOR DELETE USING (org_id = auth_org_id());

-- ---------------------------------------------------------------------------
-- RLS Policies — beat_plans
-- ---------------------------------------------------------------------------
CREATE POLICY "beat_plans_select" ON beat_plans
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "beat_plans_insert" ON beat_plans
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "beat_plans_update" ON beat_plans
  FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY "beat_plans_delete" ON beat_plans
  FOR DELETE USING (org_id = auth_org_id());

-- ---------------------------------------------------------------------------
-- RLS Policies — beat_plan_retailers
-- ---------------------------------------------------------------------------
CREATE POLICY "beat_plan_retailers_select" ON beat_plan_retailers
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "beat_plan_retailers_insert" ON beat_plan_retailers
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "beat_plan_retailers_update" ON beat_plan_retailers
  FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY "beat_plan_retailers_delete" ON beat_plan_retailers
  FOR DELETE USING (org_id = auth_org_id());

-- ---------------------------------------------------------------------------
-- RLS Policies — visits
-- ---------------------------------------------------------------------------
CREATE POLICY "visits_select" ON visits
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "visits_insert" ON visits
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "visits_update" ON visits
  FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY "visits_delete" ON visits
  FOR DELETE USING (org_id = auth_org_id());

-- ---------------------------------------------------------------------------
-- RLS Policies — orders
-- ---------------------------------------------------------------------------
CREATE POLICY "orders_select" ON orders
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "orders_insert" ON orders
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "orders_update" ON orders
  FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY "orders_delete" ON orders
  FOR DELETE USING (org_id = auth_org_id());

-- ---------------------------------------------------------------------------
-- RLS Policies — order_items
-- ---------------------------------------------------------------------------
CREATE POLICY "order_items_select" ON order_items
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "order_items_insert" ON order_items
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "order_items_update" ON order_items
  FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY "order_items_delete" ON order_items
  FOR DELETE USING (org_id = auth_org_id());

-- ---------------------------------------------------------------------------
-- RLS Policies — payments
-- ---------------------------------------------------------------------------
CREATE POLICY "payments_select" ON payments
  FOR SELECT USING (org_id = auth_org_id());

CREATE POLICY "payments_insert" ON payments
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "payments_update" ON payments
  FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY "payments_delete" ON payments
  FOR DELETE USING (org_id = auth_org_id());
