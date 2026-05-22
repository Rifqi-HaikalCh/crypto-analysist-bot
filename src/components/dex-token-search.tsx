"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Loader2,
  Link2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronDown,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DexTokenInfo } from "@/app/api/dexscreener/route";

// ==========================================
// Types
// ==========================================

export type DexTokenResult = {
  tokenInfo: DexTokenInfo;
  priceIdr: number;       // Harga dalam IDR (saat lookup)
  usdtIdrRate: number;    // Kurs saat lookup
};

interface DexTokenSearchProps {
  onTokenSelect: (result: DexTokenResult) => void;
  onClear?: () => void;
}

// ==========================================
// Chain badge color
// ==========================================

const CHAIN_COLORS: Record<string, string> = {
  ethereum: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  bsc: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  solana: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  base: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  arbitrum: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  polygon: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  avalanche: "bg-red-500/10 text-red-400 border-red-500/20",
};

function ChainBadge({ chainId }: { chainId: string }) {
  const className = CHAIN_COLORS[chainId.toLowerCase()] || "bg-slate-700 text-gray-600";
  return (
    <span className={cn("rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase", className)}>
      {chainId}
    </span>
  );
}

function formatPriceUsd(price: number): string {
  if (price < 0.000001) return price.toExponential(4);
  if (price < 0.01) return price.toFixed(8);
  if (price < 1) return price.toFixed(6);
  return price.toFixed(4);
}

