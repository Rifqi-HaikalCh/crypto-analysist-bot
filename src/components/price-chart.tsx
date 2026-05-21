"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from "lightweight-charts";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  LineChart,
  Loader2,
  Wifi,
  WifiOff,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ==========================================
// Types
// ==========================================

interface PriceChartProps {
  symbol: string;
  symbolType: "GLOBAL" | "SITE";
  isOpen: boolean;
  onClose: () => void;
}

type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: "1M", value: "1m" },
  { label: "5M", value: "5m" },
  { label: "15M", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
];

const BINANCE_API_URL = "https://api.binance.th";
const BINANCE_WSS_GLOBAL = "wss://www.binance.th/gstream";
const BINANCE_WSS_SITE = "wss://www.binance.th/nstream";

// ==========================================
// Helpers
// ==========================================

function formatPrice(price: number): string {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

function getWssBase(symbolType: "GLOBAL" | "SITE") {
  return symbolType === "SITE" ? BINANCE_WSS_SITE : BINANCE_WSS_GLOBAL;
}

// ==========================================
// Main Component
// ==========================================

export default function PriceChart({
  symbol,
  symbolType,
  isOpen,
  onClose,
}: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [timeframe, setTimeframe] = useState<Timeframe>("15m");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ==========================================
  // Fetch historical klines
  // ==========================================

  const fetchKlines = useCallback(
    async (tf: Timeframe) => {
      setIsLoadingData(true);
      setError(null);

      try {
        const url = `${BINANCE_API_URL}/api/v1/klines?symbol=${symbol}&interval=${tf}&limit=200`;
        const response = await fetch(url);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const raw: unknown[][] = await response.json();

        // Binance kline: [openTime, open, high, low, close, volume, closeTime, ...]
        const candles: CandlestickData<Time>[] = raw.map((k) => ({
          time: (Number(k[0]) / 1000) as Time,
          open: parseFloat(String(k[1])),
          high: parseFloat(String(k[2])),
          low: parseFloat(String(k[3])),
          close: parseFloat(String(k[4])),
        }));

        if (candles.length > 0) {
          const latest = candles[candles.length - 1];
          const first = candles[0];
          setCurrentPrice(latest.close);
          setPriceChange(
            ((latest.close - first.open) / first.open) * 100
          );
        }

        return candles;
      } catch (err) {
        setError(
          `Gagal memuat data ${symbol}. Periksa koneksi atau coba lagi.`
        );
        return [];
      } finally {
        setIsLoadingData(false);
      }
    },
    [symbol]
  );

  // ==========================================
  // WebSocket real-time candle updates
  // ==========================================

  const connectWebSocket = useCallback(
    (tf: Timeframe) => {
      // Close existing
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      const streamName = `${symbol.toLowerCase()}@kline_${tf}`;
      const wssBase = getWssBase(symbolType);
      const wsUrl = `${wssBase}?streams=${streamName}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setIsWsConnected(true);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          // Combined stream: { stream: "...", data: { k: { ... } } }
          const kline = msg?.data?.k;
          if (!kline) return;

          const candle: CandlestickData<Time> = {
            time: (Number(kline.t) / 1000) as Time,
            open: parseFloat(kline.o),
            high: parseFloat(kline.h),
            low: parseFloat(kline.l),
            close: parseFloat(kline.c),
          };

          seriesRef.current?.update(candle);
          setCurrentPrice(candle.close);
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        setIsWsConnected(false);
        // Auto-reconnect after 3s if modal still open
        setTimeout(() => {
          if (wsRef.current === ws) {
            connectWebSocket(tf);
          }
        }, 3000);
      };

      ws.onerror = () => {
        setIsWsConnected(false);
      };

      // Respond to ping frames
      ws.addEventListener("message", (event) => {
        if (event.data === "ping") ws.send("pong");
      });
    },
    [symbol, symbolType]
  );

  // ==========================================
  // Initialize / Re-initialize chart
  // ==========================================

  const initChart = useCallback(async () => {
    if (!chartContainerRef.current || !isOpen) return;

    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(51, 65, 85, 0.4)" },
        horzLines: { color: "rgba(51, 65, 85, 0.4)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "rgba(51, 65, 85, 0.6)",
      },
      timeScale: {
        borderColor: "rgba(51, 65, 85, 0.6)",
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    chartRef.current = chart;

    // Add candlestick series
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    seriesRef.current = series;

    // Responsive resize
    const resizeObserver = new ResizeObserver(() => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    });
    resizeObserver.observe(chartContainerRef.current);

    // Load data
    const candles = await fetchKlines(timeframe);
    if (candles.length > 0) {
      series.setData(candles);
      chart.timeScale().fitContent();
    }

    // Connect WebSocket
    connectWebSocket(timeframe);

    return () => resizeObserver.disconnect();
  }, [isOpen, symbol, timeframe, fetchKlines, connectWebSocket]);

  // Init chart on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => initChart(), 100); // Wait for DOM
      return () => clearTimeout(timer);
    } else {
      // Cleanup on close
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    }
  }, [isOpen, initChart]);

  // Timeframe change
  const handleTimeframeChange = async (tf: Timeframe) => {
    setTimeframe(tf);

    // Disconnect old WS
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
      setIsWsConnected(false);
    }

    // Fetch new klines
    const candles = await fetchKlines(tf);
    if (candles.length > 0 && seriesRef.current) {
      seriesRef.current.setData(candles);
      chartRef.current?.timeScale().fitContent();
    }

    // Connect new WS
    connectWebSocket(tf);
  };

  // ==========================================
  // Render
  // ==========================================

  const isPositive = (priceChange ?? 0) >= 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="chart-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            key="chart-modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="fixed inset-4 z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/60 md:inset-8 lg:inset-16"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-5 py-3">
              {/* Left: symbol + price */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20">
                    <LineChart className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-white">{symbol}</h2>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                          symbolType === "GLOBAL"
                            ? "bg-cyan-500/10 text-cyan-500"
                            : "bg-emerald-500/10 text-emerald-500"
                        )}
                      >
                        {symbolType}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Binance Thailand
                    </p>
                  </div>
                </div>

                {/* Live price */}
                {currentPrice && (
                  <div className="hidden items-center gap-2 sm:flex">
                    <span className="text-xl font-bold text-white">
                      ฿{formatPrice(currentPrice)}
                    </span>
                    {priceChange !== null && (
                      <div
                        className={cn(
                          "flex items-center gap-0.5 rounded-md px-2 py-1 text-sm font-semibold",
                          isPositive
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        )}
                      >
                        {isPositive ? (
                          <TrendingUp className="h-3.5 w-3.5" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5" />
                        )}
                        {isPositive ? "+" : ""}
                        {priceChange.toFixed(2)}%
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right: status + timeframe + close */}
              <div className="flex items-center gap-3">
                {/* WS status */}
                <div
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                    isWsConnected
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-slate-800 text-slate-500"
                  )}
                >
                  {isWsConnected ? (
                    <Wifi className="h-3 w-3" />
                  ) : (
                    <WifiOff className="h-3 w-3" />
                  )}
                  <span className="hidden sm:inline">
                    {isWsConnected ? "Live" : "Offline"}
                  </span>
                </div>

                {/* Timeframe selector */}
                <div className="flex rounded-lg border border-slate-800 bg-slate-950/50 p-0.5">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf.value}
                      onClick={() => handleTimeframeChange(tf.value)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
                        timeframe === tf.value
                          ? "bg-cyan-500 text-white"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>

                {/* Close */}
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Chart area */}
            <div className="relative flex-1">
              {/* Loading overlay */}
              <AnimatePresence>
                {isLoadingData && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-900/80 backdrop-blur-sm"
                  >
                    <div className="relative">
                      <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-800 border-t-cyan-500" />
                      <RefreshCw className="absolute inset-0 m-auto h-5 w-5 text-cyan-400" />
                    </div>
                    <p className="text-sm text-slate-400">
                      Memuat grafik {symbol}...
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error overlay */}
              <AnimatePresence>
                {error && !isLoadingData && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
                  >
                    <p className="text-slate-400">{error}</p>
                    <button
                      onClick={() => initChart()}
                      className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
                    >
                      Coba Lagi
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Chart container */}
              <div ref={chartContainerRef} className="h-full w-full" />
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-between border-t border-slate-800 px-5 py-2 text-[11px] text-slate-600">
              <span>Data: Binance.th · Timeframe: {timeframe.toUpperCase()}</span>
              <span className="flex items-center gap-1">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isWsConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-600"
                  )}
                />
                {isWsConnected
                  ? "Real-time WebSocket aktif"
                  : "Menghubungkan ke stream..."}
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
