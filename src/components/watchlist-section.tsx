"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  BarChart2,
  LineChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScalpingTarget } from "@/lib/supabase";

// ==========================================
// Types & Config
// ==========================================

type WatchlistItem = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  type: "GLOBAL" | "SITE";
};

// THB pairs (always show these first since user trades in THB)
const THB_SYMBOLS = [
  "BTCTHB", "ETHTHB", "BNBTHB", "SOLTHB",
  "XRPTHB", "ATHTHB", "VELOTHB", "ZENTTHB",
  "ASTERTHB", "PLUMETHB",
];

// Popular USDT pairs to rotate in
const USDT_POOL = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
  "AVAXUSDT", "ADAUSDT", "LINKUSDT", "DOTUSDT", "MATICUSDT",
  "ARBUSDT", "OPUSDT", "UNIUSDT", "AAVEUSDT", "APTUSDT",
  "INJUSDT", "SUIUSDT", "TIAUSDT", "NEARUSDT", "FETUSDT",
  "RENDERUSDT", "WLDUSDT", "LDOUSDT", "RUNEUSDT", "SEIUSDT",
  "JUPUSDT", "EIGENUSDT", "ENAUSDT", "ZETAUSDT", "VANAUSDT",
];

const BINANCE_API_URL = "https://api.binance.th";
const BINANCE_WSS_GLOBAL = "wss://www.binance.th/gstream";
const BINANCE_WSS_SITE = "wss://www.binance.th/nstream";
const CARDS_DISPLAYED = 8;
const ROTATE_INTERVAL = 12000; // 12 seconds

// ==========================================
// Helpers
// ==========================================

