import { NextResponse } from "next/server";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// ==========================================
// Helper: Send Telegram message
// ==========================================
async function sendTelegramMessage(text: string, parseMode = "Markdown") {
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: parseMode,
    }),
  });
  return res.json();
}

// ==========================================
// POST /api/test-telegram
// Body: { type: "alert" | "warning" | "info" }
// ==========================================
export async function POST(req: Request) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return NextResponse.json(
      { success: false, error: "TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID belum diisi di .env.local" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const type: string = body.type || "alert";

    let message = "";

    if (type === "alert") {
      // Simulasi alert profit tercapai
      message = [
        `🚀 *TARGET PROFIT TERCAPAI!*`,
        ``,
        `📊 *Symbol:* \`BTCTHB\``,
        `💰 *Harga Beli:* \`2.000.000,00\``,
        `🎯 *Target Jual:* \`2.100.000,00\``,
        `📈 *Harga Saat Ini:* \`2.105.230,00\``,
        `✅ *Profit:* \`+5.26%\``,
        ``,
        `⏰ ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`,
        ``,
        `_Ini adalah pesan TEST dari Crypto Scalping Assistant_`,
      ].join("\n");
    } else if (type === "warning") {
      // Simulasi peringatan harga turun
      message = [
        `⚠️ *PERINGATAN HARGA TURUN*`,
        ``,
        `📊 *Symbol:* \`ETHTHB\``,
        `💰 *Harga Beli:* \`95.000,00\``,
        `📉 *Harga Saat Ini:* \`92.000,00\``,
        `🔴 *Perubahan:* \`-3.16%\``,
        ``,
        `Harga sedang di bawah harga beli kamu.`,
        `Pertimbangkan untuk evaluasi posisi.`,
        ``,
        `⏰ ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`,
        ``,
        `_Ini adalah pesan TEST dari Crypto Scalping Assistant_`,
      ].join("\n");
    } else {
      // Info / koneksi
      message = [
        `ℹ️ *Crypto Scalping Assistant — Aktif!*`,
        ``,
        `✅ Bot Telegram berhasil terhubung`,
        `✅ Background Worker siap memantau harga`,
        `✅ Notifikasi akan dikirim saat target profit 5% tercapai`,
        ``,
        `📡 Binance .th WebSocket: *Terhubung*`,
        `🗄️ Supabase Database: *Tersinkron*`,
        ``,
        `⏰ ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`,
        ``,
        `_Ini adalah pesan TEST dari Crypto Scalping Assistant_`,
      ].join("\n");
    }

    const result = await sendTelegramMessage(message);

    if (result.ok) {
      return NextResponse.json({
        success: true,
        message: `Pesan test "${type}" berhasil dikirim ke Telegram!`,
        telegram_message_id: result.result?.message_id,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: `Telegram API error: ${result.description}`,
          error_code: result.error_code,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Server error: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// ==========================================
// GET /api/test-telegram — Cek status bot
// ==========================================
export async function GET() {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({
      success: false,
      configured: false,
      error: "TELEGRAM_BOT_TOKEN belum dikonfigurasi",
    });
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/getMe`);
    const data = await res.json();

    return NextResponse.json({
      success: data.ok,
      configured: true,
      chat_id_set: !!TELEGRAM_CHAT_ID,
      bot: data.ok
        ? {
            name: data.result.first_name,
            username: `@${data.result.username}`,
            id: data.result.id,
          }
        : null,
      error: data.ok ? null : data.description,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      configured: true,
      error: `Koneksi gagal: ${(error as Error).message}`,
    });
  }
}
