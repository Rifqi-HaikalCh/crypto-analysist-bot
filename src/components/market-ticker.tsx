"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// ==========================================
// Types
// ==========================================

type TickerItem = {
  symbol: string;
  price: string;
  change: number; // 24h % change
};

// Popular USDT pairs for ticker display
const TICKER_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
  "AVAXUSDT", "ADAUSDT", "DOTUSDT", "LINKUSDT", "UNIUSDT",
  "AAVEUSDT", "ARBUSDT", "OPUSDT", "APTUSDT", "INJUSDT",
  "SUIUSDT", "TIAUSDT", "NEARUSDT", "ATOMUSDT", "LDOUSDT",
];

const BINANCE_API_URL = "https://api.binance.th";
const BINANCE_WSS_GLOBAL = "wss://www.binance.th/gstream";

// ==========================================
// Market Ticker Component
// ==========================================

export default function MarketTicker() {
  const [tickers, setTickers] = useState<TickerItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pricesRef = useRef<Map<string, TickerItem>>(new Map());

  // Fetch initial 24hr stats
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const results: TickerItem[] = [];

        // Fetch 24hr stats for all symbols at once using multiple single requests
        const promises = TICKER_SYMBOLS.map(async (sym) => {
          try {
            const res = await fetch(
              `${BINANCE_API_URL}/api/v1/ticker/24hr?symbol=${sym}`
            );
            if (!res.ok) return null;
            const d = await res.json();
            return {
              symbol: sym,
              price: parseFloat(d.lastPrice || d.closePrice || "0").toFixed(4),
              change: parseFloat(d.priceChangePercent || "0"),
            } as TickerItem;
          } catch {
            return null;
          }
        });

        // Run in batches of 5 to avoid rate limit
        for (let i = 0; i < promises.length; i += 5) {
          const batch = await Promise.all(promises.slice(i, i + 5));
          batch.forEach((item) => {
            if (item) {
              results.push(item);
              pricesRef.current.set(item.symbol, item);
            }
          });
        }

        setTickers([...results]);
        setIsLoaded(true);
      } catch (err) {
        console.error("Ticker fetch error:", err);
        setIsLoaded(true);
      }
    };

    fetchInitial();
  }, []);

  // WebSocket mini-ticker for real-time price updates
  useEffect(() => {
    if (!isLoaded) return;

    const streams = TICKER_SYMBOLS.map(
      (s) => `${s.toLowerCase()}@miniTicker`
    ).join("/");

    const ws = new WebSocket(`${BINANCE_WSS_GLOBAL}?streams=${streams}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const d = msg?.data;
        if (!d?.s || !d?.c) return;

        const symbol = d.s.toUpperCase();
        const existing = pricesRef.current.get(symbol);
        if (!existing) return;

        const updated: TickerItem = {
          ...existing,
          price: parseFloat(d.c).toFixed(4),
        };

        pricesRef.current.set(symbol, updated);
        setTickers((prev) =>
          prev.map((t) => (t.symbol === symbol ? updated : t))
        );
      } catch {
        // ignore
      }
    };

    ws.onerror = () => {};
    ws.onclose = () => {};

    return () => {
      ws.onclose = null;
      ws.close();
    };
  }, [isLoaded]);

  if (!isLoaded || tickers.length === 0) return null;

  // Duplicate for seamless loop
  const displayTickers = [...tickers, ...tickers];

  return (
    <div className="relative overflow-hidden border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm">
      {/* Left fade */}
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-12 bg-gradient-to-r from-slate-950 to-transparent" />
      {/* Right fade */}
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-12 bg-gradient-to-l from-slate-950 to-transparent" />

      <div className="flex items-center gap-0 py-2">
        {/* Live badge */}
        <div className="flex shrink-0 items-center gap-1.5 border-r border-slate-800 px-3 pr-4">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">
            Live
          </span>
          <Zap className="h-3 w-3 text-emerald-500" />
        </div>

        {/* Scrolling ticker */}
        <div className="flex-1 overflow-hidden">
          <motion.div
            className="flex gap-6 whitespace-nowrap"
            animate={{ x: ["0%", "-50%"] }}
            transition={{
              duration: tickers.length * 2.5,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            {displayTickers.map((ticker, idx) => {
              const isPositive = ticker.change >= 0;
              const price = parseFloat(ticker.price);

              return (
                <div
                  key={`${ticker.symbol}-${idx}`}
                  className="inline-flex items-center gap-2 px-1"
                >
                  <span className="text-xs font-semibold text-slate-300">
                    {ticker.symbol.replace("USDT", "")}
                    <span className="text-slate-600">/USDT</span>
                  </span>
                  <span className="text-xs font-mono text-white">
                    ${price < 0.01
                      ? price.toFixed(6)
                      : price < 1
                      ? price.toFixed(4)
                      : price < 1000
                      ? price.toFixed(2)
                      : price.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </span>
                  <span
                    className={cn(
                      "flex items-center gap-0.5 text-[10px] font-semibold",
                      isPositive ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    {isPositive ? (
                      <TrendingUp className="h-2.5 w-2.5" />
                    ) : (
                      <TrendingDown className="h-2.5 w-2.5" />
                    )}
                    {isPositive ? "+" : ""}
                    {ticker.change.toFixed(2)}%
                  </span>
                  <span className="text-slate-700">·</span>
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
