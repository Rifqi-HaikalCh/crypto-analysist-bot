import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { Groq } from "groq-sdk";

// ==========================================
// Lazy AI Clients (instantiated at request time, not build time)
// ==========================================

function getGenAI() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
    vertexai: false,
  });
}

function getGroq() {
  return new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });
}

const BINANCE_API_URL = process.env.BINANCE_API_URL || "https://api.binance.th";
// Model: gunakan gemini-2.5-flash (lebih hemat quota) atau gemini-2.0-flash
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// ==========================================
// Type Definitions
// ==========================================

export type AnalysisResult = {
  keputusan: "BELI" | "JANGAN BELI" | "NAIK" | "TURUN";
  alasan: string;
  analisis_mendalam: string;
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
  klineDataList: KlineData[],
  analysisType: "scalping" | "watchlist"
): Promise<AnalysisResult> {
  const summaries = klineDataList
    .map((k) => summarizeKlines(k))
    .filter(Boolean)
    .join("\n\n---\n");

  const timeframesAnalyzed = klineDataList.map((k) => k.timeframe);

  const isScalping = analysisType === "scalping";
  const taskDescription = isScalping
    ? "Kamu sedang menganalisis aset yang SUDAH DITARGETKAN/DIBELI. Prediksi tren ke depan apakah akan NAIK atau TURUN agar pemain tahu apa yang harus diantisipasi."
    : "Berikan analisis teknikal singkat dan rekomendasi apakah sebaiknya BELI atau JANGAN BELI sekarang.";
    
  const decisionEnum = isScalping ? '"NAIK" atau "TURUN"' : '"BELI" atau "JANGAN BELI"';

  const prompt = `Kamu adalah analis teknikal crypto profesional. Analisis data candlestick berikut untuk koin ${symbol} dari Binance Thailand (.th).

DATA CANDLESTICK MULTI-TIMEFRAME:
${summaries}

TUGAS:
${taskDescription}

PENTING: Meskipun data terbatas, kamu WAJIB memberikan tebakan terbaik (best effort) dan JANGAN PERNAH menolak untuk menganalisis.

ATURAN RESPONS:
1. Respons HARUS berupa JSON valid, tidak ada teks lain di luar JSON
2. Gunakan format persis seperti berikut:
{
  "keputusan": ${decisionEnum},
  "alasan": "Penjelasan singkat 2-3 kalimat dalam Bahasa Indonesia tentang alasan keputusan utama",
  "analisis_mendalam": "1 Paragraf penjelasan mendalam (3-5 kalimat) yang menganalisis arah trend, kekuatan momentum, area support/resistance, dan memberikan pandangan strategis. Berikan analisis terbaikmu meskipun data terbatas."
}

Fokus pada: trend multi-timeframe, posisi harga terhadap SMA, momentum volume, dan pola candlestick terbaru. Jika data tidak lengkap, gunakan wawasan naratif/umum pasar kripto terkini.`;

  // Try with primary model, fallback to gemini-2.5-flash if rate limited
  let response;
  try {
    response = await getGenAI().models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    });
  } catch (primaryErr: unknown) {
    const msg = (primaryErr as Error).message || "";
    if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("503")) {
      try {
        console.warn("Gemini limit reached in analyzeWithGemini, falling back to Groq...");
        const chatCompletion = await getGroq().chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.3-70b-versatile",
          temperature: 0.3,
          max_completion_tokens: 1024,
        });
        response = { text: chatCompletion.choices[0]?.message?.content || "" };
      } catch (groqErr) {
        console.error("Groq fallback failed:", groqErr);
        throw primaryErr;
      }
    } else {
      throw primaryErr;
    }
  }

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
      keputusan: analysisType === "scalping" ? "TURUN" : "JANGAN BELI",
      alasan:
        "Terjadi anomali saat menarik data pasar. Pergerakan saat ini tidak dapat divalidasi dengan pasti.",
      analisis_mendalam: "Sistem tidak mendapatkan respons yang optimal dari mesin analisis. Secara umum, sangat disarankan untuk menunggu terbentuknya pola harga yang lebih jelas atau periksa likuiditas pasar secara manual sebelum mengambil tindakan.",
      timeframes_analyzed: timeframesAnalyzed,
      analyzed_at: new Date().toISOString(),
    };
  }
}

