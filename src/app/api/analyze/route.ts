import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// ==========================================
// Gemini AI Client
// ==========================================

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const BINANCE_API_URL = process.env.BINANCE_API_URL || "https://api.binance.th";

// ==========================================
// Type Definitions
// ==========================================

export type AnalysisResult = {
  keputusan: "BELI" | "JANGAN BELI";
  alasan: string;
  indikator: {
    trend: string;
    momentum: string;
    volume: string;
    support_resistance: string;
  };
  timeframes_analyzed: string[];
  analyzed_at: string;
};

type KlineData = {
  timeframe: string;
  candles: {
    openTime: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    closeTime: number;
  }[];
};

// ==========================================
// Binance Klines Fetcher
// ==========================================

/**
 * Fetch candlestick data dari Binance .th REST API.
 * Binance kline format: [openTime, open, high, low, close, volume, closeTime, ...]
 */
async function fetchKlines(
  symbol: string,
  interval: string,
  limit = 50
): Promise<KlineData | null> {
  try {
    const url = `${BINANCE_API_URL}/api/v1/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`;
    const response = await fetch(url, {
      next: { revalidate: 60 }, // cache 1 menit
    });

    if (!response.ok) {
      console.error(
        `Binance klines error for ${symbol} ${interval}:`,
        response.statusText
      );
      return null;
    }

    const raw: unknown[][] = await response.json();

    return {
      timeframe: interval,
      candles: raw.map((k) => ({
        openTime: Number(k[0]),
        open: String(k[1]),
        high: String(k[2]),
        low: String(k[3]),
        close: String(k[4]),
        volume: String(k[5]),
        closeTime: Number(k[6]),
      })),
    };
  } catch (error) {
    console.error(`Failed to fetch ${interval} klines for ${symbol}:`, error);
    return null;
  }
}

/**
 * Ringkasan statistik dari data candlestick untuk dikirim ke Gemini.
 * Mengurangi token dengan hanya mengirim data penting.
 */
function summarizeKlines(klineData: KlineData): string {
  const { timeframe, candles } = klineData;
  if (candles.length === 0) return "";

  const closes = candles.map((c) => parseFloat(c.close));
  const volumes = candles.map((c) => parseFloat(c.volume));

  const latest = candles[candles.length - 1];
  const first = candles[0];

  const priceChange =
    ((parseFloat(latest.close) - parseFloat(first.open)) /
      parseFloat(first.open)) *
    100;
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const maxHigh = Math.max(...candles.map((c) => parseFloat(c.high)));
  const minLow = Math.min(...candles.map((c) => parseFloat(c.low)));

  // Simple SMA calculation
  const sma20 =
    closes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, closes.length);
  const sma7 =
    closes.slice(-7).reduce((a, b) => a + b, 0) / Math.min(7, closes.length);

  // Recent candles (last 5) for detailed view
  const recentCandles = candles.slice(-5).map((c) => ({
    o: parseFloat(c.open).toFixed(2),
    h: parseFloat(c.high).toFixed(2),
    l: parseFloat(c.low).toFixed(2),
    c: parseFloat(c.close).toFixed(2),
    v: parseFloat(c.volume).toFixed(2),
  }));

  return `
Timeframe: ${timeframe} (${candles.length} candles)
Harga Sekarang: ${latest.close}
Perubahan Harga: ${priceChange.toFixed(2)}%
High: ${maxHigh.toFixed(2)} | Low: ${minLow.toFixed(2)}
SMA-7: ${sma7.toFixed(2)} | SMA-20: ${sma20.toFixed(2)}
Volume Rata-rata: ${avgVolume.toFixed(2)}
Harga vs SMA-7: ${parseFloat(latest.close) > sma7 ? "ABOVE" : "BELOW"}
Harga vs SMA-20: ${parseFloat(latest.close) > sma20 ? "ABOVE" : "BELOW"}
5 Candle Terakhir: ${JSON.stringify(recentCandles)}`;
}

// ==========================================
// Gemini AI Analysis
// ==========================================

/**
 * Kirim data klines ke Gemini dan minta analisis terstruktur.
 */
