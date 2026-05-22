"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Loader2,
  ChevronDown,
  X,
  Zap,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BinanceSymbol } from "@/app/api/symbols/route";
import type { DexTokenInfo } from "@/app/api/dexscreener/route";

// ==========================================
// Unified search result
// ==========================================

export type UnifiedResult = {
  source: "BINANCE" | "DEXSCREENER";
  // Binance fields
  binanceSymbol?: string;
  binanceBase?: string;
  binanceQuote?: string;
  binanceType?: string;
  // DEX fields
  dexToken?: DexTokenInfo;
  // Common display
  displayName: string;
  displaySymbol: string;
  priceUsd?: number;
  priceChange24h?: number;
};

interface UnifiedTokenSearchProps {
  onSelect: (result: UnifiedResult, idrRate: number) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
}

// ==========================================
// Chain badge color
// ==========================================
const CHAIN_COLORS: Record<string, string> = {
  ethereum: "bg-blue-500/10 text-blue-400",
  bsc: "bg-yellow-500/10 text-yellow-400",
  solana: "bg-purple-500/10 text-purple-400",
  base: "bg-sky-500/10 text-sky-400",
  arbitrum: "bg-cyan-500/10 text-cyan-400",
};

function formatPriceUsd(price: number): string {
  if (price < 0.000001) return price.toExponential(3);
  if (price < 0.01) return price.toFixed(7);
  if (price < 1) return price.toFixed(5);
  return price.toFixed(3);
}

// ==========================================
// Main Component
// ==========================================

