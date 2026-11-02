-- QuantX AI — migration iniziale su Supabase (PostgreSQL)
-- Rispecchia ESATTAMENTE lo schema usato da server.js (SQLite)

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT,
  password_hash TEXT NOT NULL,
  referral_code TEXT UNIQUE,
  referred_by BIGINT,
  wallet_address TEXT,
  balance NUMERIC(15,2) DEFAULT 0,
  total_ref_deposits NUMERIC(15,2) DEFAULT 0,
  plan_id BIGINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plans (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  min_deposit NUMERIC(10,2) NOT NULL,
  max_deposit NUMERIC(10,2),
  daily_yield_pct NUMERIC(5,2) NOT NULL,
  ref_bonus_pct NUMERIC(5,2) DEFAULT 0,
  color TEXT,
  icon TEXT
);

CREATE TABLE IF NOT EXISTS deposits (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  plan_id BIGINT,
  confirmed INTEGER DEFAULT 0,
  method TEXT DEFAULT 'card',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  fee NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  is_fast INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referrals (
  id BIGSERIAL PRIMARY KEY,
  referrer_id BIGINT NOT NULL,
  referee_id BIGINT NOT NULL,
  referrer_bonus NUMERIC(10,2) DEFAULT 0,
  active INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(referrer_id, referee_id)
);

CREATE TABLE IF NOT EXISTS user_plans (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  plan_id BIGINT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signals (
  user_id BIGINT NOT NULL,
  day TEXT NOT NULL,
  claimed TEXT NOT NULL DEFAULT '',
  profits TEXT NOT NULL DEFAULT '',
  UNIQUE(user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_deposits_user ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_user_plans_user ON user_plans(user_id);

-- Seed: settings base
INSERT INTO settings (key, value) VALUES
  ('platform_name', 'QuantX AI'),
  ('withdraw_min', '30'),
  ('withdraw_max', '20000'),
  ('withdraw_fee_pct', '2.5'),
  ('referral_levels', '17,5,2')
ON CONFLICT (key) DO NOTHING;

-- Seed: 10 livelli VIP 500 → 25.000.000
INSERT INTO plans (id, name, min_deposit, max_deposit, daily_yield_pct, ref_bonus_pct, color, icon) VALUES
  (1,'VIP 1',500,999,1.5,0,'#6ee7b7','◆'),
  (2,'VIP 2',1000,4999,2.0,0,'#6ee7b7','◆'),
  (3,'VIP 3',5000,9999,2.4,0,'#fbbf24','◆'),
  (4,'VIP 4',10000,24999,2.7,0,'#fbbf24','◆'),
  (5,'VIP 5',25000,49999,3.0,0,'#f97316','◆'),
  (6,'VIP 6',50000,74999,3.3,0,'#f97316','◆'),
  (7,'VIP 7',100000,499999,3.7,0,'#a78bfa','◆'),
  (8,'VIP 8',500000,2000000,4.0,0,'#a78bfa','◆'),
  (9,'VIP 9',1000000,5000000,4.5,0,'#ef4444','◆'),
  (10,'VIP 10',25000000,NULL,5.0,0,'#ef4444','◆')
ON CONFLICT (id) DO NOTHING;
