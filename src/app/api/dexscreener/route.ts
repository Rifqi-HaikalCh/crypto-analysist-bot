import { NextRequest, NextResponse } from "next/server";

// ==========================================
// DexScreener API Proxy
// ==========================================
// Endpoint publik: https://api.dexscreener.com/latest/dex/tokens/<ADDRESS>
// Search:          https://api.dexscreener.com/latest/dex/search?q=<query>
// ==========================================

const DEX_BASE = "https://api.dexscreener.com/latest/dex";

export type DexPair = {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    symbol: string;
  };
  priceUsd: string | null;
  priceChange: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  volume: {
    h24?: number;
    h6?: number;
    h1?: number;
    m5?: number;
  };
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  url: string;
};

export type DexTokenInfo = {
  contractAddress: string;
  name: string;
  symbol: string;
  chainId: string;
  priceUsd: number;
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  volume24h: number;
  liquidityUsd: number;
  fdv: number;
  pairUrl: string;
  pairAddress: string;
  dexId: string;
  // Best pair (highest liquidity)
  allPairs: DexPair[];
};

// ==========================================
// Helper: pilih pair terbaik (likuiditas tertinggi)
// ==========================================

function pickBestPair(pairs: DexPair[]): DexPair | null {
  if (!pairs || pairs.length === 0) return null;
  // Prefer pairs with USD price and highest liquidity
  const withPrice = pairs.filter((p) => p.priceUsd && parseFloat(p.priceUsd) > 0);
  if (withPrice.length === 0) return pairs[0];
  return withPrice.sort(
    (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
  )[0];
}

function buildTokenInfo(contractAddress: string, pairs: DexPair[]): DexTokenInfo | null {
  const best = pickBestPair(pairs);
  if (!best) return null;

  return {
    contractAddress,
    name: best.baseToken.name,
    symbol: best.baseToken.symbol,
    chainId: best.chainId,
    priceUsd: parseFloat(best.priceUsd || "0"),
    priceChange: {
      m5: best.priceChange?.m5 || 0,
      h1: best.priceChange?.h1 || 0,
      h6: best.priceChange?.h6 || 0,
      h24: best.priceChange?.h24 || 0,
    },
    volume24h: best.volume?.h24 || 0,
    liquidityUsd: best.liquidity?.usd || 0,
    fdv: best.fdv || 0,
    pairUrl: best.url,
    pairAddress: best.pairAddress,
    dexId: best.dexId,
    allPairs: pairs,
  };
}

// ==========================================
// GET /api/dexscreener?address=<CONTRACT>
// GET /api/dexscreener?search=<QUERY>
// ==========================================

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const address = searchParams.get("address");
  const search = searchParams.get("search");

  // --- Search by query (name/symbol) ---
  if (search) {
    try {
      const url = `${DEX_BASE}/search?q=${encodeURIComponent(search)}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        next: { revalidate: 30 },
      });

      if (!res.ok) {
        return NextResponse.json(
          { success: false, error: `DexScreener search error: ${res.status}` },
          { status: res.status }
        );
      }

      const data = await res.json();
      const pairs: DexPair[] = data.pairs || [];

      // Group by contract address → return best pair per contract
      const grouped = new Map<string, DexPair[]>();
      for (const pair of pairs) {
        const addr = pair.baseToken.address.toLowerCase();
        if (!grouped.has(addr)) grouped.set(addr, []);
        grouped.get(addr)!.push(pair);
      }

      const results = Array.from(grouped.entries())
        .map(([addr, ps]) => buildTokenInfo(addr, ps))
        .filter(Boolean)
        .slice(0, 10);

      return NextResponse.json({ success: true, data: results, type: "search" });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: `Search failed: ${(err as Error).message}` },
        { status: 500 }
      );
    }
  }

  // --- Lookup by contract address ---
  if (address) {
    try {
      const cleanAddress = address.trim().toLowerCase();
      const url = `${DEX_BASE}/tokens/${cleanAddress}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        next: { revalidate: 15 }, // cache 15 detik
      });

      if (!res.ok) {
        return NextResponse.json(
          { success: false, error: `DexScreener error: ${res.status}` },
          { status: res.status }
        );
      }

      const data = await res.json();
      const pairs: DexPair[] = data.pairs || [];

      if (pairs.length === 0) {
        return NextResponse.json({
          success: false,
          error: "Token tidak ditemukan di DexScreener. Periksa contract address.",
        });
      }

      const tokenInfo = buildTokenInfo(cleanAddress, pairs);
      if (!tokenInfo) {
        return NextResponse.json({
          success: false,
          error: "Tidak ada pair aktif untuk token ini.",
        });
      }

      return NextResponse.json({ success: true, data: tokenInfo, type: "address" });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: `Lookup failed: ${(err as Error).message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { success: false, error: "Parameter 'address' atau 'search' diperlukan." },
    { status: 400 }
  );
}
