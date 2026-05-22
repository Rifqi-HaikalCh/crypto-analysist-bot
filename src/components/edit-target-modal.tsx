"use client";

import { useState, useEffect } from "react";
import { X, Save, Loader2, Edit3 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ScalpingTarget } from "@/lib/supabase";

interface EditTargetModalProps {
  target: ScalpingTarget | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, entryPrice: number, capital?: number) => Promise<void>;
}

export default function EditTargetModal({
  target,
  isOpen,
  onClose,
  onSubmit,
}: EditTargetModalProps) {
  const [entryPrice, setEntryPrice] = useState("");
  const [capital, setCapital] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (target && isOpen) {
      setEntryPrice(target.entry_price.toString());
      setCapital(target.capital ? target.capital.toString() : "");
    }
  }, [target, isOpen]);

  if (!isOpen || !target) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryPrice) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(
        target.id,
        parseFloat(entryPrice),
        capital ? parseFloat(capital) : undefined
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 px-4 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-[var(--primary)]" />
              <h3 className="text-lg font-bold text-gray-900">
                Edit Target {target.symbol}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Harga Masuk (Entry Price) *
                </label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    className="block w-full rounded-xl border border-gray-300 px-4 py-3 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Target Jual akan otomatis disesuaikan menjadi +5%.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Modal (Opsional)
                </label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={capital}
                    onChange={(e) => setCapital(e.target.value)}
                    className="block w-full rounded-xl border border-gray-300 px-4 py-3 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Contoh: 1000000"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-500/20 transition-all hover:bg-[var(--primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Simpan
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
