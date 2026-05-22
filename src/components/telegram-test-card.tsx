"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Bot,
  CheckCircle2,
  XCircle,
  Loader2,
  Bell,
  AlertTriangle,
  Info,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TestType = "alert" | "warning" | "info";
type BotStatus = { name: string; username: string } | null;

export default function TelegramTestCard() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSending, setIsSending] = useState<TestType | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [lastResult, setLastResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const checkBotStatus = async () => {
    setIsChecking(true);
    try {
      const res = await fetch("/api/test-telegram");
      const data = await res.json();
      if (data.success && data.bot) {
        setBotStatus(data.bot);
        setLastResult({ type: "success", message: `Bot aktif: ${data.bot.name}` });
      } else {
        setBotStatus(null);
        setLastResult({
          type: "error",
          message: data.error || "Bot tidak dapat dihubungi",
        });
      }
    } catch {
      setLastResult({ type: "error", message: "Koneksi gagal" });
    } finally {
      setIsChecking(false);
    }
  };

  const sendTest = async (type: TestType) => {
    setIsSending(type);
    setLastResult(null);
    try {
      const res = await fetch("/api/test-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (data.success) {
        setLastResult({ type: "success", message: data.message });
      } else {
        setLastResult({ type: "error", message: data.error });
      }
    } catch {
      setLastResult({ type: "error", message: "Gagal mengirim pesan test" });
    } finally {
      setIsSending(null);
    }
  };

  const TEST_BUTTONS: { type: TestType; label: string; icon: React.ReactNode; color: string }[] = [
    {
      type: "alert",
      label: "Test Alert Profit",
      icon: <Bell className="h-4 w-4" />,
      color: "from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400",
    },
    {
      type: "warning",
      label: "Test Warning",
      icon: <AlertTriangle className="h-4 w-4" />,
      color: "from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400",
    },
    {
      type: "info",
      label: "Test Info",
      icon: <Info className="h-4 w-4" />,
      color: "from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400",
    },
  ];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white ">
      {/* Header (always visible) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-6 py-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
            <Bot className="h-5 w-5 text-blue-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">Test Telegram Bot</p>
            <p className="text-xs text-gray-500">
              Verifikasi koneksi & kirim pesan test
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {botStatus && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {botStatus.username}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-gray-500 transition-transform",
              isExpanded && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Expandable body */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-200 px-6 pb-5 pt-4">
              {/* Step 1: Check bot */}
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Langkah 1 — Cek Status Bot
                </p>
                <button
                  onClick={checkBotStatus}
                  disabled={isChecking}
                  className="flex items-center gap-2 rounded-xl border border-gray-300 bg-gray-100 px-4 py-2.5 text-sm text-gray-900 transition-colors hover:bg-slate-700 disabled:opacity-50"
                >
                  {isChecking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Bot className="h-4 w-4 text-blue-400" />
                  )}
                  {isChecking ? "Mengecek..." : "Cek Koneksi Bot"}
                </button>
              </div>

              {/* Step 2: Send test messages */}
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Langkah 2 — Kirim Pesan Test
                </p>
                <div className="flex flex-wrap gap-2">
                  {TEST_BUTTONS.map((btn) => (
                    <button
                      key={btn.type}
                      onClick={() => sendTest(btn.type)}
                      disabled={isSending !== null}
                      className={cn(
                        "flex items-center gap-2 rounded-xl bg-gradient-to-r px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-50",
                        btn.color
                      )}
                    >
                      {isSending === btn.type ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        btn.icon
                      )}
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Result feedback */}
              <AnimatePresence>
                {lastResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm",
                      lastResult.type === "success"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                        : "border-red-500/20 bg-red-500/10 text-red-400"
                    )}
                  >
                    {lastResult.type === "success" ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0" />
                    )}
                    {lastResult.message}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Info */}
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500">
                <p className="mb-1 font-semibold text-gray-600">Cara kerja:</p>
                <ul className="space-y-0.5 list-disc list-inside">
                  <li>Bot diaktifkan lewat <code className="text-gray-700">npm run worker</code></li>
                  <li>Alert dikirim otomatis saat harga ≥ target profit 5%</li>
                  <li>Chat ID saat ini: <code className="text-cyan-400">{process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID || "tersimpan di .env.local"}</code></li>
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
