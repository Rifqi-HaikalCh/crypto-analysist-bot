/**
 * ==========================================
 * AI Crypto Scalping Assistant
 * Background Worker — Binance WSS Price Monitor & Telegram Notifier
 * ==========================================
 *
 * Worker Node.js mandiri yang berjalan 24/7.
 *
 * Alur kerja:
 * 1. Ambil semua target 'active' dari Supabase (via service_role key, bypass RLS)
 * 2. Buka koneksi WebSocket ke Binance .th untuk memantau harga real-time
 * 3. Jika harga >= target_price → kirim notifikasi Telegram
 * 4. Update status target di Supabase menjadi 'completed'
 * 5. Polling Supabase setiap 30 detik untuk target baru
 *
 * Jalankan: node worker/index.js
 */

require("dotenv").config({ path: ".env.local" });
const WebSocket = require("ws");
const { createClient } = require("@supabase/supabase-js");

// ==========================================
// Environment Variables
// ==========================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const BINANCE_WSS_GLOBAL = process.env.BINANCE_WSS_GLOBAL || "wss://www.binance.th/gstream";
const BINANCE_WSS_SITE = process.env.BINANCE_WSS_SITE || "wss://www.binance.th/nstream";
const BINANCE_API_URL = process.env.BINANCE_API_URL || "https://api.binance.th";

// Validation
const requiredEnvs = { SUPABASE_URL, SUPABASE_SERVICE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID };
for (const [name, value] of Object.entries(requiredEnvs)) {
  if (!value) {
    console.error(`❌ Missing env variable: ${name}`);
    process.exit(1);
  }
}

// ==========================================
// Supabase Client (Service Role — bypass RLS)
// ==========================================

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ==========================================
// State Management
// ==========================================

/** @type {Map<string, {id: string, user_id: string, symbol: string, entry_price: number, target_price: number}>} */
const activeTargets = new Map(); // id -> target
const subscribedSymbols = new Set(); // Set of lowercase symbols currently subscribed
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 50;
const RECONNECT_DELAY_BASE = 3000; // 3 seconds base, exponential backoff

// ==========================================
// Telegram Notification
// ==========================================

/**
 * Kirim notifikasi ke Telegram saat target profit tercapai.
 */
async function sendTelegramNotification(target, currentPrice) {
  const profitPercent = (((currentPrice - target.entry_price) / target.entry_price) * 100).toFixed(2);
  const message = [
    `🚀 *TARGET PROFIT TERCAPAI!*`,
    ``,
    `📊 *Symbol:* \`${target.symbol}\``,
    `💰 *Harga Beli:* \`${formatNumber(target.entry_price)}\``,
    `🎯 *Target Jual:* \`${formatNumber(target.target_price)}\``,
    `📈 *Harga Saat Ini:* \`${formatNumber(currentPrice)}\``,
    `✅ *Profit:* \`+${profitPercent}%\``,
    ``,
    `⏰ ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`,
  ].join("\n");

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    const result = await response.json();
    if (result.ok) {
      console.log(`✅ Telegram sent for ${target.symbol} (profit: +${profitPercent}%)`);
    } else {
      console.error(`❌ Telegram error:`, result.description);
    }
  } catch (error) {
    console.error(`❌ Telegram send failed:`, error.message);
  }
}

// ==========================================
// Supabase Operations
// ==========================================

/**
 * Ambil semua target 'active' dari Supabase.
 * Menggunakan service_role key sehingga bypass RLS — bisa baca semua user.
 */