// ==========================================
// DexScreener Analysis (non-candlestick)
// ==========================================

type DexMetrics = {
  symbol: string;
  priceUsd: number;
  priceChange: { m5: number; h1: number; h6: number; h24: number };
  volume24h: number;
  liquidityUsd: number;
  fdv: number;
  chainId: string;
  pairUrl: string;
};

async function fetchDexMetrics(contractAddress: string): Promise<DexMetrics | null> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${contractAddress.toLowerCase()}`,
      { next: { revalidate: 15 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const pairs = data.pairs || [];
    if (!pairs.length) return null;
    // Best pair: highest liquidity
    const best = [...pairs].sort(
      (a: { liquidity?: { usd?: number } }, b: { liquidity?: { usd?: number } }) =>
        (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
    )[0];
    return {
      symbol: best.baseToken.symbol,
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
      chainId: best.chainId,
      pairUrl: best.url,
    };
  } catch {
    return null;
  }
}

async function analyzeWithGeminiDex(
  metrics: DexMetrics,
  analysisType: "scalping" | "watchlist"
): Promise<AnalysisResult> {
  const riskLevel =
    metrics.liquidityUsd < 50_000
      ? "SANGAT TINGGI (likuiditas < $50K)"
      : metrics.liquidityUsd < 200_000
      ? "TINGGI (likuiditas < $200K)"
      : metrics.liquidityUsd < 1_000_000
      ? "SEDANG (likuiditas < $1M)"
      : "RENDAH (likuiditas > $1M)";

  const isScalping = analysisType === "scalping";
  const taskDescription = isScalping
    ? "Kamu sedang menganalisis aset yang SUDAH DITARGETKAN. Prediksi tren ke depan apakah akan NAIK atau TURUN agar pemain tahu apa yang harus diantisipasi."
    : "Evaluasi momentum harga, volume, dan likuiditas untuk menentukan apakah ini saat tepat untuk BELI atau JANGAN BELI sekarang.";
  
  const decisionEnum = isScalping ? '"NAIK" atau "TURUN"' : '"BELI" atau "JANGAN BELI"';

  const prompt = `Kamu adalah analis kripto profesional yang spesialis pada token DeFi dan meme coin. 
Analisis data pasar berikut.

DATA TOKEN DEXSCREENER:
Symbol: ${metrics.symbol}
Chain: ${metrics.chainId}
Harga USD: $${metrics.priceUsd.toFixed(8)}

PERUBAHAN HARGA:
• 5 menit: ${metrics.priceChange.m5 > 0 ? '+' : ''}${metrics.priceChange.m5.toFixed(2)}%
• 1 jam: ${metrics.priceChange.h1 > 0 ? '+' : ''}${metrics.priceChange.h1.toFixed(2)}%
• 6 jam: ${metrics.priceChange.h6 > 0 ? '+' : ''}${metrics.priceChange.h6.toFixed(2)}%
• 24 jam: ${metrics.priceChange.h24 > 0 ? '+' : ''}${metrics.priceChange.h24.toFixed(2)}%