export default function UnifiedTokenSearch({
  onSelect,
  onClear,
  placeholder = "Cari koin atau paste contract address...",
  className,
}: UnifiedTokenSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UnifiedResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState<UnifiedResult | null>(null);
  const [idrRate, setIdrRate] = useState<number>(16350);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [binanceSymbols, setBinanceSymbols] = useState<BinanceSymbol[]>([]);
  const [hasFetchedBinance, setHasFetchedBinance] = useState(false);

  // Fetch IDR rate once
  useEffect(() => {
    fetch("/api/rates")
      .then((r) => r.json())
      .then((d) => { if (d.success && d.data?.usdtIdr) setIdrRate(d.data.usdtIdr); })
      .catch(() => {});
  }, []);

  // Fetch Binance symbols once on first focus
  const fetchBinance = useCallback(async () => {
    if (hasFetchedBinance) return;
    try {
      const res = await fetch("/api/symbols");
      const data = await res.json();
      if (data.success) {
        setBinanceSymbols(data.data);
        setHasFetchedBinance(true);
      }
    } catch { /* ignore */ }
  }, [hasFetchedBinance]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ==========================================
  // Search logic
  // ==========================================
  const isContractAddress = (q: string) =>
    /^0x[a-fA-F0-9]{30,}$/.test(q) || // EVM
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q); // Solana

  const searchAll = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      // Show popular Binance when empty
      const popular = binanceSymbols.slice(0, 6).map((s): UnifiedResult => ({
        source: "BINANCE",
        binanceSymbol: s.symbol,
        binanceBase: s.baseAsset,
        binanceQuote: s.quoteAsset,
        binanceType: s.type,
        displayName: s.baseAsset,
        displaySymbol: s.symbol,
      }));
      setResults(popular);
      return;
    }

    setIsLoading(true);
    const foundResults: UnifiedResult[] = [];

    // If it looks like a contract address → only DEX
    if (isContractAddress(trimmed)) {
      try {
        const res = await fetch(`/api/dexscreener?address=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (data.success && data.data) {
          const t: DexTokenInfo = data.data;
          foundResults.push({
            source: "DEXSCREENER",
            dexToken: t,
            displayName: t.name,
            displaySymbol: t.symbol,
            priceUsd: t.priceUsd,
            priceChange24h: t.priceChange.h24,
          });
        }
      } catch { /* ignore */ }
    } else {
      // Search Binance locally
      const qUpper = trimmed.toUpperCase();
      const binanceHits = binanceSymbols
        .filter((s) =>
          s.symbol.includes(qUpper) ||
          s.baseAsset.includes(qUpper) ||
          s.quoteAsset.includes(qUpper)
        )
        .slice(0, 5)
        .map((s): UnifiedResult => ({
          source: "BINANCE",
          binanceSymbol: s.symbol,
          binanceBase: s.baseAsset,
          binanceQuote: s.quoteAsset,
          binanceType: s.type,
          displayName: s.baseAsset,
          displaySymbol: s.symbol,
        }));
      foundResults.push(...binanceHits);

      // Search DexScreener concurrently
      try {
        const res = await fetch(`/api/dexscreener?search=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (data.success && data.data) {
          const dexHits = (data.data as DexTokenInfo[]).slice(0, 4).map((t): UnifiedResult => ({
            source: "DEXSCREENER",
            dexToken: t,
            displayName: t.name,
            displaySymbol: t.symbol,
            priceUsd: t.priceUsd,
            priceChange24h: t.priceChange.h24,
          }));
          foundResults.push(...dexHits);
        }
      } catch { /* ignore */ }
    }

    setResults(foundResults);
    setIsOpen(true);
    setIsLoading(false);
  }, [binanceSymbols]);

  const handleInput = (val: string) => {
    setQuery(val);
    setSelected(null);
    onClear?.();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAll(val), 350);
  };

  const handleSelect = (result: UnifiedResult) => {
    const label = result.source === "BINANCE"
      ? result.binanceSymbol!
      : `${result.displayName} (${result.displaySymbol})`;
    setQuery(label);
    setSelected(result);
    setIsOpen(false);
    onSelect(result, idrRate);
  };

  const handleClear = () => {
    setQuery("");
    setSelected(null);
    setResults([]);
    onClear?.();
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    fetchBinance();
    if (results.length === 0 && !query) searchAll("");
    if (results.length > 0) setIsOpen(true);
  };

  // ==========================================
  // Render
  // ==========================================
  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-gray-300 bg-gray-100/60 py-3 pl-10 pr-9 text-sm text-gray-900 placeholder:text-gray-500 transition-all focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
          ) : query ? (
            <button type="button" onClick={handleClear} className="text-gray-500 hover:text-gray-700">
              <X className="h-4 w-4" />
            </button>
          ) : (
            <ChevronDown className={cn("h-4 w-4 text-gray-500 transition-transform", isOpen && "rotate-180")} />
          )}
        </div>
      </div>

      {/* Selected badge */}
      {selected && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs">
          {selected.source === "DEXSCREENER" ? (
            <>
              <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-violet-400 font-semibold">
                DEX · {selected.dexToken?.chainId}
              </span>
              {selected.dexToken && (
                <a href={selected.dexToken.pairUrl} target="_blank" rel="noopener noreferrer"
                  className="text-gray-500 hover:text-violet-400 transition-colors">
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </>
          ) : (
            <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-cyan-400 font-semibold">
              <Zap className="inline h-2.5 w-2.5 mr-0.5" />
              Binance.th · {selected.binanceType}
            </span>
          )}
          {selected.priceUsd !== undefined && (
            <span className="text-gray-500">
              ${formatPriceUsd(selected.priceUsd)}
              {" "}≈{" "}
              <span className="text-gray-700">
                Rp{Math.round(selected.priceUsd * idrRate).toLocaleString("id-ID")}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-gray-300 bg-white shadow-2xl shadow-black/60"
          >
            {/* Binance group */}
            {results.some((r) => r.source === "BINANCE") && (
              <>
                <div className="border-b border-gray-200 px-4 py-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500/70">
                    ⚡ Binance.th
                  </p>
                </div>
                {results.filter((r) => r.source === "BINANCE").map((r, i) => (
                  <button
                    key={`binance-${i}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(r)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 text-[10px] font-black text-cyan-400">
                        {(r.binanceBase || "").slice(0, 3)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{r.binanceSymbol}</p>
                        <p className="text-[11px] text-gray-500">{r.binanceBase} / {r.binanceQuote}</p>
                      </div>
                    </div>
                    <span className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                      r.binanceType === "GLOBAL" ? "bg-cyan-500/10 text-cyan-500" : "bg-emerald-500/10 text-emerald-500"
                    )}>
                      {r.binanceType}
                    </span>
                  </button>
                ))}
              </>
            )}

            {/* DEX group */}
            {results.some((r) => r.source === "DEXSCREENER") && (
              <>
                <div className="border-b border-gray-200 border-t px-4 py-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500/70">
                    🔍 DexScreener (IDR)
                  </p>
                </div>
                {results.filter((r) => r.source === "DEXSCREENER").map((r, i) => (
                  <button
                    key={`dex-${i}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(r)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-pink-500/20 text-[10px] font-black text-violet-300">
                        {r.displaySymbol.slice(0, 3)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-900">{r.displaySymbol}</p>
                          {r.dexToken?.chainId && (
                            <span className={cn(
                              "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                              CHAIN_COLORS[r.dexToken.chainId.toLowerCase()] || "bg-slate-700 text-gray-600"
                            )}>
                              {r.dexToken.chainId}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 truncate max-w-[160px]">{r.displayName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {r.priceUsd !== undefined && (
                        <>
                          <p className="text-xs font-semibold text-gray-900">${formatPriceUsd(r.priceUsd)}</p>
                          <p className={cn(
                            "text-[10px] font-medium",
                            (r.priceChange24h || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                          )}>
                            {(r.priceChange24h || 0) >= 0 ? "+" : ""}{(r.priceChange24h || 0).toFixed(2)}%
                          </p>
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