async function fetchActiveTargets() {
  const { data, error } = await supabase
    .from("scalping_targets")
    .select("*")
    .eq("status", "active");

  if (error) {
    console.error("❌ Supabase fetch error:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Update status target menjadi 'completed' setelah notifikasi terkirim.
 */
async function markTargetCompleted(targetId) {
  const { error } = await supabase
    .from("scalping_targets")
    .update({ status: "completed" })
    .eq("id", targetId);

  if (error) {
    console.error(`❌ Failed to update target ${targetId}:`, error.message);
    return false;
  }
  return true;
}

// ==========================================
// Symbol Type Detection
// ==========================================

/**
 * Cek apakah symbol bertipe GLOBAL atau SITE untuk menentukan WSS endpoint.
 * Default ke GLOBAL jika API gagal.
 */
async function getSymbolTypes(symbols) {
  const typeMap = {};
  try {
    const response = await fetch(`${BINANCE_API_URL}/api/v1/exchangeInfo`);
    const data = await response.json();

    if (data.symbols) {
      for (const s of data.symbols) {
        if (symbols.includes(s.symbol)) {
          typeMap[s.symbol] = s.type || "GLOBAL";
        }
      }
    }
  } catch (error) {
    console.warn("⚠️ Failed to fetch symbol types, defaulting to GLOBAL:", error.message);
  }

  // Default unresolved symbols to GLOBAL
  for (const sym of symbols) {
    if (!typeMap[sym]) {
      typeMap[sym] = "GLOBAL";
    }
  }

  return typeMap;
}

// ==========================================
// WebSocket Price Monitor
// ==========================================

/**
 * Proses update harga dari WebSocket stream.
 * Jika harga >= target_price, kirim Telegram & mark completed.
 */
async function handlePriceUpdate(symbol, currentPrice) {
  // Cari semua active targets yang match symbol ini
  for (const [id, target] of activeTargets.entries()) {
    if (target.symbol === symbol.toUpperCase() && currentPrice >= target.target_price) {
      console.log(`🎯 Target hit! ${target.symbol}: ${currentPrice} >= ${target.target_price}`);

      // Kirim notifikasi Telegram
      await sendTelegramNotification(target, currentPrice);

      // Mark sebagai completed di Supabase
      const updated = await markTargetCompleted(id);
      if (updated) {
        activeTargets.delete(id);
        console.log(`✅ Target ${target.symbol} (${id}) marked completed`);
      }
    }
  }
}

/**
 * Bangun koneksi WebSocket ke Binance .th
 * Menggunakan combined stream untuk subscribe multiple symbols sekaligus.
 */
function connectWebSocket(symbols, wssBase) {
  if (symbols.length === 0) {
    console.log("ℹ️  No symbols to subscribe, skipping WebSocket connection");
    return;
  }

  // Format: symbol@miniTicker (lightweight price updates)
  const streams = symbols.map((s) => `${s.toLowerCase()}@miniTicker`).join("/");
  const wsUrl = `${wssBase}?streams=${streams}`;

  console.log(`🔌 Connecting to WebSocket: ${wssBase}`);
  console.log(`📡 Subscribing to: ${symbols.join(", ")}`);

  ws = new WebSocket(wsUrl);

  ws.on("open", () => {
    console.log("✅ WebSocket connected!");
    reconnectAttempts = 0;
  });

  ws.on("message", async (rawData) => {
    try {
      const message = JSON.parse(rawData.toString());
      // Combined stream format: { stream: "btcthb@miniTicker", data: { s: "BTCTHB", c: "2500000.00", ... } }
      const data = message.data;
      if (data && data.s && data.c) {
        const symbol = data.s.toUpperCase();
        const currentPrice = parseFloat(data.c); // "c" = close price (last price)
        await handlePriceUpdate(symbol, currentPrice);
      }
    } catch (error) {
      // Ignore parse errors (ping/pong frames)
    }
  });

  ws.on("ping", () => {
    ws.pong();
  });

  ws.on("close", (code, reason) => {
    console.warn(`⚠️ WebSocket disconnected (code: ${code}). Reconnecting...`);
    scheduleReconnect();
  });

  ws.on("error", (error) => {
    console.error("❌ WebSocket error:", error.message);
  });
}

/**
 * Reconnect dengan exponential backoff.
 */
function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error("❌ Max reconnect attempts reached. Exiting...");
    process.exit(1);
  }

  const delay = Math.min(RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttempts), 60000);
  reconnectAttempts++;
  console.log(`🔄 Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

  setTimeout(() => {
    refreshAndReconnect();
  }, delay);
}

// ==========================================
// Main Loop
// ==========================================

/**
 * Refresh targets dari Supabase dan reconnect WebSocket jika symbols berubah.
 */
async function refreshAndReconnect() {
  const targets = await fetchActiveTargets();

  // Update activeTargets map
  activeTargets.clear();
  for (const target of targets) {
    activeTargets.set(target.id, target);
  }

  // Get unique symbols
  const symbols = [...new Set(targets.map((t) => t.symbol))];
  const symbolsKey = symbols.sort().join(",");
  const currentKey = [...subscribedSymbols].sort().join(",");

  // Reconnect jika symbols berubah
  if (symbolsKey !== currentKey) {
    subscribedSymbols.clear();
    symbols.forEach((s) => subscribedSymbols.add(s));

    // Close existing connection
    if (ws) {
      ws.removeAllListeners();
      ws.close();
      ws = null;
    }

    if (symbols.length > 0) {
      // Determine WSS endpoint per symbol type
      const symbolTypes = await getSymbolTypes(symbols);

      const globalSymbols = symbols.filter((s) => symbolTypes[s] === "GLOBAL");
      const siteSymbols = symbols.filter((s) => symbolTypes[s] === "SITE");

      // Connect to appropriate endpoints
      if (globalSymbols.length > 0) {
        connectWebSocket(globalSymbols, BINANCE_WSS_GLOBAL);
      }
      if (siteSymbols.length > 0) {
        connectWebSocket(siteSymbols, BINANCE_WSS_SITE);
      }
    } else {
      console.log("ℹ️  No active targets found. Waiting for new targets...");
    }
  }

  console.log(`📊 Active targets: ${activeTargets.size} | Symbols: ${symbols.join(", ") || "(none)"}`);
}

/**
 * Polling loop — cek Supabase setiap 30 detik untuk target baru.
 */
async function startPollingLoop() {
  console.log("🔄 Starting polling loop (every 30s)...");
  setInterval(async () => {
    try {
      await refreshAndReconnect();
    } catch (error) {
      console.error("❌ Polling error:", error.message);
    }
  }, 30_000);
}

// ==========================================
// Helpers
// ==========================================

function formatNumber(num) {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function printBanner() {
  console.log(`
╔══════════════════════════════════════════════╗
║  🚀 Crypto Scalping Worker — 24/7 Monitor   ║
║  Binance .th | Telegram Alert | Supabase    ║
╚══════════════════════════════════════════════╝
  `);
  console.log(`📌 Supabase URL: ${SUPABASE_URL}`);
  console.log(`📌 Binance WSS Global: ${BINANCE_WSS_GLOBAL}`);
  console.log(`📌 Binance WSS Site: ${BINANCE_WSS_SITE}`);
  console.log(`📌 Telegram Chat ID: ${TELEGRAM_CHAT_ID}`);
  console.log("");
}

// ==========================================
// Graceful Shutdown
// ==========================================

function setupGracefulShutdown() {
  const shutdown = (signal) => {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    if (ws) {
      ws.close();
    }
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// ==========================================
// Entry Point
// ==========================================

async function main() {
  printBanner();
  setupGracefulShutdown();

  // Initial load
  await refreshAndReconnect();

  // Start polling for new targets
  await startPollingLoop();
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