DATA PASAR:
• Volume 24 jam: $${metrics.volume24h.toLocaleString('en-US', { maximumFractionDigits: 0 })}
• Likuiditas Total: $${metrics.liquidityUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
• FDV: $${metrics.fdv.toLocaleString('en-US', { maximumFractionDigits: 0 })}
• Tingkat Risiko: ${riskLevel}

TUGAS UTAMA:
${taskDescription}

PENTING: Meskipun data DEX terbatas, kurang lengkap, atau berisiko tinggi, kamu DILARANG MERESPONS "Data tidak mencukupi" atau "Analisis tidak dapat diselesaikan". Kamu WAJIB mengambil kesimpulan prediksi (best effort) berdasarkan data yang ada dipadukan dengan wawasan tentang kondisi market DeFi saat ini.

PERHATIAN KHUSUS:
- Likuiditas rendah = slippage tinggi, volatilitas ekstrem, risiko rug pull
- Volume rendah = sulit untuk keluar posisi
- Perubahan 5m & 1h mencerminkan momentum jangka pendek

ATURAN RESPONS:
1. Respons HARUS berupa JSON valid saja, tanpa teks lain
2. Format persis:
{
  "keputusan": ${decisionEnum},
  "alasan": "Penjelasan 2-3 kalimat dalam Bahasa Indonesia",
  "analisis_mendalam": "1 Paragraf penjelasan mendalam (3-5 kalimat) yang menganalisis momentum 5m/1h, membandingkan volume terhadap likuiditas, dan risiko pergerakan harga. Ingat, berikan analisis terbaikmu dan hindari alasan 'data kurang'!"
}`;

  let response;
  try {
    response = await getGenAI().models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { temperature: 0.3, maxOutputTokens: 1024 },
    });
  } catch (err: unknown) {
    const msg = (err as Error).message || "";
    if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("503")) {
      try {
        console.warn("Gemini limit reached in analyzeWithGeminiDex, falling back to Groq...");
        const chatCompletion = await getGroq().chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.3-70b-versatile",
          temperature: 0.3,
          max_completion_tokens: 1024,
        });
        response = { text: chatCompletion.choices[0]?.message?.content || "" };
      } catch (groqErr) {
        console.error("Groq fallback failed:", groqErr);
        throw err;
      }
    } else {
      throw err;
    }
  }

  const rawText = response.text?.trim().replace(/```json\n?|\n?```/g, "") || "";
  try {
    const parsed = JSON.parse(rawText);
    return {
      ...parsed,
      timeframes_analyzed: ["5m", "1h", "6h", "24h"],
      analyzed_at: new Date().toISOString(),
    } as AnalysisResult;
  } catch {
    return {
      keputusan: analysisType === "scalping" ? "TURUN" : "JANGAN BELI",
      alasan: "Data DexScreener saat ini terlalu fluktuatif untuk dikonfirmasi secara aman.",
      analisis_mendalam: "Volume dan likuiditas tidak dapat diproses secara sempurna oleh mesin analisis pada siklus ini. Pada lingkungan DEX (terutama meme coin), ini sering kali menjadi pertanda likuiditas tipis atau pergerakan anomali. Tetap waspada terhadap risiko slippage besar atau rug pull.",
      timeframes_analyzed: ["24h", "6h", "1h", "5m"],
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
    const { symbol, contractAddress, dataSource, analysisType = "watchlist" } = body;
    const isDex = dataSource === "DEXSCREENER" && contractAddress;

    if (!isDex && (!symbol || typeof symbol !== "string")) {
      return NextResponse.json(
        { success: false, error: "Symbol wajib diisi. Contoh: BTCTHB" },
        { status: 400 }
      );
    }
    if (isDex && !contractAddress) {
      return NextResponse.json(
        { success: false, error: "Contract address wajib untuk analisis DexScreener." },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "GEMINI_API_KEY belum dikonfigurasi" },
        { status: 500 }
      );
    }

    // ==========================================
    // Branch: DEXSCREENER analysis
    // ==========================================
    if (isDex) {
      const metrics = await fetchDexMetrics(contractAddress);
      if (!metrics) {
        return NextResponse.json(
          {
            success: false,
            error: `Tidak dapat mengambil data DexScreener untuk contract: ${contractAddress}. Periksa address dan coba lagi.`,
          },
          { status: 422 }
        );
      }
      const analysis = await analyzeWithGeminiDex(metrics, analysisType);
      return NextResponse.json({
        success: true,
        data: analysis,
        meta: { source: "DEXSCREENER", symbol: metrics.symbol, priceUsd: metrics.priceUsd },
      });
    }

    // ==========================================
    // Branch: BINANCE candlestick analysis
    // ==========================================
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

    const analysis = await analyzeWithGemini(symbol, validKlines, analysisType);
    return NextResponse.json({
      success: true,
      data: analysis,
      meta: { source: "BINANCE", symbol: symbol.toUpperCase() },
    });
  } catch (error) {
    console.error("Analyze API error:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan server. Silakan coba lagi." },
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
