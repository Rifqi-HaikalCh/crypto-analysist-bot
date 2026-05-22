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
  BellRing,
  Edit3,
  BarChart2,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getScalpingTargets,
  addScalpingTarget,
  deleteScalpingTarget,
  updateScalpingTargetDetails,
  type ScalpingTarget,
} from '@/lib/supabase';
import { signOut, getCurrentUser } from '@/lib/auth';
import type { User } from '@supabase/supabase-js';
import AnalysisModal from '@/components/analysis-modal';
import UnifiedTokenSearch from '@/components/unified-token-search';
import type { UnifiedResult } from '@/components/unified-token-search';
import PriceChart from '@/components/price-chart';
import MarketTicker from '@/components/market-ticker';
import WatchlistSection from '@/components/watchlist-section';
import NewsSection from '@/components/news-section';
import TelegramSetupModal from '@/components/telegram-setup-modal';
import EditTargetModal from '@/components/edit-target-modal';

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
    <div className="rounded-xl border border-gray-200 bg-white p-5 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 w-24 rounded-md bg-gray-100" />
        <div className="h-8 w-8 rounded-lg bg-gray-100" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-32 rounded bg-gray-100" />
        <div className="h-4 w-28 rounded bg-gray-100" />
        <div className="h-4 w-20 rounded bg-gray-100" />
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
  // Unified form state
  const [selectedToken, setSelectedToken] = useState<UnifiedResult | null>(null);
  const [entryPrice, setEntryPrice] = useState('');     // shown & editable
  const [assetName, setAssetName] = useState('');
  const [capital, setCapital] = useState('');
  const [idrRate, setIdrRate] = useState<number>(16350);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [telegramChatId, setTelegramChatId] = useState<string>('');
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [pendingTargetData, setPendingTargetData] = useState<any>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<ScalpingTarget | null>(null);
  const [analyzingTarget, setAnalyzingTarget] = useState<ScalpingTarget | null>(null);
  const [trendAnalysisSymbol, setTrendAnalysisSymbol] = useState<string | null>(null);
  const [chartingTarget, setChartingTarget] = useState<ScalpingTarget | null>(null);
  // Live prices: Binance (WSS) + DEX (REST polling)
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [livePricesTime, setLivePricesTime] = useState<Record<string, string>>({});
  // DEX targets usdtIdr rate for IDR conversion
  const [usdtIdrRate, setUsdtIdrRate] = useState<number>(16350);
  // For watchlist chart
  const [watchlistChart, setWatchlistChart] = useState<{ symbol: string; type: 'GLOBAL' | 'SITE' } | null>(null);

  // Mobile Bottom Nav State
  const [mobileTab, setMobileTab] = useState<'targets' | 'market' | 'discover'>('targets');

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

    // Read saved Telegram Chat ID
    const savedId = localStorage.getItem('telegram_chat_id');
    if (savedId) setTelegramChatId(savedId);
  }, [fetchUser, fetchTargets]);

  // --- Real-time Live Prices: Binance WebSocket (BINANCE targets only) ---
  useEffect(() => {
    const binanceTargets = targets.filter((t) => t.data_source !== 'DEXSCREENER');
    if (binanceTargets.length === 0) return;

    const symbols = [...new Set(binanceTargets.map((t) => t.symbol))];
    const globalSyms = symbols.filter((s) => !s.endsWith('THB'));
    const siteSyms = symbols.filter((s) => s.endsWith('THB'));
    const wsList: WebSocket[] = [];

    const connectWS = (syms: string[], base: string) => {
      if (syms.length === 0) return;
      const streams = syms.map((s) => `${s.toLowerCase()}@miniTicker`).join('/');
      const ws = new WebSocket(`${base}?streams=${streams}`);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const d = msg?.data;
          if (!d?.s || !d?.c) return;
          const symbol = d.s.toUpperCase();
          setLivePrices((prev) => ({ ...prev, [symbol]: parseFloat(d.c) }));
          setLivePricesTime((prev) => ({ ...prev, [symbol]: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }));
        } catch { /* ignore */ }
      };
      wsList.push(ws);
    };

    connectWS(globalSyms, 'wss://www.binance.th/gstream');
    connectWS(siteSyms, 'wss://www.binance.th/nstream');
    return () => wsList.forEach((ws) => { ws.onclose = null; ws.close(); });
  }, [targets]);

  // --- Real-time Live Prices: DEX polling (every 15s) ---
  useEffect(() => {
    const dexTargets = targets.filter((t) => t.data_source === 'DEXSCREENER' && t.contract_address);
    if (dexTargets.length === 0) return;

    const pollDex = async () => {
      // Fetch current IDR rate
      try {
        const rateRes = await fetch('/api/rates');
        const rateData = await rateRes.json();
        if (rateData.success) setUsdtIdrRate(rateData.data.usdtIdr);
      } catch { /* use cached */ }

      // Fetch price for each DEX target
      await Promise.allSettled(
        dexTargets.map(async (target) => {
          try {
            const res = await fetch(`/api/dexscreener?address=${target.contract_address}`);
            const data = await res.json();
            if (data.success && data.data?.priceUsd) {
              const priceIdr = data.data.priceUsd * usdtIdrRate;
              const addr = target.contract_address!;
              setLivePrices((prev) => ({ ...prev, [addr]: priceIdr }));
              setLivePricesTime((prev) => ({ ...prev, [addr]: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }));
            }
          } catch { /* ignore */ }
        })
      );
    };

    pollDex(); // immediate
    const interval = setInterval(pollDex, 15_000);
    return () => clearInterval(interval);
  }, [targets, usdtIdrRate]);

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
    setIsSubmitting(true);

    try {
      if (!selectedToken) {
        setError('Pilih koin dari hasil pencarian terlebih dahulu.');
        return;
      }

      const isDex = selectedToken.source === 'DEXSCREENER';
      const cap = capital ? parseFloat(capital) : undefined;
      if (cap !== undefined && (isNaN(cap) || cap <= 0)) { setError('Modal harus lebih dari 0.'); return; }

      let finalSymbol: string;
      let finalEntryPrice: number;
      let finalAssetName: string | undefined;
      let contractAddress: string | undefined;
      let chainId: string | undefined;
      let entryPriceUsd: number | undefined;

      if (isDex) {
        const t = selectedToken.dexToken!;
        const priceIdr = t.priceUsd * idrRate;
        finalSymbol = t.symbol;
        finalEntryPrice = priceIdr;
        finalAssetName = assetName.trim() || t.name;
        contractAddress = t.contractAddress;
        chainId = t.chainId;
        entryPriceUsd = t.priceUsd;
      } else {
        const price = parseFloat(entryPrice);
        if (!selectedToken.binanceSymbol) { setError('Pilih simbol dari Binance.'); return; }
        if (isNaN(price) || price <= 0) { setError('Masukkan harga beli yang valid.'); return; }
        finalSymbol = selectedToken.binanceSymbol;
        finalEntryPrice = price;
        finalAssetName = assetName.trim() || selectedToken.binanceBase || undefined;
      }

      const dataPayload = {
        finalSymbol, finalEntryPrice, finalAssetName, cap,
        isDex, contractAddress, chainId, entryPriceUsd
      };

      if (!telegramChatId) {
        setPendingTargetData(dataPayload);
        setShowTelegramModal(true);
        setIsSubmitting(false);
        return;
      }

      await executeSubmit(dataPayload, telegramChatId);

    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
      setIsSubmitting(false);
    }
  };

  const executeSubmit = async (data: any, chatId: string) => {
    setIsSubmitting(true);
    try {
      const result = await addScalpingTarget(
        data.finalSymbol,
        data.finalEntryPrice,
        data.finalAssetName,
        data.cap,
        data.isDex ? 'DEXSCREENER' : 'BINANCE',
        data.contractAddress,
        data.chainId,
        data.entryPriceUsd,
        chatId
      );

      if (result) {
        const priceDisplay = data.isDex
          ? `Rp${Math.round(data.finalEntryPrice).toLocaleString('id-ID')}`
          : data.finalEntryPrice.toLocaleString();
        setSuccess(`✅ Target ${data.finalSymbol} ditambahkan! (${priceDisplay})`);
        setSelectedToken(null);
        setEntryPrice('');
        setAssetName('');
        setCapital('');
        await fetchTargets();
        setTimeout(() => setSuccess(null), 4000);
      } else {
        setError('Gagal menyimpan target. Coba lagi.');
      }
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTelegramSubmit = async (chatId: string) => {
    setTelegramChatId(chatId);
    localStorage.setItem('telegram_chat_id', chatId);
    setShowTelegramModal(false);
    if (pendingTargetData) {
      await executeSubmit(pendingTargetData, chatId);
      setPendingTargetData(null);
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

  const handleEditTarget = async (id: string, entryPrice: number, capital?: number) => {
    try {
      const success = await updateScalpingTargetDetails(id, entryPrice, capital);
      if (success) {
        setTargets((prev) => 
          prev.map((t) => 
            t.id === id 
              ? { ...t, entry_price: entryPrice, capital: capital || null, target_price: entryPrice * 1.05 } 
              : t
          )
        );
        setSuccess('Target berhasil diperbarui.');
      } else {
        setError('Gagal memperbarui target.');
      }
    } catch {
      setError('Terjadi kesalahan saat memperbarui.');
    }
  };

  const handleLogout = async () => {
    await signOut();
    onLogout();
  };

  // --- Render ---
  return (
    <div className="min-h-screen bg-white">
      {/* ====== Navbar ====== */}
      <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)] shadow-lg shadow-red-500/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
                Crypto Scalping Assistant
              </h1>
              <p className="hidden text-xs text-gray-500 sm:block">
                Real-time target monitoring
              </p>
            </div>
          </div>

          {/* User & Logout */}
          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden max-w-[180px] truncate text-sm text-gray-600 sm:inline-block">
                {user.email}
              </span>
            )}
            <button
              onClick={() => setShowTelegramModal(true)}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-100/60 p-2 text-sm text-gray-700 transition-all hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-500"
              title="Pengaturan Telegram"
            >
              <BellRing className="h-4 w-4" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-100/60 px-3 py-2 text-sm text-gray-700 transition-all hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ====== Telegram Warning Banner ====== */}
      {!isLoading && !telegramChatId && (
        <div className="bg-amber-100 px-4 py-3 text-center sm:px-6">
          <p className="text-sm font-medium text-amber-800">
            ⚠️ Anda belum mengonfigurasi Telegram Bot. Notifikasi alert tidak akan terkirim.{" "}
            <button
              onClick={() => setShowTelegramModal(true)}
              className="font-bold underline hover:text-amber-900"
            >
              Konfigurasi Sekarang
            </button>
          </p>
        </div>
      )}

      {/* ====== Live Market Ticker ====== */}
      <MarketTicker />

      {/* ====== Main Content ====== */}
      <main className="mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 lg:px-8">
        
        {/* --- Mobile: Targets Tab Container --- */}
        <div className={cn("lg:block", mobileTab === 'targets' ? "block" : "hidden")}>
          {/* --- Add Target Form --- */}
          <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mb-10"
        >
          <div className="rounded-2xl border border-gray-200 bg-white p-6 ">
            {/* Unified Form — one form, all sources */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Row 1: Unified search */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Cari Koin · Binance.th + DexScreener *
                </label>
                <UnifiedTokenSearch
                  onSelect={(result, rate) => {
                    setSelectedToken(result);
                    setIdrRate(rate);
                    // Auto-fill name
                    if (result.source === 'BINANCE') {
                      setAssetName(result.binanceBase || '');
                      setEntryPrice(''); // user must input for Binance
                    } else {
                      setAssetName(result.dexToken?.name || result.displayName);
                      // Auto-fill entry price in IDR for DEX
                      if (result.dexToken?.priceUsd) {
                        setEntryPrice(Math.round(result.dexToken.priceUsd * rate).toString());
                      }
                    }
                  }}
                  onClear={() => { setSelectedToken(null); setEntryPrice(''); setAssetName(''); }}
                  placeholder="Ketik nama, simbol, atau paste contract address..."
                />
              </div>

              {/* Row 2: Nama + Harga + Modal */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">Nama Aset</label>
                  <input
                    type="text"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    placeholder="Bitcoin, Ethereum..."
                    className="w-full rounded-xl border border-gray-300 bg-gray-100/60 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">
                    {selectedToken?.source === 'DEXSCREENER'
                      ? 'Harga Masuk (IDR) — auto'
                      : 'Harga Masuk *'
                    }
                  </label>
                  <input
                    type="number"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    placeholder={selectedToken?.source === 'DEXSCREENER' ? 'Auto dari DexScreener...' : 'Harga beli...'}
                    step="any"
                    min="0"
                    className="w-full rounded-xl border border-gray-300 bg-gray-100/60 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">Modal (opsional)</label>
                  <input
                    type="number"
                    value={capital}
                    onChange={(e) => setCapital(e.target.value)}
                    placeholder="Jumlah modal..."
                    step="any"
                    min="0"
                    className="w-full rounded-xl border border-gray-300 bg-gray-100/60 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedToken}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-500/20 transition-all hover:bg-[var(--primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed'
                  )}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {isSubmitting ? 'Menyimpan...' : `Tambah Target${
                    selectedToken?.source === 'DEXSCREENER' ? ' DEX' : ''
                  }`}
                </button>
              </div>
            </form>

            {/* Feedback Messages */}
            <AnimatePresence>
              {error && (
                <motion.p
                  key="error-msg"
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
                  key="success-msg"
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
              <h2 className="text-lg font-semibold text-gray-900">Target Aktif</h2>
              {!isLoading && (
                <span className="inline-flex items-center rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-cyan-400 ring-1 ring-inset ring-cyan-500/20">
                  {targets.length}
                </span>
              )}
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-100/40 px-3 py-2 text-xs text-gray-600 transition-all hover:border-slate-600 hover:text-gray-900"
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
              className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white/30 py-16 text-center"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100/60">
                <Target className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="mb-1 text-base font-medium text-gray-600">
                Belum ada target aktif
              </h3>
              <p className="max-w-sm text-sm text-gray-400">
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
                {targets.map((target) => {
                  const isDex = target.data_source === 'DEXSCREENER';
                  const currency = isDex ? 'Rp' : (target.symbol.endsWith('THB') ? '฿' : '$');
                  // For DEX: live price key is contract_address; for Binance: symbol
                  const liveKey = isDex ? (target.contract_address || target.symbol) : target.symbol;
                  const livePrice = livePrices[liveKey];
                  const currentPct = livePrice
                    ? ((livePrice - target.entry_price) / target.entry_price) * 100
                    : null;
                  const remainingPct = currentPct !== null ? 5 - currentPct : null;
                  const progressPct = currentPct !== null
                    ? Math.max(0, Math.min(100, (currentPct / 5) * 100))
                    : 0;
                  const isProfit = currentPct !== null && currentPct > 0;
                  const isTargetReached = currentPct !== null && currentPct >= 5;
                  // Estimated profit from capital
                  const estProfit = target.capital && livePrice
                    ? (target.capital * (currentPct || 0)) / 100
                    : null;

                  return (
                    <motion.div
                      key={target.id}
                      variants={cardVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      layout
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className={cn(
                        'group rounded-xl border bg-white p-5  transition-colors',
                        isTargetReached
                          ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                          : 'border-gray-200 hover:border-cyan-500/30'
                      )}
                    >
                      {/* Card Header */}
                      <div className="mb-4 flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black',
                            isTargetReached
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-[var(--primary)] text-white shadow shadow-red-500/10'
                          )}>
                            {(target.asset_name || target.symbol).slice(0, 3).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-bold text-gray-900">
                                {target.asset_name || target.symbol}
                              </p>
                              {/* Source badge */}
                              {isDex ? (
                                <span className="rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-400">
                                  DEX
                                </span>
                              ) : (
                                <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-cyan-400">
                                  BINANCE
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">{target.symbol}</p>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setChartingTarget(target)}
                            title="Lihat Grafik"
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-gray-400 transition-all hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-400"
                          >
                            <LineChart className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setAnalyzingTarget(target)}
                            title="Analisis AI"
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-gray-400 transition-all hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-400"
                          >
                            <Brain className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingTarget(target)}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-100 hover:text-blue-600"
                            title="Edit Harga & Modal"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(target.id, target.symbol)}
                            disabled={deletingId === target.id}
                            title="Hapus target"
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-gray-400 transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                          >
                            {deletingId === target.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Live Price + Current % */}
                      <div className="mb-3 rounded-xl border border-gray-200 bg-white/50 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Harga Saat Ini</p>
                            <p className="text-lg font-bold text-gray-900">
                              {livePrice
                                ? `${currency}${livePrice < 100 ? livePrice.toFixed(4) : livePrice.toLocaleString('th-TH', {minimumFractionDigits:2,maximumFractionDigits:2})}`
                                : <span className="text-gray-400 text-sm">Memuat...</span>
                              }
                            </p>
                          </div>
                          {currentPct !== null && (
                            <div className={cn(
                              'flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-bold',
                              currentPct >= 5
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : currentPct >= 0
                                ? 'bg-cyan-500/10 text-cyan-400'
                                : 'bg-red-500/10 text-red-400'
                            )}>
                              {currentPct >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4 rotate-90" />}
                              {currentPct >= 0 ? '+' : ''}{currentPct.toFixed(2)}%
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Progress bar toward 5% target */}
                      <div className="mb-4">
                        <div className="mb-1.5 flex items-center justify-between text-[11px]">
                          <span className="text-gray-500">Progress ke Target +5%</span>
                          <span className={cn(
                            'font-semibold',
                            isTargetReached ? 'text-emerald-400' : 'text-gray-600'
                          )}>
                            {isTargetReached
                              ? '🎯 TARGET TERCAPAI!'
                              : remainingPct !== null
                              ? `Kurang ${remainingPct.toFixed(2)}% lagi`
                              : 'Menunggu data...'}
                          </span>
                        </div>
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-100">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPct}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className={cn(
                              'h-2 rounded-full transition-all',
                              isTargetReached
                                ? 'bg-emerald-500'
                                : isProfit
                                ? 'bg-[var(--secondary)]'
                                : 'bg-[var(--primary)]'
                            )}
                          />
                        </div>
                      </div>

                      {/* Stats grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                          <p className="text-[10px] text-gray-500">Harga Masuk</p>
                          <p className="font-semibold text-gray-800">
                            {currency}{target.entry_price < 100
                              ? target.entry_price.toFixed(4)
                              : target.entry_price.toLocaleString('th-TH', {minimumFractionDigits:2,maximumFractionDigits:2})}
                          </p>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                          <p className="text-[10px] text-gray-500">Target Jual (+5%)</p>
                          <p className="font-semibold text-emerald-400">
                            {currency}{target.target_price < 100
                              ? target.target_price.toFixed(4)
                              : target.target_price.toLocaleString('th-TH', {minimumFractionDigits:2,maximumFractionDigits:2})}
                          </p>
                        </div>
                        {target.capital && (
                          <>
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                              <p className="text-[10px] text-gray-500">Modal</p>
                              <p className="font-semibold text-gray-900">
                                {currency}{target.capital.toLocaleString('th-TH', {minimumFractionDigits:0,maximumFractionDigits:0})}
                              </p>
                            </div>
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                              <p className="text-[10px] text-gray-500">Est. Profit</p>
                              <p className={cn(
                                'font-semibold',
                                estProfit && estProfit > 0 ? 'text-emerald-400' : 'text-red-400'
                              )}>
                                {estProfit !== null
                                  ? `${estProfit > 0 ? '+' : ''}${currency}${Math.abs(estProfit).toLocaleString('th-TH', {minimumFractionDigits:0,maximumFractionDigits:0})}`
                                  : '-'
                                }
                              </p>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="mt-3 border-t border-gray-200 flex justify-between items-center pt-2.5">
                        <p className="text-[10px] text-gray-400">
                          Dibuat: {formatDate(target.created_at)}
                        </p>
                        {livePricesTime[liveKey] && (
                          <p className="text-[10px] font-mono text-gray-400">
                            Diperbarui: {livePricesTime[liveKey]}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </section>
        </div> {/* End of Mobile Targets Container */}

        {/* ====== Bottom Grid: Watchlist & News ====== */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Column (40%) */}
          <div className={cn("lg:col-span-2 flex flex-col h-[500px] lg:h-[700px]", mobileTab === 'market' ? "flex" : "hidden lg:flex")}>
            <WatchlistSection
              activeTargets={targets}
              onChartOpen={(sym, type) => setWatchlistChart({ symbol: sym, type })}
            />
          </div>
          {/* Right Column (60%) */}
          <div className={cn("lg:col-span-3 h-[500px] lg:h-[700px]", mobileTab === 'discover' ? "block" : "hidden lg:block")}>
            <NewsSection 
              onTrendClick={(symbol) => setTrendAnalysisSymbol(`${symbol}THB`)}
              onTrendChartClick={(symbol) => setWatchlistChart({ symbol: `${symbol}THB`, type: 'SITE' })}
            />
          </div>
        </div>
      </main>

      {/* ====== Mobile Bottom Navigation ====== */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-gray-200 bg-white/90 pb-safe pt-2 backdrop-blur-xl lg:hidden">
        <button
          onClick={() => setMobileTab('targets')}
          className={cn(
            "flex flex-col items-center justify-center p-2 pb-4 text-[10px] sm:text-xs font-semibold transition-colors flex-1",
            mobileTab === 'targets' ? "text-[var(--primary)]" : "text-gray-400 hover:text-gray-900"
          )}
        >
          <Target className="mb-1 h-6 w-6" />
          <span>Targets</span>
        </button>
        <button
          onClick={() => setMobileTab('market')}
          className={cn(
            "flex flex-col items-center justify-center p-2 pb-4 text-[10px] sm:text-xs font-semibold transition-colors flex-1",
            mobileTab === 'market' ? "text-[var(--primary)]" : "text-gray-400 hover:text-gray-900"
          )}
        >
          <BarChart2 className="mb-1 h-6 w-6" />
          <span>Market</span>
        </button>
        <button
          onClick={() => setMobileTab('discover')}
          className={cn(
            "flex flex-col items-center justify-center p-2 pb-4 text-[10px] sm:text-xs font-semibold transition-colors flex-1",
            mobileTab === 'discover' ? "text-[var(--primary)]" : "text-gray-400 hover:text-gray-900"
          )}
        >
          <Globe className="mb-1 h-6 w-6" />
          <span>Discover</span>
        </button>
      </div>

      {/* ====== Analysis Modal ====== */}
      {analyzingTarget && (
        <AnalysisModal
          symbol={analyzingTarget.symbol}
          entryPrice={analyzingTarget.entry_price}
          isOpen={!!analyzingTarget}
          onClose={() => setAnalyzingTarget(null)}
          dataSource={analyzingTarget.data_source}
          contractAddress={analyzingTarget.contract_address}
          analysisType="scalping"
        />
      )}

      {/* ====== Trend Analysis Modal ====== */}
      {trendAnalysisSymbol && (
        <AnalysisModal
          symbol={trendAnalysisSymbol}
          entryPrice={0}
          isOpen={!!trendAnalysisSymbol}
          onClose={() => setTrendAnalysisSymbol(null)}
          dataSource="BINANCE"
          analysisType="watchlist"
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

      {/* ====== Edit Target Modal ====== */}
      <EditTargetModal
        target={editingTarget}
        isOpen={!!editingTarget}
        onClose={() => setEditingTarget(null)}
        onSubmit={handleEditTarget}
      />

      {/* ====== Telegram Setup Modal ====== */}
      <TelegramSetupModal
        isOpen={showTelegramModal}
        onClose={() => {
          setShowTelegramModal(false);
          setPendingTargetData(null);
        }}
        onSubmit={handleTelegramSubmit}
      />
    </div>
  );
}
