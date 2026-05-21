-- ==========================================
-- AI Crypto Scalping Assistant
-- Supabase Migration: Create scalping_targets table + Auth RLS
-- ==========================================
-- Jalankan SQL ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/eeyboaycehhnnzmyvbnm/sql/new
--
-- PRASYARAT: Pastikan Supabase Auth sudah dikonfigurasi:
--   Dashboard > Authentication > Providers > Email:
--   ✅ Enable Email provider
--   ❌ Disable "Confirm email" (agar email buatan bisa langsung login)

-- ==========================================
-- 1. Buat tabel scalping_targets (dengan user_id)
-- ==========================================
CREATE TABLE IF NOT EXISTS scalping_targets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- Relasi ke auth user
  symbol VARCHAR(20) NOT NULL,                -- Contoh: BTCTHB, ETHTHB
  entry_price DECIMAL(20, 8) NOT NULL,        -- Harga beli
  target_price DECIMAL(20, 8) GENERATED ALWAYS AS (entry_price * 1.05) STORED, -- Auto 5% profit
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. Buat index untuk query performa tinggi
-- ==========================================
CREATE INDEX idx_scalping_targets_status ON scalping_targets (status);
CREATE INDEX idx_scalping_targets_symbol ON scalping_targets (symbol);
CREATE INDEX idx_scalping_targets_user_id ON scalping_targets (user_id);

-- ==========================================
-- 3. Enable Row Level Security (RLS)
-- ==========================================
ALTER TABLE scalping_targets ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 4. RLS Policies — Data isolasi per user
-- ==========================================

-- User hanya bisa SELECT datanya sendiri
CREATE POLICY "Users can view own targets"
  ON scalping_targets
  FOR SELECT
  USING (auth.uid() = user_id);

-- User hanya bisa INSERT dengan user_id miliknya sendiri
CREATE POLICY "Users can insert own targets"
  ON scalping_targets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- User hanya bisa UPDATE datanya sendiri
CREATE POLICY "Users can update own targets"
  ON scalping_targets
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User hanya bisa DELETE datanya sendiri
CREATE POLICY "Users can delete own targets"
  ON scalping_targets
  FOR DELETE
  USING (auth.uid() = user_id);

-- ==========================================
-- 5. (Opsional) Insert sample data untuk testing
-- ==========================================
-- Setelah sign up user, gunakan user UUID-nya:
-- INSERT INTO scalping_targets (user_id, symbol, entry_price)
--   VALUES ('<user-uuid>', 'BTCTHB', 2500000.00);
