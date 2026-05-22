"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import UnifiedTokenSearch, { type UnifiedResult } from "@/components/unified-token-search";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  BarChart2,
  LineChart,
  Brain,
  ChevronDown,
  Activity,
  ArrowDownRight,
  Search,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScalpingTarget } from "@/lib/supabase";
import { getUserFavorites, updateUserFavorites } from "@/lib/supabase";
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
  dataSource?: "BINANCE" | "DEXSCREENER";
  contractAddress?: string;
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
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-violet-500" />
        <span className="text-xs text-gray-600">Gemini AI menganalisis...</span>
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
            <span className="text-[11px] font-medium text-gray-600">
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
        <p className="text-[11px] leading-relaxed text-gray-600">{r.alasan}</p>

        {/* Analisis Mendalam */}
        <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">
            Analisis Mendalam
          </p>
          <p className="text-[11px] leading-relaxed text-gray-700">
            {r.analisis_mendalam}
          </p>
        </div>

        <p className="text-[10px] text-gray-400">
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
  isFavorite,
  onToggleFavorite,
  onChartClick,
}: {
  item: WatchlistItem;
  isFavorite: boolean;
  onToggleFavorite: (symbol: string) => void;
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
      const bodyPayload = {
        symbol: item.symbol,
        dataSource: item.dataSource || "BINANCE",
        contractAddress: item.contractAddress,
        analysisType: "watchlist"
      };
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white transition-all hover:border-gray-300 shadow-sm shrink-0"
    >
      {/* Main row */}
      <div className="relative p-3 flex items-center justify-between gap-2">
        
        {/* Left: Coin info */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => onToggleFavorite(item.symbol)}
            className="text-gray-400 transition-colors hover:text-amber-400 shrink-0"
          >
            <Star
              className={cn("h-4 w-4", isFavorite && "fill-amber-400 text-amber-400")}
            />
          </button>
          <div className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 font-bold text-gray-700">
            {item.baseAsset.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] sm:text-sm font-bold leading-none text-gray-900 flex items-center gap-1.5 truncate">
              <span className="truncate">{item.baseAsset}</span>
              {item.dataSource === "DEXSCREENER" && (
                <span className="text-[9px] bg-blue-100 text-blue-600 px-1 py-0.5 rounded font-medium shrink-0">DEX</span>
              )}
            </p>
            <p className="text-[10px] font-medium text-gray-500">
              {item.symbol}
            </p>
          </div>
        </div>

        {/* Mid: Price */}
        <div className="flex items-center justify-end gap-3 shrink-0 ml-auto">
          <div className="text-right">
            <p className="text-[13px] sm:text-sm font-bold text-gray-900 tracking-tight">
              {currency}{formatPrice(item.price, item.quoteAsset)}
            </p>
            <div className={cn(
              "flex justify-end text-[11px] font-bold",
              isPositive ? "text-emerald-500" : "text-red-500"
            )}>
              {isPositive ? "+" : ""}{item.change24h.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Right: Actions (Icons only) */}
        <div className="flex items-center justify-end gap-1.5 shrink-0 ml-2">
          <button
            onClick={() => onChartClick(item)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-all hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-500"
            title="Grafik"
          >
            <LineChart className="h-4 w-4" />
          </button>
          
          <button
            onClick={runAnalysis}
            disabled={analysis.status === "loading"}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg border transition-all disabled:opacity-60",
              analysis.status === "done"
                ? analysis.result?.keputusan === "BELI"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                  : "border-red-500/30 bg-red-500/10 text-red-500"
                : "border-gray-200 text-gray-600 hover:bg-[var(--primary)] hover:text-white hover:border-transparent"
            )}
            title={analysis.status === "done" ? analysis.result?.keputusan : "Analisis AI"}
          >
            {analysis.status === "loading" ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-current" />
            ) : (
              <Brain className="h-4 w-4" />
            )}
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg border transition-all",
              isExpanded
                ? "border-gray-300 bg-gray-100 text-gray-900"
                : "border-gray-200 text-gray-500 hover:bg-gray-50"
            )}
            title="Detail"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
          </button>
        </div>
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
              <div className="border-t border-gray-100 bg-gray-50/50 p-4">
                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2 sm:gap-4 sm:flex sm:items-center text-xs">
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 flex-1">
                    <p className="text-[10px] text-gray-500">Volume 24H</p>
                    <p className="font-semibold text-gray-900">
                      {currency}{formatVolume(item.volume24h)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 flex-1">
                    <p className="text-[10px] text-gray-500">High 24H</p>
                    <p className="font-semibold text-emerald-500">
                      {currency}{formatPrice(item.high24h, item.quoteAsset)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 flex-1">
                    <p className="text-[10px] text-gray-500">Low 24H</p>
                    <p className="font-semibold text-red-500">
                      {currency}{formatPrice(item.low24h, item.quoteAsset)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 flex-1">
                    <p className="text-[10px] text-gray-500">H/L Position</p>
                    <div className="mt-1 relative h-1.5 w-full rounded-full bg-gray-100">
                      <div
                        className="absolute h-1.5 rounded-full bg-gradient-to-r from-red-400 to-emerald-400"
                        style={{ width: `${pricePos}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* AI Analysis panel */}
                <AnalysisPanel analysis={analysis} />

                {/* Run analysis button if not done yet */}
                {analysis.status === "idle" && (
                  <button
                    onClick={runAnalysis}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] py-2.5 text-xs font-medium text-white transition-all hover:bg-[#b01c36] shadow-sm shadow-red-500/20"
                  >
                    <Brain className="h-4 w-4" />
                    Jalankan Analisis AI — BELI atau JANGAN BELI?
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "FAV">("ALL");
  const [favorites, setFavorites] = useState<string[]>([]);

  const wsGlobalRef = useRef<WebSocket | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const allDataRef = useRef<Map<string, WatchlistItem>>(new Map());
  const rotateTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load favorites from Database on mount
  useEffect(() => {
    getUserFavorites().then((favs) => {
      setFavorites(favs);
    });
  }, []);

  const handleToggleFavorite = useCallback((symbol: string) => {
    setFavorites((prev) => {
      const next = prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol];
      updateUserFavorites(next).catch(() => {
        console.error("Failed to update favorites in database");
      });
      return next;
    });
  }, []);

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
          dataSource: "BINANCE",
        };
      } catch {
        return null;
      }
    },
    []
  );

    const loadSymbols = useCallback(
    async (symbols: string[], limit?: number) => {
      setIsLoading(true);
      const toFetch = limit ? symbols.slice(0, limit) : symbols;
      const results = await Promise.all(toFetch.map(fetch24hr));
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
    if (activeTab === "ALL") {
      loadSymbols(buildSymbolPool(), CARDS_DISPLAYED);
    } else {
      if (favorites.length === 0) {
        setItems([]);
        setDisplayedSymbols([]);
      } else {
        loadSymbols(favorites);
      }
    }
  }, [activeTab, favorites.length]); // intentionally missing some deps for clean tab switch

  // Handle Search using UnifiedTokenSearch
  const handleUnifiedSearchSelect = async (result: UnifiedResult, rate: number) => {
    setSearchQuery(result.displayName);
    setIsLoading(true);
    let item: WatchlistItem | null = null;

    if (result.source === "BINANCE" && result.binanceSymbol) {
      item = await fetch24hr(result.binanceSymbol);
    } else if (result.source === "DEXSCREENER" && result.dexToken) {
      item = {
        symbol: result.dexToken.symbol,
        baseAsset: result.dexToken.name,
        quoteAsset: "USD",
        price: result.dexToken.priceUsd,
        change24h: result.dexToken.priceChange?.h24 || 0,
        volume24h: result.dexToken.volume24h || 0,
        high24h: 0,
        low24h: 0,
        type: "GLOBAL",
        dataSource: "DEXSCREENER",
        contractAddress: result.dexToken.pairAddress,
      };
    }

    if (item) {
      allDataRef.current.set(item.symbol, item);
      setItems([item]);
    } else {
      setItems([]);
    }
    setIsLoading(false);
  };

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
    if (isLoading || searchQuery.trim() !== "" || activeTab === "FAV") return;
    rotateTimerRef.current = setInterval(rotateOne, ROTATE_INTERVAL);
    return () => {
      if (rotateTimerRef.current) clearInterval(rotateTimerRef.current);
    };
  }, [isLoading, rotateOne, searchQuery, activeTab]);

  return (
    <section className="flex flex-col h-full min-h-0">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-[var(--primary)]" />
          <h2 className="text-base font-bold text-gray-900">Market Watchlist</h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <UnifiedTokenSearch 
            onSelect={handleUnifiedSearchSelect}
            onClear={() => {
              setSearchQuery("");
              if (activeTab === "ALL") loadSymbols(shuffle(buildSymbolPool()), CARDS_DISPLAYED);
              else loadSymbols(favorites);
            }}
            placeholder="Cari Binance/DEX..."
            className="w-full sm:w-64"
          />
          <button
            onClick={() => {
              setSearchQuery("");
              if (activeTab === "ALL") loadSymbols(shuffle(buildSymbolPool()), CARDS_DISPLAYED);
              else loadSymbols(favorites);
            }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 border border-gray-200"
            title="Acak Ulang"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-4 border-b border-gray-100 pb-2 text-sm font-medium">
        <button
          onClick={() => setActiveTab("ALL")}
          className={cn("transition-colors", activeTab === "ALL" ? "text-[var(--primary)] border-b-2 border-[var(--primary)] pb-2 -mb-[9px]" : "text-gray-400 hover:text-gray-600")}
        >
          Semua
        </button>
        <button
          onClick={() => setActiveTab("FAV")}
          className={cn("transition-colors", activeTab === "FAV" ? "text-[var(--primary)] border-b-2 border-[var(--primary)] pb-2 -mb-[9px]" : "text-gray-400 hover:text-gray-600")}
        >
          Favorit
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2 flex-1 overflow-y-auto min-h-0 pr-1">
          {Array.from({ length: CARDS_DISPLAYED }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl border border-gray-200 bg-gray-50 shrink-0"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2 flex-1 overflow-y-auto min-h-0 pr-1">
          <AnimatePresence>
            {items.length === 0 && !isLoading ? (
              <div className="py-10 text-center text-sm text-gray-400">
                {activeTab === "FAV" ? "Belum ada koin favorit." : "Koin tidak ditemukan."}
              </div>
            ) : (
              items.map((item) => (
                <WatchlistCard
                  key={item.symbol}
                  item={item}
                  isFavorite={favorites.includes(item.symbol)}
                  onToggleFavorite={handleToggleFavorite}
                  onChartClick={(i) => onChartOpen(i.symbol, i.type)}
                />
              ))
            )}
          </AnimatePresence>
        </div>
      )}

      <p className="mt-3 text-center text-[11px] text-gray-400">
        Klik <span className="text-gray-600">Detail</span> untuk stats ·{" "}
        <span className="text-gray-600">Grafik</span> untuk chart live ·{" "}
        <span className="text-gray-600">Analisis</span> untuk rekomendasi AI ·{" "}
        <span className="text-amber-500/70">
          Koin Pluang (IDR) tidak tersedia di Binance.th
        </span>
      </p>
    </section>
  );
}