function formatIdr(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ==========================================
// Main Component
// ==========================================

export default function DexTokenSearch({
  onTokenSelect,
  onClear,
}: DexTokenSearchProps) {
  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<"address" | "search">("address");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [token, setToken] = useState<DexTokenResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<DexTokenInfo[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [usdtIdrRate, setUsdtIdrRate] = useState<number>(16200); // fallback rate
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch IDR rate on mount
  useEffect(() => {
    fetch("/api/rates")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.usdtIdr) setUsdtIdrRate(d.data.usdtIdr);
      })
      .catch(() => {/* use fallback */});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ==========================================
  // Lookup by contract address
  // ==========================================
  const lookupAddress = useCallback(async (address: string) => {
    if (!address.trim()) return;
    setStatus("loading");
    setError(null);
    setToken(null);

    try {
      const [dexRes, rateRes] = await Promise.all([
        fetch(`/api/dexscreener?address=${encodeURIComponent(address.trim())}`),
        fetch("/api/rates"),
      ]);
      const dexData = await dexRes.json();
      const rateData = await rateRes.json();

      const rate = rateData.success ? rateData.data.usdtIdr : usdtIdrRate;
      setUsdtIdrRate(rate);

      if (!dexData.success) {
        setStatus("error");
        setError(dexData.error || "Token tidak ditemukan.");
        return;
      }

      const tokenInfo: DexTokenInfo = dexData.data;
      const priceIdr = tokenInfo.priceUsd * rate;
      const result: DexTokenResult = { tokenInfo, priceIdr, usdtIdrRate: rate };

      setToken(result);
      setStatus("success");
      onTokenSelect(result);
    } catch {
      setStatus("error");
      setError("Koneksi gagal. Coba lagi.");
    }
  }, [usdtIdrRate, onTokenSelect]);

  // ==========================================
  // Search by name/symbol (debounced)
  // ==========================================
  const searchTokens = useCallback(async (query: string) => {
    if (query.length < 2) { setSearchResults([]); return; }
    try {
      const res = await fetch(`/api/dexscreener?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.data || []);
        setShowResults(true);
      }
    } catch { /* ignore */ }
  }, []);

  const handleSearchInput = (val: string) => {
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchTokens(val), 400);
  };

  const handleSelectSearchResult = async (t: DexTokenInfo) => {
    setShowResults(false);
    setMode("address");
    setInput(t.contractAddress);
    setStatus("loading");
    setError(null);

    try {
      const rateRes = await fetch("/api/rates");
      const rateData = await rateRes.json();
      const rate = rateData.success ? rateData.data.usdtIdr : usdtIdrRate;
      setUsdtIdrRate(rate);

      const priceIdr = t.priceUsd * rate;
      const result: DexTokenResult = { tokenInfo: t, priceIdr, usdtIdrRate: rate };
      setToken(result);
      setStatus("success");
      onTokenSelect(result);
    } catch {
      setStatus("error");
      setError("Koneksi gagal.");
    }
  };

  const handleClear = () => {
    setInput("");
    setSearchQuery("");
    setToken(null);
    setStatus("idle");
    setError(null);
    setSearchResults([]);
    onClear?.();
  };

  // ==========================================
  // Render
  // ==========================================
  return (
    <div ref={containerRef} className="space-y-3">
      {/* Mode toggle */}
      <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
        <button
          type="button"
          onClick={() => setMode("address")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all",
            mode === "address"
              ? "bg-violet-500/20 text-violet-300 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Link2 className="h-3.5 w-3.5" />
          Contract Address
        </button>
        <button
          type="button"
          onClick={() => setMode("search")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all",
            mode === "search"
              ? "bg-violet-500/20 text-violet-300 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Search className="h-3.5 w-3.5" />
          Cari Nama/Symbol
        </button>
      </div>

      {/* Address input */}
      {mode === "address" && (
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookupAddress(input)}
            placeholder="0x... (paste contract address)"
            className="w-full rounded-xl border border-violet-500/30 bg-gray-100/60 px-4 py-3 pr-28 text-sm text-gray-900 placeholder:text-gray-500 focus:border-violet-500/60 focus:outline-none focus:ring-2 focus:ring-violet-500/20 font-mono"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            {status === "loading" && (
              <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
            )}
            <button
              type="button"
              onClick={() => lookupAddress(input)}
              disabled={!input.trim() || status === "loading"}
              className="rounded-lg bg-violet-500/20 px-3 py-1.5 text-xs font-semibold text-violet-300 transition-all hover:bg-violet-500/30 disabled:opacity-40"
            >
              Cari
            </button>
          </div>
        </div>
      )}

      {/* Search input */}
      {mode === "search" && (
        <div className="relative" ref={containerRef}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            placeholder="Ketik nama token... (ZEREBRO, PEPE, WIF)"
            className="w-full rounded-xl border border-violet-500/30 bg-gray-100/60 py-3 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-500 focus:border-violet-500/60 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />

          {/* Search dropdown */}
          <AnimatePresence>
            {showResults && searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-300 bg-white shadow-2xl"
              >
                <div className="border-b border-gray-200 px-4 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                    {searchResults.length} token ditemukan
                  </p>
                </div>
                {searchResults.map((t, idx) => (
                  <button
                    key={`${t.contractAddress}-${idx}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectSearchResult(t)}
                    className="flex w-full items-center justify-between px-4 py-2.5 transition-colors hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-pink-500/20 text-[10px] font-black text-violet-300">
                        {t.symbol.slice(0, 3)}
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-gray-900">{t.symbol}</p>
                          <ChainBadge chainId={t.chainId} />
                        </div>
                        <p className="text-[11px] text-gray-500 truncate max-w-[200px]">{t.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-gray-900">${formatPriceUsd(t.priceUsd)}</p>
                      <p className={cn("text-[10px] font-medium", t.priceChange.h24 >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {t.priceChange.h24 >= 0 ? "+" : ""}{t.priceChange.h24.toFixed(2)}%
                      </p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Error */}
      <AnimatePresence>
        {status === "error" && error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
          >
            <XCircle className="h-4 w-4 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Token result card */}
      <AnimatePresence>
        {status === "success" && token && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-pink-500/5 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 text-sm font-black text-violet-300">
                  {token.tokenInfo.symbol.slice(0, 3)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-gray-900">{token.tokenInfo.name}</p>
                    <span className="text-gray-600">·</span>
                    <span className="text-sm text-violet-300 font-semibold">{token.tokenInfo.symbol}</span>
                    <ChainBadge chainId={token.tokenInfo.chainId} />
                  </div>
                  <p className="text-xs text-gray-500 font-mono truncate max-w-[260px]">
                    {token.tokenInfo.contractAddress.slice(0, 18)}...{token.tokenInfo.contractAddress.slice(-6)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={token.tokenInfo.pairUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-300 text-gray-500 transition-colors hover:text-violet-400"
                  title="Buka di DexScreener"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-300 text-gray-500 transition-colors hover:text-red-400"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-white px-3 py-2">
                <p className="text-[10px] text-gray-500">Harga USD</p>
                <p className="text-sm font-bold text-gray-900">${formatPriceUsd(token.tokenInfo.priceUsd)}</p>
              </div>
              <div className="rounded-lg bg-white px-3 py-2">
                <p className="text-[10px] text-gray-500">Harga IDR</p>
                <p className="text-sm font-bold text-violet-300">{formatIdr(token.priceIdr)}</p>
              </div>
              <div className="rounded-lg bg-white px-3 py-2">
                <p className="text-[10px] text-gray-500">24H Change</p>
                <p className={cn("text-sm font-bold", token.tokenInfo.priceChange.h24 >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {token.tokenInfo.priceChange.h24 >= 0 ? "+" : ""}{token.tokenInfo.priceChange.h24.toFixed(2)}%
                </p>
              </div>
              <div className="rounded-lg bg-white px-3 py-2">
                <p className="text-[10px] text-gray-500">Liquidity</p>
                <p className="text-xs font-semibold text-gray-800">
                  ${(token.tokenInfo.liquidityUsd / 1000).toFixed(1)}K
                </p>
              </div>
              <div className="rounded-lg bg-white px-3 py-2">
                <p className="text-[10px] text-gray-500">Vol 24H</p>
                <p className="text-xs font-semibold text-gray-800">
                  ${(token.tokenInfo.volume24h / 1000).toFixed(1)}K
                </p>
              </div>
              <div className="rounded-lg bg-white px-3 py-2">
                <p className="text-[10px] text-gray-500">Kurs IDR</p>
                <p className="text-xs font-semibold text-gray-800">
                  Rp{usdtIdrRate.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Token ditemukan! Data harga IDR akan otomatis diisi.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rate info */}
      {status === "idle" && (
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs text-gray-500">
          <Flame className="h-3.5 w-3.5 text-violet-400 shrink-0" />
          <span>
            Kurs saat ini: <span className="text-gray-700">1 USDT ≈ Rp{usdtIdrRate.toLocaleString("id-ID")}</span>
            {" · "}Harga IDR = Harga USD × Kurs USDT/IDR (Binance)
          </span>
        </div>
      )}
    </div>
  );
}
