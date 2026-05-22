-- ==========================================
-- Migration 003: DexScreener Hybrid Support
-- Jalankan di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/eeyboaycehhnnzmyvbnm/sql/new
-- ==========================================

-- Tambah kolom data_source: 'BINANCE' (default) atau 'DEXSCREENER'
ALTER TABLE scalping_targets
  ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'BINANCE'
  CHECK (data_source IN ('BINANCE', 'DEXSCREENER'));

-- Tambah kolom contract_address (wajib untuk DEX mode)
ALTER TABLE scalping_targets
  ADD COLUMN IF NOT EXISTS contract_address VARCHAR(200) DEFAULT NULL;

-- Tambah kolom chain_id (contoh: 'ethereum', 'bsc', 'solana', 'base')
ALTER TABLE scalping_targets
  ADD COLUMN IF NOT EXISTS chain_id VARCHAR(50) DEFAULT NULL;

-- Tambah kolom harga masuk dalam USD (untuk referensi DEX)
ALTER TABLE scalping_targets
  ADD COLUMN IF NOT EXISTS entry_price_usd DECIMAL(30, 12) DEFAULT NULL;

-- Komentar kolom
COMMENT ON COLUMN scalping_targets.data_source IS 'Sumber data harga: BINANCE atau DEXSCREENER';
COMMENT ON COLUMN scalping_targets.contract_address IS 'Contract address token (untuk DEXSCREENER mode)';
COMMENT ON COLUMN scalping_targets.chain_id IS 'Chain/jaringan blockchain token (ethereum, bsc, solana, base, dll)';
COMMENT ON COLUMN scalping_targets.entry_price_usd IS 'Harga masuk dalam USD saat input (referensi, harga IDR di entry_price)';

-- Index untuk query DEX targets
CREATE INDEX IF NOT EXISTS idx_scalping_targets_data_source ON scalping_targets (data_source);
CREATE INDEX IF NOT EXISTS idx_scalping_targets_contract ON scalping_targets (contract_address);
