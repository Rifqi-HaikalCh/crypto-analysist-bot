import { NextResponse } from "next/server";

// ==========================================
// GET /api/rates — Kurs USDT/IDR real-time
// ==========================================
// Primary: ExchangeRate-API (free, no key needed)
// Fallback: hardcoded reference rate
// ==========================================

type RateCache = {
  usdtIdr: number;
  usdtThb: number;
  fetchedAt: number;
};

let cache: RateCache | null = null;
const CACHE_TTL = 120_000; // 2 menit

async function fetchFromExchangeRateAPI(): Promise<{ idr: number; thb: number }> {
  // Free API: https://open.er-api.com
  const res = await fetch("https://open.er-api.com/v6/latest/USD", {
    next: { revalidate: 120 },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`ExchangeRate API: ${res.status}`);
  const data = await res.json();
  if (!data.rates?.IDR || !data.rates?.THB) throw new Error("Missing IDR/THB in response");
  return { idr: data.rates.IDR, thb: data.rates.THB };
}

async function fetchFromFrankfurter(): Promise<{ idr: number; thb: number }> {
  // Backup: Frankfurt app (no key, free)
  const [idrRes, thbRes] = await Promise.all([
    fetch("https://api.frankfurter.app/latest?from=USD&to=IDR", { signal: AbortSignal.timeout(8000) }),
    fetch("https://api.frankfurter.app/latest?from=USD&to=THB", { signal: AbortSignal.timeout(8000) }),
  ]);
  const idrData = await idrRes.json();
  const thbData = await thbRes.json();
  return { idr: idrData.rates.IDR, thb: thbData.rates.THB };
}

export async function GET() {
  // Return fresh cache
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return NextResponse.json({
      success: true,
      data: { usdtIdr: cache.usdtIdr, usdtThb: cache.usdtThb, fetchedAt: cache.fetchedAt, cached: true },
    });
  }

  let rates: { idr: number; thb: number } | null = null;

  // Try primary source
  try {
    rates = await fetchFromExchangeRateAPI();
  } catch (e1) {
    console.warn("[rates] Primary failed, trying backup:", (e1 as Error).message);
    try {
      rates = await fetchFromFrankfurter();
    } catch (e2) {
      console.warn("[rates] Backup failed:", (e2 as Error).message);
    }
  }

  if (rates) {
    cache = { usdtIdr: rates.idr, usdtThb: rates.thb, fetchedAt: Date.now() };
    return NextResponse.json({
      success: true,
      data: { usdtIdr: rates.idr, usdtThb: rates.thb, fetchedAt: cache.fetchedAt, cached: false },
    });
  }

  // Return stale cache if available
  if (cache) {
    return NextResponse.json({
      success: true,
      data: { usdtIdr: cache.usdtIdr, usdtThb: cache.usdtThb, fetchedAt: cache.fetchedAt, cached: true, stale: true },
    });
  }

  // Last resort: static reference rates
  const fallback = { usdtIdr: 16350, usdtThb: 33.5 };
  return NextResponse.json({
    success: true,
    data: { ...fallback, fetchedAt: Date.now(), cached: false, fallback: true },
  });
}
