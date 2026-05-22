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
  dataSource?: "BINANCE" | "DEXSCREENER";
  contractAddress?: string | null;
  analysisType?: "watchlist" | "scalping";
}



// ==========================================
// Main Component
// ==========================================

export default function AnalysisModal({
  symbol,
  entryPrice,
  isOpen,
  onClose,
  dataSource = "BINANCE",
  contractAddress,
  analysisType = "watchlist",
}: AnalysisModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDex = dataSource === "DEXSCREENER";
  const isBuy = result?.keputusan === "BELI" || result?.keputusan === "NAIK";

  const runAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const body = isDex && contractAddress
        ? { symbol, contractAddress, dataSource: "DEXSCREENER", analysisType }
        : { symbol, dataSource: "BINANCE", analysisType };

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
            className="fixed inset-0 z-50 bg-white/60 backdrop-blur-sm"
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
            <div className="pro-card shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)]">
                    <Brain className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-[var(--foreground)]">Analisis AI</h2>
                    <p className="text-xs text-gray-500">
                      <span className="font-mono font-semibold text-[var(--primary)]">
                        {symbol}
                      </span>{" "}
                      · {isDex ? "DexScreener" : "Binance"}
                      {" · "}
                      {isDex
                        ? `Rp${new Intl.NumberFormat("id-ID").format(entryPrice)}`
                        : `฿${new Intl.NumberFormat("th-TH").format(entryPrice)}`
                      }
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
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
                        <div className="h-16 w-16 rounded-full border-2 border-gray-100" />
                        <div className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-2 border-transparent border-t-[var(--primary)]" />
                        <Brain className="absolute inset-0 m-auto h-6 w-6 text-[var(--primary)]" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-[var(--foreground)]">
                          Menganalisis {symbol}...
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          {isDex
                            ? "Mengambil data dari DexScreener"
                            : "Mengambil data 1H & 4H dari Binance .th"
                          }
                        </p>
                      </div>
                      <div className="flex gap-2 text-xs text-gray-400">
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
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                        <XCircle className="h-7 w-7 text-red-500" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-red-600">
                          Analisis Gagal
                        </p>
                        <p className="mt-1 text-sm text-gray-600">{error}</p>
                      </div>
                      <button
                        onClick={runAnalysis}
                        className="btn-primary mt-2"
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
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-red-200 bg-red-50"
                        )}
                      >
                        {isBuy ? (
                          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                        ) : (
                          <XCircle className="h-8 w-8 text-red-600" />
                        )}
                        <div>
                          <p className="text-xs font-medium uppercase tracking-widest text-gray-500">
                            {analysisType === "scalping" ? "Prediksi Tren AI" : "Rekomendasi AI"}
                          </p>
                          <p
                            className={cn(
                              "text-3xl font-black tracking-tight",
                              isBuy ? "text-emerald-600" : "text-red-600"
                            )}
                          >
                            {result.keputusan}
                          </p>
                        </div>
                      </motion.div>

                      {/* Alasan */}
                      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                        <div className="mb-2 flex items-center gap-2">
                          <Zap className="h-4 w-4 text-[var(--secondary)]" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                            Analisis
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-gray-800">
                          {result.alasan}
                        </p>
                      </div>

                      {/* Indicators */}
                      <div className="space-y-2">
                        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                          <BarChart3 className="h-3.5 w-3.5" />
                          Analisis Mendalam
                        </p>
                        <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
                          <p className="text-sm leading-relaxed text-gray-700">
                            {result.analisis_mendalam}
                          </p>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between border-t border-gray-200 pt-3 text-xs text-gray-500">
                        <span>
                          Timeframe:{" "}
                          {result.timeframes_analyzed.join(", ").toUpperCase()}
                        </span>
                        <button
                          onClick={runAnalysis}
                          className="flex items-center gap-1 text-gray-500 transition-colors hover:text-[var(--primary)]"
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
