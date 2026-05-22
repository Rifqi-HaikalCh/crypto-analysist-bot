"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Newspaper, RefreshCw, Loader2, AlertCircle, LineChart, Brain } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
export default function NewsSection({
  onTrendClick,
  onTrendChartClick
}: {
  onTrendClick?: (symbol: string) => void;
  onTrendChartClick?: (symbol: string) => void;
}) {
  const [news, setNews] = useState<string | null>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchNews = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [newsRes, trendsRes] = await Promise.all([
        fetch("/api/news"),
        fetch("/api/trends").catch(() => null)
      ]);
      
      const newsData = await newsRes.json();
      if (newsData.success) {
        setNews(newsData.data);
        setLastUpdated(new Date());
      } else {
        setError(newsData.error || "Gagal mengambil berita terkini.");
      }

      if (trendsRes) {
        const trendsData = await trendsRes.json();
        if (trendsData.success || trendsData.data) {
          setTrends(trendsData.data);
        }
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch once on mount
  useEffect(() => {
    fetchNews();
  }, []);

  return (
    <section className="flex flex-col rounded-xl border border-gray-200 bg-white h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
            <Newspaper className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Berita & Analisis AI</h2>
            {lastUpdated && (
              <p className="text-[10px] text-gray-500">
                Diperbarui · {lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={fetchNews}
          disabled={isLoading}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-all hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50"
          title="Perbarui Berita"
        >
          <RefreshCw className={isLoading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
        </button>
      </div>

      {/* Trend Cards (Horizontal Scroll) */}
      {trends.length > 0 && (
        <div className="w-full bg-gray-50 border-b border-gray-100 p-4">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-200">
            {trends.map((t, i) => (
              <div
                key={i}
                className="flex min-w-[200px] max-w-[250px] shrink-0 flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-all hover:border-[var(--primary)]/30 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">{t.symbol}</span>
                  <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-black", t.trend === "UP" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600")}>
                    {t.trend === "UP" ? "🟢 NAIK" : "🔴 TURUN"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed flex-1">
                  {t.message}
                </p>
                <div className="mt-1 flex items-center gap-1.5 border-t border-gray-100 pt-2">
                  <button
                    onClick={() => onTrendChartClick && onTrendChartClick(t.symbol)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-500"
                    title="Grafik"
                  >
                    <LineChart className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onTrendClick && onTrendClick(t.symbol)}
                    className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--primary)]/20 bg-[var(--primary)]/5 px-2 text-[10px] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)] hover:text-white"
                  >
                    <Brain className="h-3 w-3" />
                    Analisis AI
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full flex-col items-center justify-center space-y-3 py-10"
            >
              <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
              <p className="text-xs text-gray-500 animate-pulse">Menyusun analisis pasar...</p>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full flex-col items-center justify-center space-y-3 py-10 text-center"
            >
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-gray-600">{error}</p>
              <button
                onClick={fetchNews}
                className="mt-2 text-xs font-semibold text-[var(--primary)] hover:underline"
              >
                Coba Lagi
              </button>
            </motion.div>
          ) : news ? (
            <motion.div
              key="news"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="prose prose-sm max-w-none text-gray-700
                prose-p:text-[12.5px] prose-p:leading-relaxed prose-p:mb-3
                prose-li:text-[12.5px] prose-li:my-1
                prose-strong:text-gray-900 prose-strong:font-bold
                prose-ul:pl-4 prose-ol:pl-4"
            >
              <ReactMarkdown>{news}</ReactMarkdown>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}
