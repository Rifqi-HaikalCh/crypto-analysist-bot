import { NextResponse } from "next/server";

const BINANCE_API_URL =
  process.env.BINANCE_API_URL || "https://api.binance.th";

export type BinanceSymbol = {
  symbol: string;         // e.g. "BTCTHB"
  baseAsset: string;      // e.g. "BTC"
  quoteAsset: string;     // e.g. "THB"
  type: "GLOBAL" | "SITE";
};

// Cache in-memory (resets on server restart) — good enough for symbol list
let cachedSymbols: BinanceSymbol[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    // Serve from cache if fresh
    if (cachedSymbols && Date.now() - cacheTime < CACHE_TTL) {
      return NextResponse.json({ success: true, data: cachedSymbols });
    }

    const [exchangeRes, symbolTypeRes] = await Promise.allSettled([
      fetch(`${BINANCE_API_URL}/api/v1/exchangeInfo`, {
        next: { revalidate: 300 },
      }),
      fetch(`${BINANCE_API_URL}/api/v1/symbolType`, {
        next: { revalidate: 300 },
      }),
    ]);

    if (exchangeRes.status === "rejected" || !exchangeRes.value.ok) {
      throw new Error("Failed to fetch exchangeInfo from Binance.th");
    }

    const exchangeData = await exchangeRes.value.json();

    // Build symbol type map
    const typeMap: Record<string, "GLOBAL" | "SITE"> = {};
    if (symbolTypeRes.status === "fulfilled" && symbolTypeRes.value.ok) {
      const typeData = await symbolTypeRes.value.json();
      // Format: array of { symbol: "BTCTHB", type: "GLOBAL" } or similar
      if (Array.isArray(typeData)) {
        for (const item of typeData) {
          if (item.symbol && item.type) {
            typeMap[item.symbol] = item.type;
          }
        }
      } else if (typeData.symbols) {
        for (const item of typeData.symbols) {
          if (item.symbol && item.type) {
            typeMap[item.symbol] = item.type;
          }
        }
      }
    }

    const symbols: BinanceSymbol[] = (exchangeData.symbols || [])
      .filter((s: { status: string }) => s.status === "TRADING")
      .map(
        (s: {
          symbol: string;
          baseAsset: string;
          quoteAsset: string;
          type?: string;
        }) => ({
          symbol: s.symbol,
          baseAsset: s.baseAsset,
          quoteAsset: s.quoteAsset,
          type: typeMap[s.symbol] || s.type || "GLOBAL",
        })
      );

    cachedSymbols = symbols;
    cacheTime = Date.now();

    return NextResponse.json({ success: true, data: symbols });
  } catch (error) {
    console.error("Symbols API error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil daftar simbol dari Binance.th" },
      { status: 500 }
    );
  }
}
