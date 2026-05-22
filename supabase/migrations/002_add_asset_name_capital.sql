-- ==========================================
-- Migration 002: Tambahkan kolom asset_name & capital
-- Jalankan di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/eeyboaycehhnnzmyvbnm/sql/new
-- ==========================================

-- Tambah kolom asset_name (nama lengkap aset, contoh: "Bitcoin", "Ethereum")
ALTER TABLE scalping_targets
  ADD COLUMN IF NOT EXISTS asset_name VARCHAR(100) DEFAULT NULL;

-- Tambah kolom capital (modal yang diinvestasikan, dalam mata uang quote asset)
ALTER TABLE scalping_targets
  ADD COLUMN IF NOT EXISTS capital DECIMAL(20, 2) DEFAULT NULL;

-- Perbarui komentar kolom untuk dokumentasi
COMMENT ON COLUMN scalping_targets.asset_name IS 'Nama lengkap aset kripto, contoh: Bitcoin, Ethereum, Solana';
COMMENT ON COLUMN scalping_targets.capital IS 'Modal yang diinvestasikan dalam quote currency (THB/USDT/dll)';
COMMENT ON COLUMN scalping_targets.entry_price IS 'Harga beli aset per unit';
COMMENT ON COLUMN scalping_targets.target_price IS 'Harga target jual (auto: entry_price * 1.05, yaitu +5%)';
