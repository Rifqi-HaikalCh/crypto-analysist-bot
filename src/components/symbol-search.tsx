"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, ChevronDown, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { BinanceSymbol } from "@/app/api/symbols/route";

interface SymbolSearchProps {
  value: string;
  onChange: (symbol: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SymbolSearch({
  value,
  onChange,
  placeholder = "Cari koin... (BTCTHB)",
  className,
}: SymbolSearchProps) {
  const [query, setQuery] = useState(value);
  const [symbols, setSymbols] = useState<BinanceSymbol[]>([]);
  const [filtered, setFiltered] = useState<BinanceSymbol[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch symbol list once on first focus
  const fetchSymbols = useCallback(async () => {
    if (hasFetched) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/symbols");
      const data = await res.json();
      if (data.success) {
        setSymbols(data.data);
        setHasFetched(true);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [hasFetched]);

  // Filter symbols when query changes
  useEffect(() => {
    if (!query.trim()) {
      // Show popular pairs when empty
      setFiltered(symbols.slice(0, 8));
      return;
    }

    const q = query.toUpperCase();
    const results = symbols
      .filter(
        (s) =>
          s.symbol.includes(q) ||
          s.baseAsset.includes(q) ||
          s.quoteAsset.includes(q)
      )
      .slice(0, 10);

    setFiltered(results);
  }, [query, symbols]);

  // Sync internal query with external value
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setQuery(val);
    onChange(val); // propagate immediately
    setIsOpen(true);
  };

  const handleSelect = (s: BinanceSymbol) => {
    setQuery(s.symbol);
    onChange(s.symbol);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setQuery("");
    onChange("");
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    fetchSymbols();
    setIsOpen(true);
  };

  return (
    <div className={cn("relative", className)}>
      {/* Input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-gray-300 bg-gray-100/60 py-3 pl-10 pr-9 text-sm font-medium uppercase tracking-wide text-gray-900 placeholder:text-gray-500 placeholder:normal-case placeholder:tracking-normal transition-all focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
        />
        {/* Right icon: loading / clear / chevron */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
          ) : query ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-500 transition-colors hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <ChevronDown
              className={cn(
                "h-4 w-4 text-gray-500 transition-transform",
                isOpen && "rotate-180"
              )}
            />
          )}
        </div>
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-gray-300 bg-white shadow-2xl shadow-black/50"
          >
            {isLoading && !hasFetched ? (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat daftar koin...
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">
                Tidak ada koin yang cocok untuk &quot;{query}&quot;
              </div>
            ) : (
              <>
                {/* Header label */}
                <div className="border-b border-gray-200 px-4 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                    {query ? `Hasil: ${filtered.length} koin` : "Populer"}
                  </p>
                </div>

                {/* Symbol list */}
                {filtered.map((s) => (
                  <button
                    key={s.symbol}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                    onClick={() => handleSelect(s)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      {/* Coin icon placeholder */}
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 text-[10px] font-bold text-cyan-400">
                        {s.baseAsset.slice(0, 3)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {s.symbol}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {s.baseAsset} / {s.quoteAsset}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                        s.type === "GLOBAL"
                          ? "bg-cyan-500/10 text-cyan-500"
                          : "bg-emerald-500/10 text-emerald-500"
                      )}
                    >
                      {s.type}
                    </span>
                  </button>
                ))}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
