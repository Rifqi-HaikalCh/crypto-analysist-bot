"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Bot, Info } from "lucide-react";

interface TelegramSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (chatId: string) => void;
}

export default function TelegramSetupModal({
  isOpen,
  onClose,
  onSubmit,
}: TelegramSetupModalProps) {
  const [chatId, setChatId] = useState("");

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-5 py-4">
            <div className="flex items-center gap-2 text-gray-900">
              <Bot className="h-5 w-5 text-blue-500" />
              <h2 className="text-sm font-bold">Konfigurasi Notifikasi Telegram</h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5">
            <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50/50 p-4 text-xs leading-relaxed text-blue-900">
              <div className="mb-2 flex items-center gap-1.5 font-bold">
                <Info className="h-4 w-4" />
                <span>Cara Mendapatkan Chat ID</span>
              </div>
              <ol className="list-decimal pl-4 space-y-1.5 text-blue-800/80">
                <li>Buka aplikasi Telegram Anda.</li>
                <li>Cari bot <span className="font-mono font-bold text-blue-900">@userinfobot</span> (atau klik <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="underline font-medium hover:text-blue-600">tautan ini</a>).</li>
                <li>Tekan <strong>Start</strong> pada bot tersebut.</li>
                <li>Bot akan membalas dengan ID Anda (misal: <code>123456789</code>).</li>
                <li>Salin ID tersebut dan masukkan ke kolom di bawah ini.</li>
              </ol>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="chatId" className="mb-1.5 block text-xs font-bold text-gray-700">
                  Telegram Chat ID
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Send className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="chatId"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value.replace(/[^0-9-]/g, ""))}
                    className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="Contoh: 1841689011"
                    autoComplete="off"
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-gray-500">
                  Notifikasi target profit scalping akan dikirimkan langsung ke Telegram ini.
                </p>
              </div>

              <button
                onClick={() => {
                  if (chatId.trim()) onSubmit(chatId.trim());
                }}
                disabled={!chatId.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] py-2.5 text-xs font-bold text-white transition-all hover:bg-[#b01c36] disabled:opacity-50"
              >
                Simpan & Lanjutkan
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
