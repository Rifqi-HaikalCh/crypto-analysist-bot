'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  TrendingUp,
  Activity,
  LogOut,
  Loader2,
  Target,
  ArrowUpRight,
  Zap,
  RefreshCw,
  Brain,
  LineChart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getScalpingTargets,
  addScalpingTarget,
  deleteScalpingTarget,
  type ScalpingTarget,
} from '@/lib/supabase';
import { signOut, getCurrentUser } from '@/lib/auth';
import type { User } from '@supabase/supabase-js';
import AnalysisModal from '@/components/analysis-modal';
import SymbolSearch from '@/components/symbol-search';
import PriceChart from '@/components/price-chart';
import MarketTicker from '@/components/market-ticker';
import WatchlistSection from '@/components/watchlist-section';

// ==========================================
// Types
// ==========================================

interface DashboardProps {
  onLogout: () => void;
}

// ==========================================
// Helpers
// ==========================================

const formatTHB = (value: number): string =>
  new Intl.NumberFormat('th-TH', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

// ==========================================
// Animation Variants
// ==========================================

const cardVariants = {
  initial: { opacity: 0, y: 24, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -16, scale: 0.94, transition: { duration: 0.2 } },
};

const containerVariants = {
  animate: {
    transition: { staggerChildren: 0.06 },
  },
};

// ==========================================
// Sub-components
// ==========================================

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 w-24 rounded-md bg-slate-800" />
        <div className="h-8 w-8 rounded-lg bg-slate-800" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-32 rounded bg-slate-800" />
        <div className="h-4 w-28 rounded bg-slate-800" />
        <div className="h-4 w-20 rounded bg-slate-800" />
      </div>
    </div>
  );
}

// ==========================================
// Main Component
// ==========================================