async function analyzeWithGemini(
  symbol: string,
  klineDataList: KlineData[]
): Promise<AnalysisResult> {
  const summaries = klineDataList
    .map((k) => summarizeKlines(k))
    .filter(Boolean)
    .join("\n\n---\n");

  const timeframesAnalyzed = klineDataList.map((k) => k.timeframe);

  const prompt = `Kamu adalah analis teknikal crypto profesional. Analisis data candlestick berikut untuk koin ${symbol} dari Binance Thailand (.th) dan berikan rekomendasi trading scalping.

DATA CANDLESTICK MULTI-TIMEFRAME:
${summaries}

TUGAS:
Berikan analisis teknikal singkat dan rekomendasi apakah sebaiknya BELI atau JANGAN BELI sekarang.

ATURAN RESPONS:
1. Respons HARUS berupa JSON valid, tidak ada teks lain di luar JSON
2. Gunakan format persis seperti berikut:
{
  "keputusan": "BELI" atau "JANGAN BELI",
  "alasan": "Penjelasan singkat 2-3 kalimat dalam Bahasa Indonesia tentang alasan keputusan",
  "indikator": {
    "trend": "BULLISH / BEARISH / SIDEWAYS",
    "momentum": "KUAT / LEMAH / NETRAL",
    "volume": "TINGGI / RENDAH / NORMAL",
    "support_resistance": "Dekat support / Dekat resistance / Di tengah range"
  }
}

Fokus pada: trend multi-timeframe, posisi harga terhadap SMA, momentum volume, dan pola candlestick terbaru.`;

  const response = await genAI.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      temperature: 0.3, // Low temperature for consistent structured output
      maxOutputTokens: 1024,
    },
  });

  const rawText =
    response.text?.trim().replace(/```json\n?|\n?```/g, "") || "";

  try {
    const parsed = JSON.parse(rawText);
    return {
      ...parsed,
      timeframes_analyzed: timeframesAnalyzed,
      analyzed_at: new Date().toISOString(),
    } as AnalysisResult;
  } catch {
    // Fallback jika Gemini tidak mengembalikan JSON valid
    console.error("Gemini non-JSON response:", rawText);
    return {
      keputusan: "JANGAN BELI",
      alasan:
        "Analisis tidak dapat diselesaikan saat ini. Pastikan data pasar tersedia dan coba lagi.",
      indikator: {
        trend: "TIDAK DIKETAHUI",
        momentum: "TIDAK DIKETAHUI",
        volume: "TIDAK DIKETAHUI",
        support_resistance: "TIDAK DIKETAHUI",
      },
      timeframes_analyzed: timeframesAnalyzed,
      analyzed_at: new Date().toISOString(),
    };
  }
}

// ==========================================
// API Route Handler
// ==========================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { symbol } = body;

    if (!symbol || typeof symbol !== "string") {
      return NextResponse.json(
        { success: false, error: "Symbol wajib diisi. Contoh: BTCTHB" },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "GEMINI_API_KEY belum dikonfigurasi" },
        { status: 500 }
      );
    }

    // Fetch multi-timeframe klines secara paralel
    const [klines1h, klines4h] = await Promise.all([
      fetchKlines(symbol, "1h", 50),
      fetchKlines(symbol, "4h", 30),
    ]);

    const validKlines = [klines1h, klines4h].filter(
      (k): k is KlineData => k !== null
    );

    if (validKlines.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Tidak dapat mengambil data untuk symbol ${symbol.toUpperCase()}. Pastikan symbol valid di Binance .th (contoh: BTCTHB, ETHTHB)`,
        },
        { status: 422 }
      );
    }

    // Analisis dengan Gemini
    const analysis = await analyzeWithGemini(symbol, validKlines);

    return NextResponse.json({ success: true, data: analysis });
  } catch (error) {
    console.error("Analyze API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Terjadi kesalahan server. Silakan coba lagi.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Crypto Scalping Assistant — AI Analyze API",
    version: "2.0.0",
    endpoints: {
      POST: "{ symbol: 'BTCTHB' } → { keputusan, alasan, indikator }",
    },
  });
}
