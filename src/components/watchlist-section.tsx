"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  BarChart2,
  LineChart,
  Brain,
  ChevronDown,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScalpingTarget } from "@/lib/supabase";
import type { AnalysisResult } from "@/app/api/analyze/route";

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

type CardAnalysis = {
  status: "idle" | "loading" | "done" | "error";
  result: AnalysisResult | null;
  error: string | null;
};

const THB_SYMBOLS = [
  "BTCTHB", "ETHTHB", "BNBTHB", "SOLTHB",
  "XRPTHB", "ATHTHB", "VELOTHB", "ZENTTHB",
  "ASTERTHB", "PLUMETHB",
];

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
const ROTATE_INTERVAL = 12000;

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
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(1)}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toFixed(0);
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

// ==========================================
// Mini Sparkline
// ==========================================

function MiniSparkline({ positive }: { positive: boolean }) {
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
    <svg viewBox="0 0 60 24" className="h-8 w-16" fill="none">
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
// AI Analysis Panel (inside card)
// ==========================================

function AnalysisPanel({ analysis }: { analysis: CardAnalysis }) {
  if (analysis.status === "idle") return null;

  if (analysis.status === "loading") {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5">
        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-700 border-t-violet-500" />
        <span className="text-xs text-slate-400">Gemini AI menganalisis...</span>
      </div>
    );
  }

  if (analysis.status === "error") {
    return (
      <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
        {analysis.error}
      </div>
    );
  }

  if (analysis.status === "done" && analysis.result) {
    const r = analysis.result;
    const isBuy = r.keputusan === "BELI";
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 space-y-2"
      >
        {/* Decision */}
        <div
          className={cn(
            "flex items-center justify-between rounded-lg border px-3 py-2",
            isBuy
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-red-500/30 bg-red-500/10"
          )}
        >
          <div className="flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-[11px] font-medium text-slate-400">
              Rekomendasi AI
            </span>
          </div>
          <span
            className={cn(
              "text-sm font-black tracking-tight",
              isBuy ? "text-emerald-400" : "text-red-400"
            )}
          >
            {r.keputusan}
          </span>
        </div>

        {/* Alasan */}
        <p className="text-[11px] leading-relaxed text-slate-400">{r.alasan}</p>

        {/* Indicators row */}
        <div className="grid grid-cols-2 gap-1">
          {[
            { label: "Trend", value: r.indikator.trend },
            { label: "Momentum", value: r.indikator.momentum },
          ].map(({ label, value }) => {
            const isGood = /bullish|kuat|tinggi/i.test(value);
            const isBad = /bearish|lemah|rendah/i.test(value);
            return (
              <div
                key={label}
                className="rounded border border-slate-800 bg-slate-950/40 px-2 py-1"
              >
                <p className="text-[9px] font-medium uppercase tracking-wider text-slate-600">
                  {label}
                </p>
                <p
                  className={cn(
                    "text-[11px] font-semibold",
                    isGood && "text-emerald-400",
                    isBad && "text-red-400",
                    !isGood && !isBad && "text-slate-300"
                  )}
                >
                  {value}
                </p>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-slate-600">
          TF: {r.timeframes_analyzed.join(", ").toUpperCase()}
        </p>
      </motion.div>
    );
  }

  return null;
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [analysis, setAnalysis] = useState<CardAnalysis>({
    status: "idle",
    result: null,
    error: null,
  });

  const runAnalysis = async () => {
    if (analysis.status === "loading") return;
    setAnalysis({ status: "loading", result: null, error: null });
    if (!isExpanded) setIsExpanded(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: item.symbol }),
      });
      const data = await res.json();
      if (data.success) {
        setAnalysis({ status: "done", result: data.data, error: null });
      } else {
        setAnalysis({
          status: "error",
          result: null,
          error: data.error || "Analisis gagal",
        });
      }
    } catch {
      setAnalysis({
        status: "error",
        result: null,
        error: "Koneksi ke AI gagal",
      });
    }
  };

  // Price change indicator
  const pricePos = item.high24h > item.low24h
    ? Math.max(5, Math.min(95, ((item.price - item.low24h) / (item.high24h - item.low24h)) * 100))
    : 50;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 transition-all hover:border-slate-600"
    >
      {/* Trend glow */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100",
          isPositive
            ? "bg-gradient-to-br from-emerald-500/5 to-transparent"
            : "bg-gradient-to-br from-red-500/5 to-transparent"
        )}
      />

      {/* Main card content */}
      <div className="relative p-4">
        {/* Top row: coin + sparkline */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
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
          <div className="opacity-70">
            <MiniSparkline positive={isPositive} />
          </div>
        </div>

        {/* Price row */}
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-xl font-bold text-white">
              {currency}{formatPrice(item.price, item.quoteAsset)}
            </p>
          </div>
          <div
            className={cn(
              "flex items-center gap-0.5 rounded-md px-2 py-1 text-sm font-bold",
              isPositive
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            )}
          >
            {isPositive ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {isPositive ? "+" : ""}
            {item.change24h.toFixed(2)}%
          </div>
        </div>

        {/* H/L bar */}
        {item.high24h > 0 && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[10px] text-slate-600">
              <span>L: {currency}{formatPrice(item.low24h, item.quoteAsset)}</span>
              <span>H: {currency}{formatPrice(item.high24h, item.quoteAsset)}</span>
            </div>
            <div className="relative h-1 w-full rounded-full bg-slate-800">
              <div
                className="h-1 rounded-full bg-gradient-to-r from-red-500 to-emerald-500"
                style={{ width: `${pricePos}%` }}
              />
              {/* Current price indicator */}
              <div
                className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded-full bg-white"
                style={{ left: `${pricePos}%` }}
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-3 flex items-center gap-1.5 border-t border-slate-800 pt-3">
          {/* Expand/Detail */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-[11px] font-medium transition-all",
              isExpanded
                ? "border-slate-600 bg-slate-800 text-white"
                : "border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300"
            )}
          >
            <Activity className="h-3.5 w-3.5" />
            Detail
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                isExpanded && "rotate-180"
              )}
            />
          </button>

          {/* Chart */}
          <button
            onClick={() => onChartClick(item)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-800 py-2 text-[11px] font-medium text-slate-500 transition-all hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-400"
          >
            <LineChart className="h-3.5 w-3.5" />
            Grafik
          </button>

          {/* AI Analysis */}
          <button
            onClick={runAnalysis}
            disabled={analysis.status === "loading"}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-[11px] font-medium transition-all disabled:opacity-60",
              analysis.status === "done"
                ? analysis.result?.keputusan === "BELI"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-red-500/30 bg-red-500/10 text-red-400"
                : "border-slate-800 text-slate-500 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-400"
            )}
          >
            {analysis.status === "loading" ? (
              <div className="h-3 w-3 animate-spin rounded-full border border-slate-700 border-t-violet-400" />
            ) : (
              <Brain className="h-3.5 w-3.5" />
            )}
            {analysis.status === "done"
              ? analysis.result?.keputusan || "AI"
              : "Analisis"}
          </button>
        </div>

        {/* Expanded detail panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="mt-3 border-t border-slate-800 pt-3">
                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <p className="text-[10px] text-slate-500">Volume 24H</p>
                    <p className="font-semibold text-white">
                      {currency}{formatVolume(item.volume24h)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <p className="text-[10px] text-slate-500">High 24H</p>
                    <p className="font-semibold text-emerald-400">
                      {currency}{formatPrice(item.high24h, item.quoteAsset)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <p className="text-[10px] text-slate-500">Low 24H</p>
                    <p className="font-semibold text-red-400">
                      {currency}{formatPrice(item.low24h, item.quoteAsset)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <p className="text-[10px] text-slate-500">Tipe Market</p>
                    <p
                      className={cn(
                        "font-semibold",
                        item.type === "SITE"
                          ? "text-amber-400"
                          : "text-cyan-400"
                      )}
                    >
                      {item.type}
                    </p>
                  </div>
                </div>

                {/* AI Analysis panel */}
                <AnalysisPanel analysis={analysis} />

                {/* Run analysis button if not done yet */}
                {analysis.status === "idle" && (
                  <button
                    onClick={runAnalysis}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-500/20 to-cyan-500/20 border border-violet-500/20 py-2.5 text-xs font-medium text-violet-300 transition-all hover:from-violet-500/30 hover:to-cyan-500/30"
                  >
                    <Brain className="h-4 w-4" />
                    Jalankan Analisis AI — BELI atau JANGAN BELI?
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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

  const buildSymbolPool = useCallback(() => {
    const targetSymbols = activeTargets.map((t) => t.symbol);
    const usdtTargets = targetSymbols.filter(
      (s) => s.endsWith("USDT") || s.endsWith("USDC")
    );
    const uniqueUsdt = [...new Set([...usdtTargets, ...shuffle(USDT_POOL)])];
    return [...new Set([...THB_SYMBOLS, ...uniqueUsdt.slice(0, 20)])];
  }, [activeTargets]);

  const fetch24hr = useCallback(
    async (symbol: string): Promise<WatchlistItem | null> => {
      try {
        const res = await fetch(
          `${BINANCE_API_URL}/api/v1/ticker/24hr?symbol=${symbol}`
        );
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
        return {
          symbol,
          baseAsset,
          quoteAsset,
          price: parseFloat(d.lastPrice || d.closePrice || "0"),
          change24h: parseFloat(d.priceChangePercent || "0"),
          volume24h:
            parseFloat(d.volume || "0") * parseFloat(d.lastPrice || "1"),
          high24h: parseFloat(d.highPrice || "0"),
          low24h: parseFloat(d.lowPrice || "0"),
          type: THB_SYMBOLS.includes(symbol) ? "SITE" : "GLOBAL",
        };
      } catch {
        return null;
      }
    },
    []
  );

  const loadSymbols = useCallback(
    async (symbols: string[]) => {
      setIsLoading(true);
      const results = await Promise.all(
        symbols.slice(0, CARDS_DISPLAYED).map(fetch24hr)
      );
      const valid = results.filter((r): r is WatchlistItem => r !== null);
      valid.forEach((item) => allDataRef.current.set(item.symbol, item));
      setItems(valid);
      setDisplayedSymbols(valid.map((v) => v.symbol));
      setIsLoading(false);
    },
    [fetch24hr]
  );

  const rotateOne = useCallback(async () => {
    const allSymbols = buildSymbolPool();
    const current = displayedSymbols;
    const available = allSymbols.filter((s) => !current.includes(s));
    if (available.length === 0) return;

    const newSymbol = available[Math.floor(Math.random() * available.length)];
    const replaceIdx = Math.floor(Math.random() * current.length);
    if (THB_SYMBOLS.includes(current[replaceIdx])) return;

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

  const connectWS = useCallback(
    (
      symbols: string[],
      wssBase: string,
      ref: React.MutableRefObject<WebSocket | null>
    ) => {
      if (ref.current) {
        ref.current.onclose = null;
        ref.current.close();
      }
      if (symbols.length === 0) return;
      const streams = symbols
        .map((s) => `${s.toLowerCase()}@miniTicker`)
        .join("/");
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
    },
    []
  );

  useEffect(() => {
    loadSymbols(buildSymbolPool());
  }, []); // eslint-disable-line

  useEffect(() => {
    if (displayedSymbols.length === 0) return;
    const globalSyms = displayedSymbols.filter(
      (s) => !THB_SYMBOLS.includes(s)
    );
    const siteSyms = displayedSymbols.filter((s) => THB_SYMBOLS.includes(s));
    connectWS(globalSyms, BINANCE_WSS_GLOBAL, wsGlobalRef);
    connectWS(siteSyms, BINANCE_WSS_SITE, wsRef);
    return () => {
      wsGlobalRef.current?.close();
      wsRef.current?.close();
    };
  }, [displayedSymbols, connectWS]);

  useEffect(() => {
    if (isLoading) return;
    rotateTimerRef.current = setInterval(rotateOne, ROTATE_INTERVAL);
    return () => {
      if (rotateTimerRef.current) clearInterval(rotateTimerRef.current);
    };
  }, [isLoading, rotateOne]);

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-cyan-400" />
          <h2 className="text-base font-bold text-white">Market Watchlist</h2>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
            Live · Rotasi otomatis
          </span>
        </div>
        <button
          onClick={() => loadSymbols(shuffle(buildSymbolPool()))}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Acak
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: CARDS_DISPLAYED }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-xl border border-slate-800 bg-slate-900/40"
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
                onChartClick={(i) => onChartOpen(i.symbol, i.type)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <p className="mt-3 text-center text-[11px] text-slate-600">
        Klik <span className="text-slate-400">Detail</span> untuk stats ·{" "}
        <span className="text-slate-400">Grafik</span> untuk chart live ·{" "}
        <span className="text-slate-400">Analisis</span> untuk rekomendasi AI ·{" "}
        <span className="text-amber-500/70">
          Koin Pluang (IDR) tidak tersedia di Binance.th
        </span>
      </p>
    </section>
  );
}
