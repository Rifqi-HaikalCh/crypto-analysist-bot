"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Brain,
  TrendingUp,
  TrendingDown,
  Loader2,
  Zap,
  Activity,
  BarChart3,
  Layers,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalysisResult } from "@/app/api/analyze/route";

// ==========================================
// Types
// ==========================================

interface AnalysisModalProps {
  symbol: string;
  entryPrice: number;
  isOpen: boolean;
  onClose: () => void;
}

// ==========================================
// Sub-components
// ==========================================

function IndicatorBadge({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  const isBullish = /bullish|tinggi|support|kuat/i.test(value);
  const isBearish = /bearish|rendah|resistance|lemah/i.test(value);

  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      <span
        className={cn(
          "text-xs font-bold uppercase tracking-wide",
          isBullish && "text-emerald-400",
          isBearish && "text-red-400",
          !isBullish && !isBearish && "text-slate-300"
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ==========================================
// Main Component
// ==========================================

export default function AnalysisModal({
  symbol,
  entryPrice,
  isOpen,
  onClose,
}: AnalysisModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isBuy = result?.keputusan === "BELI";

  const runAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Analisis gagal. Silakan coba lagi.");
      } else {
        setResult(data.data as AnalysisResult);
      }
    } catch {
      setError("Koneksi gagal. Periksa koneksi internet Anda.");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-run analysis when modal opens
  const handleOpen = () => {
    if (!result && !isLoading) {
      runAnalysis();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onAnimationComplete={handleOpen}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 px-4"
          >
            <div className="rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/60">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500">
                    <Brain className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-white">Analisis AI</h2>
                    <p className="text-xs text-slate-400">
                      <span className="font-mono font-semibold text-cyan-400">
                        {symbol}
                      </span>{" "}
                      · Harga Beli: ฿
                      {new Intl.NumberFormat("th-TH").format(entryPrice)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6">
                <AnimatePresence mode="wait">
                  {/* Loading State */}
                  {isLoading && (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-4 py-10"
                    >
                      <div className="relative">
                        <div className="h-16 w-16 rounded-full border-2 border-slate-800" />
                        <div className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-2 border-transparent border-t-violet-500" />
                        <Brain className="absolute inset-0 m-auto h-6 w-6 text-violet-400" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-white">
                          Menganalisis {symbol}...
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          Mengambil data 1H & 4H dari Binance .th
                        </p>
                      </div>
                      <div className="flex gap-2 text-xs text-slate-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Powered by Gemini AI
                      </div>
                    </motion.div>
                  )}

                  {/* Error State */}
                  {error && !isLoading && (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-4 py-8"
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
                        <XCircle className="h-7 w-7 text-red-400" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-red-400">
                          Analisis Gagal
                        </p>
                        <p className="mt-1 text-sm text-slate-400">{error}</p>
                      </div>
                      <button
                        onClick={runAnalysis}
                        className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white transition-colors hover:bg-slate-700"
                      >
                        Coba Lagi
                      </button>
                    </motion.div>
                  )}

                  {/* Result State */}
                  {result && !isLoading && (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="space-y-5"
                    >
                      {/* Decision Banner */}
                      <motion.div
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                        }}
                        className={cn(
                          "flex items-center justify-center gap-3 rounded-xl border py-5",
                          isBuy
                            ? "border-emerald-500/30 bg-emerald-500/10"
                            : "border-red-500/30 bg-red-500/10"
                        )}
                      >
                        {isBuy ? (
                          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                        ) : (
                          <XCircle className="h-8 w-8 text-red-400" />
                        )}
                        <div>
                          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
                            Rekomendasi AI
                          </p>
                          <p
                            className={cn(
                              "text-3xl font-black tracking-tight",
                              isBuy ? "text-emerald-400" : "text-red-400"
                            )}
                          >
                            {result.keputusan}
                          </p>
                        </div>
                      </motion.div>

                      {/* Alasan */}
                      <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-4">
                        <div className="mb-2 flex items-center gap-2">
                          <Zap className="h-4 w-4 text-amber-400" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Analisis
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-slate-200">
                          {result.alasan}
                        </p>
                      </div>

                      {/* Indicators */}
                      <div className="space-y-2">
                        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          <BarChart3 className="h-3.5 w-3.5" />
                          Indikator Teknikal
                        </p>
                        <IndicatorBadge
                          label="Trend"
                          value={result.indikator.trend}
                          icon={<TrendingUp className="h-3.5 w-3.5" />}
                        />
                        <IndicatorBadge
                          label="Momentum"
                          value={result.indikator.momentum}
                          icon={<Activity className="h-3.5 w-3.5" />}
                        />
                        <IndicatorBadge
                          label="Volume"
                          value={result.indikator.volume}
                          icon={<BarChart3 className="h-3.5 w-3.5" />}
                        />
                        <IndicatorBadge
                          label="Support/Resistance"
                          value={result.indikator.support_resistance}
                          icon={<Layers className="h-3.5 w-3.5" />}
                        />
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-xs text-slate-600">
                        <span>
                          Timeframe:{" "}
                          {result.timeframes_analyzed.join(", ").toUpperCase()}
                        </span>
                        <button
                          onClick={runAnalysis}
                          className="flex items-center gap-1 text-slate-500 transition-colors hover:text-cyan-400"
                        >
                          <Loader2 className="h-3 w-3" />
                          Analisis Ulang
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