function formatPrice(price: number, quote: string): string {
  if (quote === "THB") {
    return new Intl.NumberFormat("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  }
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price < 1000) return price.toFixed(2);
  return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toFixed(0);
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

// ==========================================
// Mini Sparkline (CSS-based)
// ==========================================

function MiniSparkline({ positive }: { positive: boolean }) {
  // Random-ish path that goes generally up or down
  const paths = positive
    ? [
        "M0,20 L10,18 L20,15 L30,16 L40,12 L50,10 L60,8",
        "M0,20 L10,19 L20,17 L30,14 L40,13 L50,9 L60,6",
        "M0,18 L10,17 L20,19 L30,15 L40,11 L50,8 L60,5",
      ]
    : [
        "M0,8 L10,10 L20,11 L30,13 L40,15 L50,17 L60,20",
        "M0,6 L10,9 L20,10 L30,12 L40,14 L50,18 L60,20",
        "M0,8 L10,7 L20,11 L30,13 L40,16 L50,17 L60,20",
      ];

  const path = paths[Math.floor(Math.random() * paths.length)];

  return (
    <svg
      viewBox="0 0 60 24"
      className="h-8 w-16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={path}
        stroke={positive ? "#10b981" : "#ef4444"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ==========================================
// Single Watchlist Card
// ==========================================

function WatchlistCard({
  item,
  onChartClick,
}: {
  item: WatchlistItem;
  onChartClick: (item: WatchlistItem) => void;
}) {
  const isPositive = item.change24h >= 0;
  const currency = item.quoteAsset === "THB" ? "฿" : "$";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35 }}
      className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-all hover:border-slate-600 hover:bg-slate-800/60"
    >
      {/* Background glow based on trend */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100",
          isPositive
            ? "bg-gradient-to-br from-emerald-500/5 to-transparent"
            : "bg-gradient-to-br from-red-500/5 to-transparent"
        )}
      />

      <div className="relative flex items-start justify-between">
        {/* Left: coin info */}
        <div className="flex items-center gap-3">
          {/* Coin avatar */}
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-800 text-xs font-bold text-white shadow-inner">
            {item.baseAsset.slice(0, 3)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white">
                {item.baseAsset}
              </span>
              <span
                className={cn(
                  "rounded px-1 py-0.5 text-[9px] font-medium uppercase",
                  item.type === "SITE"
                    ? "bg-amber-500/10 text-amber-500"
                    : "bg-slate-700 text-slate-400"
                )}
              >
                {item.quoteAsset}
              </span>
            </div>
            <span className="text-[11px] text-slate-500">{item.symbol}</span>
          </div>
        </div>

        {/* Right: sparkline */}
        <div className="opacity-70">
          <MiniSparkline positive={isPositive} />
        </div>
      </div>

      {/* Price row */}
      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-lg font-bold text-white">
            {currency}
            {formatPrice(item.price, item.quoteAsset)}
          </p>
          <p className="text-[11px] text-slate-500">
            Vol: {currency}{formatVolume(item.volume24h)}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          {/* 24h Change */}
          <div
            className={cn(
              "flex items-center gap-0.5 rounded-md px-2 py-0.5 text-xs font-bold",
              isPositive
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {isPositive ? "+" : ""}
            {item.change24h.toFixed(2)}%
          </div>

          {/* Chart button */}
          <button
            onClick={() => onChartClick(item)}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-slate-600 transition-colors hover:text-cyan-400"
          >
            <LineChart className="h-3 w-3" />
            Chart
          </button>
        </div>
      </div>

      {/* H/L bar */}
      {item.high24h > 0 && item.low24h > 0 && item.price > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] text-slate-600">
            <span>L: {currency}{formatPrice(item.low24h, item.quoteAsset)}</span>
            <span>H: {currency}{formatPrice(item.high24h, item.quoteAsset)}</span>
          </div>
          <div className="h-1 w-full rounded-full bg-slate-800">
            <div
              className="h-1 rounded-full bg-gradient-to-r from-red-500 to-emerald-500"
              style={{
                width: `${Math.max(5, Math.min(95, ((item.price - item.low24h) / (item.high24h - item.low24h)) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ==========================================
// Main Watchlist Component
// ==========================================

interface WatchlistSectionProps {
  onChartOpen: (symbol: string, symbolType: "GLOBAL" | "SITE") => void;
  activeTargets?: ScalpingTarget[];
}

export default function WatchlistSection({
  onChartOpen,
  activeTargets = [],
}: WatchlistSectionProps) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [displayedSymbols, setDisplayedSymbols] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const allDataRef = useRef<Map<string, WatchlistItem>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const wsGlobalRef = useRef<WebSocket | null>(null);
  const rotateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Build initial symbol pool (active targets + defaults)
  const buildSymbolPool = useCallback(() => {
    // Prioritize user's active target symbols
    const targetSymbols = activeTargets.map((t) => t.symbol);
    const usdtTargets = targetSymbols.filter((s) => s.endsWith("USDT") || s.endsWith("USDC"));
    const thbTargets = targetSymbols.filter((s) => s.endsWith("THB"));

    // Combine: THB (site), user targets, then random USDT pool
    const uniqueUsdt = [...new Set([...usdtTargets, ...shuffle(USDT_POOL)])];
    const allSymbols = [
      ...THB_SYMBOLS,
      ...uniqueUsdt.slice(0, 20),
    ];

    return [...new Set(allSymbols)];
  }, [activeTargets]);

  // Fetch 24hr stats for a symbol
  const fetch24hr = useCallback(async (symbol: string): Promise<WatchlistItem | null> => {
    try {
      const res = await fetch(`${BINANCE_API_URL}/api/v1/ticker/24hr?symbol=${symbol}`);
      if (!res.ok) return null;
      const d = await res.json();

      const baseAsset = symbol.replace(/USDT$|USDC$|THB$|BTC$/, "");
      const quoteAsset = symbol.endsWith("THB")
        ? "THB"
        : symbol.endsWith("BTC")
        ? "BTC"
        : symbol.endsWith("USDC")
        ? "USDC"
        : "USDT";

      const type = THB_SYMBOLS.includes(symbol) ? "SITE" : "GLOBAL";

      return {
        symbol,
        baseAsset,
        quoteAsset,
        price: parseFloat(d.lastPrice || d.closePrice || "0"),
        change24h: parseFloat(d.priceChangePercent || "0"),
        volume24h: parseFloat(d.volume || "0") * parseFloat(d.lastPrice || "1"),
        high24h: parseFloat(d.highPrice || "0"),
        low24h: parseFloat(d.lowPrice || "0"),
        type,
      };
    } catch {
      return null;
    }
  }, []);

  // Load data for a set of symbols
  const loadSymbols = useCallback(async (symbols: string[]) => {
    setIsLoading(true);
    const results = await Promise.all(
      symbols.slice(0, CARDS_DISPLAYED).map(fetch24hr)
    );
    const valid = results.filter((r): r is WatchlistItem => r !== null);
    valid.forEach((item) => allDataRef.current.set(item.symbol, item));
    setItems(valid);
    setDisplayedSymbols(valid.map((v) => v.symbol));
    setIsLoading(false);
  }, [fetch24hr]);

  // Rotate: replace one random card with a new symbol
  const rotateOne = useCallback(async () => {
    const allSymbols = buildSymbolPool();
    const current = displayedSymbols;
    const available = allSymbols.filter((s) => !current.includes(s));

    if (available.length === 0) return;

    const newSymbol = available[Math.floor(Math.random() * available.length)];
    const replaceIdx = Math.floor(Math.random() * current.length);
    const oldSymbol = current[replaceIdx];

    // Skip THB replacements (always keep THBs if displayed)
    if (THB_SYMBOLS.includes(oldSymbol)) return;

    // Fetch new data if not cached
    if (!allDataRef.current.has(newSymbol)) {
      const fetched = await fetch24hr(newSymbol);
      if (!fetched) return;
      allDataRef.current.set(newSymbol, fetched);
    }

    const newItem = allDataRef.current.get(newSymbol)!;
    setDisplayedSymbols((prev) => {
      const updated = [...prev];
      updated[replaceIdx] = newSymbol;
      return updated;
    });
    setItems((prev) => {
      const updated = [...prev];
      updated[replaceIdx] = newItem;
      return updated;
    });
  }, [buildSymbolPool, displayedSymbols, fetch24hr]);

  // Connect WebSocket for live price updates
  const connectWS = useCallback((symbols: string[], wssBase: string, ref: React.MutableRefObject<WebSocket | null>) => {
    if (ref.current) {
      ref.current.onclose = null;
      ref.current.close();
    }
    if (symbols.length === 0) return;

    const streams = symbols.map((s) => `${s.toLowerCase()}@miniTicker`).join("/");
    const ws = new WebSocket(`${wssBase}?streams=${streams}`);
    ref.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const d = msg?.data;
        if (!d?.s || !d?.c) return;

        const symbol = d.s.toUpperCase();
        const existing = allDataRef.current.get(symbol);
        if (!existing) return;

        const updated = { ...existing, price: parseFloat(d.c) };
        allDataRef.current.set(symbol, updated);

        setItems((prev) =>
          prev.map((item) => (item.symbol === symbol ? updated : item))
        );
      } catch { /* ignore */ }
    };
  }, []);

  // Initial load
  useEffect(() => {
    const pool = buildSymbolPool();
    loadSymbols(pool);
  }, []); // eslint-disable-line

  // Setup WebSocket after items loaded
  useEffect(() => {
    if (displayedSymbols.length === 0) return;

    const globalSyms = displayedSymbols.filter((s) => !THB_SYMBOLS.includes(s));
    const siteSyms = displayedSymbols.filter((s) => THB_SYMBOLS.includes(s));

    connectWS(globalSyms, BINANCE_WSS_GLOBAL, wsGlobalRef);
    connectWS(siteSyms, BINANCE_WSS_SITE, wsRef);

    return () => {
      wsGlobalRef.current?.close();
      wsRef.current?.close();
    };
  }, [displayedSymbols, connectWS]);

  // Rotation timer
  useEffect(() => {
    if (isLoading) return;
    rotateTimerRef.current = setInterval(rotateOne, ROTATE_INTERVAL);
    return () => {
      if (rotateTimerRef.current) clearInterval(rotateTimerRef.current);
    };
  }, [isLoading, rotateOne]);

  const handleChartClick = (item: WatchlistItem) => {
    onChartOpen(item.symbol, item.type);
  };

  return (
    <section className="mt-8">
      {/* Section Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-cyan-400" />
          <h2 className="text-base font-bold text-white">
            Market Watchlist
          </h2>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
            Live · Rotasi otomatis
          </span>
        </div>

        <button
          onClick={() => {
            const pool = buildSymbolPool();
            loadSymbols(shuffle(pool));
          }}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Acak
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: CARDS_DISPLAYED }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-slate-800 bg-slate-900/40"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {items.map((item) => (
              <WatchlistCard
                key={item.symbol}
                item={item}
                onChartClick={handleChartClick}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Info note */}
      <p className="mt-3 text-center text-[11px] text-slate-600">
        Data dari Binance.th · THB pairs = pasangan lokal Thailand ·{" "}
        <span className="text-amber-500/70">
          Koin dari Pluang (IDR) mungkin tidak tersedia di Binance.th
        </span>
      </p>
    </section>
  );
}
