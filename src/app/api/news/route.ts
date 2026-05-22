import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { Groq } from "groq-sdk";

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

export const maxDuration = 60; // Allow enough time for AI response

export async function GET() {
  const prompt = `Anda adalah analis ahli berita dan pasar kripto. Berikan ringkasan sentimen pasar kripto hari ini beserta insight makro ekonomi terkini yang berpotensi memengaruhi pergerakan pasar (khususnya untuk BTC, ETH, dan altcoin utama).

Aturan penulisan:
1. Buat ke dalam 3-4 poin-poin (bullet points) ringkas atau paragraf pendek yang sangat mudah dicerna.
2. Gunakan bahasa Indonesia yang profesional, elegan, namun mudah dimengerti.
3. Informasinya bersifat gambaran umum pasar saat ini (bullish/bearish/katalis makro) secara makro.
4. Gunakan sintaks Markdown untuk mempercantik teks (misalnya huruf tebal untuk kata kunci).
5. Jangan gunakan peringatan disclaimer panjang di akhir, langsung to the point pada analisisnya.`;

  let responseText = "";

  try {
    const response = await getGenAI().models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });
    responseText = response.text || "";
  } catch (error: any) {
    console.error("News Generation Error with Gemini:", error);
    const msg = error?.message || "";
    if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("503")) {
      try {
        console.warn("Gemini limit reached in News generation, falling back to Groq...");
        const chatCompletion = await getGroq().chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.3-70b-versatile",
          temperature: 0.7,
          max_completion_tokens: 1024,
        });
        responseText = chatCompletion.choices[0]?.message?.content || "";
      } catch (groqErr) {
        console.error("Groq fallback failed:", groqErr);
        return NextResponse.json(
          { success: false, error: "Gagal mengambil berita pasar terkini via fallback." },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: error.message || "Gagal mengambil berita pasar terkini." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true, data: responseText });
}