export default function Dashboard({ onLogout }: DashboardProps) {
  // --- State ---
  const [user, setUser] = useState<User | null>(null);
  const [targets, setTargets] = useState<ScalpingTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [analyzingTarget, setAnalyzingTarget] = useState<ScalpingTarget | null>(null);
  const [chartingTarget, setChartingTarget] = useState<ScalpingTarget | null>(null);
  // For watchlist chart (uses symbol string directly, not ScalpingTarget)
  const [watchlistChart, setWatchlistChart] = useState<{ symbol: string; type: 'GLOBAL' | 'SITE' } | null>(null);

  // --- Data Fetching ---
  const fetchTargets = useCallback(async () => {
    try {
      const data = await getScalpingTargets('active');
      setTargets(data);
    } catch {
      setError('Gagal memuat data target.');
    }
  }, []);

  const fetchUser = useCallback(async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([fetchUser(), fetchTargets()]);
      setIsLoading(false);
    };
    init();
  }, [fetchUser, fetchTargets]);

  // --- Handlers ---
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchTargets();
    setIsRefreshing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedSymbol = symbol.trim().toUpperCase();
    const price = parseFloat(entryPrice);

    if (!trimmedSymbol) {
      setError('Masukkan simbol koin.');
      return;
    }
    if (isNaN(price) || price <= 0) {
      setError('Masukkan harga beli yang valid.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await addScalpingTarget(trimmedSymbol, price);
      if (result) {
        setSuccess(`Target ${trimmedSymbol} berhasil ditambahkan!`);
        setSymbol('');
        setEntryPrice('');
        await fetchTargets();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Gagal menambahkan target. Silakan coba lagi.');
      }
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, targetSymbol: string) => {
    const confirmed = window.confirm(
      `Hapus target ${targetSymbol}? Aksi ini tidak dapat dibatalkan.`
    );
    if (!confirmed) return;

    setDeletingId(id);
    try {
      const success = await deleteScalpingTarget(id);
      if (success) {
        setTargets((prev) => prev.filter((t) => t.id !== id));
      } else {
        setError('Gagal menghapus target.');
      }
    } catch {
      setError('Terjadi kesalahan saat menghapus.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = async () => {
    await signOut();
    onLogout();
  };

  // --- Render ---
  return (
    <div className="min-h-screen bg-slate-950">
      {/* ====== Navbar ====== */}
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500 shadow-lg shadow-cyan-500/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
                Crypto Scalping Assistant
              </h1>
              <p className="hidden text-xs text-slate-500 sm:block">
                Real-time target monitoring
              </p>
            </div>
          </div>

          {/* User & Logout */}
          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden max-w-[180px] truncate text-sm text-slate-400 sm:inline-block">
                {user.email}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-300 transition-all hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ====== Live Market Ticker ====== */}
      <MarketTicker />

      {/* ====== Main Content ====== */}
      <main className="mx-auto max-w-7xl px-4 py-8 pb-16 sm:px-6 lg:px-8">
        {/* --- Add Target Form --- */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mb-10"
        >
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10">
                <Plus className="h-5 w-5 text-cyan-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">
                Tambah Target Scalping
              </h2>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-3 sm:flex-row">
                {/* Symbol Search with Autocomplete */}
                <div className="flex-1">
                  <SymbolSearch
                    value={symbol}
                    onChange={setSymbol}
                    placeholder="Cari koin... (BTCTHB, ETHTHB)"
                  />
                </div>

                {/* Entry Price Input */}
                <div className="flex-1">
                  <input
                    type="number"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    placeholder="Harga beli..."
                    step="any"
                    min="0"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition-all focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all',
                    'bg-gradient-to-r from-cyan-500 to-emerald-500 shadow-lg shadow-cyan-500/20',
                    'hover:shadow-cyan-500/30 hover:brightness-110',
                    'disabled:cursor-not-allowed disabled:opacity-50'
                  )}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {isSubmitting ? 'Menambahkan...' : 'Tambah Target'}
                </button>
              </div>
            </form>

            {/* Feedback Messages */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 text-sm text-red-400"
                >
                  {error}
                </motion.p>
              )}
              {success && (
                <motion.p
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 text-sm text-emerald-400"
                >
                  {success}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.section>

        {/* --- Active Targets Section --- */}
        <section>
          {/* Section Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                <Activity className="h-5 w-5 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Target Aktif</h2>
              {!isLoading && (
                <span className="inline-flex items-center rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-cyan-400 ring-1 ring-inset ring-cyan-500/20">
                  {targets.length}
                </span>
              )}
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2 text-xs text-slate-400 transition-all hover:border-slate-600 hover:text-white"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')}
              />
              Refresh
            </button>
          </div>

          {/* Loading Skeletons */}
          {isLoading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && targets.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 py-16 text-center"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/60">
                <Target className="h-8 w-8 text-slate-600" />
              </div>
              <h3 className="mb-1 text-base font-medium text-slate-400">
                Belum ada target aktif
              </h3>
              <p className="max-w-sm text-sm text-slate-600">
                Tambahkan target scalping pertamamu di atas. Sistem akan
                memantau harga 24/7 dan mengirimkan notifikasi saat target
                profit tercapai.
              </p>
            </motion.div>
          )}

          {/* Targets Grid */}
          {!isLoading && targets.length > 0 && (
            <motion.div
              variants={containerVariants}
              initial="initial"
              animate="animate"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <AnimatePresence mode="popLayout">
                {targets.map((target) => (
                  <motion.div
                    key={target.id}
                    variants={cardVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    layout
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="group rounded-xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur-sm transition-colors hover:border-cyan-500/30"
                  >
                    {/* Card Header */}
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-emerald-500/20">
                          <TrendingUp className="h-4 w-4 text-cyan-400" />
                        </div>
                        <span className="text-lg font-bold tracking-wide text-white">
                          {target.symbol}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5">
                        {/* Chart Button */}
                        <button
                          onClick={() => setChartingTarget(target)}
                          title="Lihat Grafik"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-slate-600 transition-all hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-400"
                        >
                          <LineChart className="h-4 w-4" />
                        </button>

                        {/* Analyze AI Button */}
                        <button
                          onClick={() => setAnalyzingTarget(target)}
                          title="Analisis AI"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-slate-600 transition-all hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-400"
                        >
                          <Brain className="h-4 w-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(target.id, target.symbol)}
                          disabled={deletingId === target.id}
                          title="Hapus target"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-slate-600 transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                        >
                          {deletingId === target.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Price Info */}
                    <div className="space-y-3">
                      {/* Entry Price */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                          Harga Beli
                        </span>
                        <span className="text-sm font-semibold text-slate-200">
                          ฿{formatTHB(target.entry_price)}
                        </span>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-dashed border-slate-800" />

                      {/* Target Price */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                          Target Jual
                        </span>
                        <div className="flex items-center gap-1.5">
                          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-sm font-semibold text-emerald-400">
                            ฿{formatTHB(target.target_price)}
                          </span>
                        </div>
                      </div>

                      {/* Profit Badge */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                          Profit
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                          <TrendingUp className="h-3 w-3" />
                          +5.00%
                        </span>
                      </div>
                    </div>

                    {/* Created Date */}
                    <div className="mt-4 border-t border-slate-800/60 pt-3">
                      <p className="text-[11px] text-slate-600">
                        Dibuat: {formatDate(target.created_at)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </section>

        {/* ====== Watchlist Section ====== */}
        <WatchlistSection
          activeTargets={targets}
          onChartOpen={(sym, type) => setWatchlistChart({ symbol: sym, type })}
        />
      </main>

      {/* ====== Analysis Modal ====== */}
      {analyzingTarget && (
        <AnalysisModal
          symbol={analyzingTarget.symbol}
          entryPrice={analyzingTarget.entry_price}
          isOpen={!!analyzingTarget}
          onClose={() => setAnalyzingTarget(null)}
        />
      )}

      {/* ====== Price Chart Modal (Target) ====== */}
      {chartingTarget && (
        <PriceChart
          symbol={chartingTarget.symbol}
          symbolType="GLOBAL"
          isOpen={!!chartingTarget}
          onClose={() => setChartingTarget(null)}
        />
      )}

      {/* ====== Price Chart Modal (Watchlist) ====== */}
      {watchlistChart && (
        <PriceChart
          symbol={watchlistChart.symbol}
          symbolType={watchlistChart.type}
          isOpen={!!watchlistChart}
          onClose={() => setWatchlistChart(null)}
        />
      )}
    </div>
  );
}
