import { NextResponse } from "next/server";
import { Groq } from "groq-sdk";

function getGroq() {
  return new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });
}

export const maxDuration = 30; // Max execution time 30s
export const revalidate = 3600; // Cache for 1 hour

export async function GET() {
  try {
    const prompt = `Anda adalah analis pasar kripto spesialis AI. Analisis pergerakan harga hari ini secara makro dan prediksi arah tren jangka pendek (hari ini/besok) untuk 5 aset kripto utama: BTC, ETH, SOL, BNB, dan XRP.

TUGAS:
Hasilkan respons HANYA DALAM FORMAT JSON array seperti contoh berikut tanpa teks tambahan apa pun:
[
  { "symbol": "BTC", "trend": "UP", "message": "Inflow ETF positif dan break resistensi $70k" },
  { "symbol": "ETH", "trend": "DOWN", "message": "Koreksi wajar pasca upgrade Dencun" }
]

ATURAN:
1. 'trend' HARUS bernilai "UP" atau "DOWN".
2. 'message' maksimal 6-8 kata, jelas, dan berbahasa Indonesia.
3. Wajib memuat kelima koin tersebut.`;

    const chatCompletion = await getGroq().chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      response_format: { type: "json_object" }, // Walaupun kita minta array, kita pakai json mode agar tidak melenceng.
    });

    let rawText = chatCompletion.choices[0]?.message?.content || "[]";
    
    // Karena response_format JSON_OBJECT di Groq mengharuskan root berupa object,
    // kita sesuaikan prompt untuk mengembalikan object `{ "data": [...] }` jika gagal parse array.
    // Tetapi Llama3 cukup pintar, kita parse saja manual.
    // Untuk amannya, kita ekstrak isi array dari rawText:
    const match = rawText.match(/\[([\s\S]*?)\]/);
    if (match) {
        rawText = `[${match[1]}]`;
    }

    const data = JSON.parse(rawText);
    
    // Validasi format
    if (!Array.isArray(data)) {
        throw new Error("Invalid format returned by AI.");
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Trends API Error:", error);
    // Fallback static data jika gagal (tetap membantu UX)
    const fallbackData = [
      { symbol: "BTC", trend: "UP", message: "Menunggu penembusan resistensi psikologis baru" },
      { symbol: "ETH", trend: "UP", message: "Momentum layer-2 menopang pergerakan naik" },
      { symbol: "SOL", trend: "UP", message: "Aktivitas DEX dan Meme memuncak" },
      { symbol: "BNB", trend: "DOWN", message: "Konsolidasi pasca lonjakan launchpool" },
      { symbol: "XRP", trend: "DOWN", message: "Sideways menunggu kejelasan regulasi lanjutan" }
    ];
    return NextResponse.json({ success: false, data: fallbackData });
  }
}
