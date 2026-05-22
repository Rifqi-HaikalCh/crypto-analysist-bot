/**
 * ==========================================
 * AI Crypto Scalping Assistant
 * Background Worker v2 — Hybrid: Binance WSS + DexScreener Polling
 * ==========================================
 *
 * Dual-loop architecture:
 * Loop A: Binance.th WebSocket → real-time harga untuk BINANCE targets
 * Loop B: DexScreener REST polling (12 detik) → harga USD × kurs IDR → DEXSCREENER targets
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
const BINANCE_GLOBAL_API = "https://api.binance.com"; // for USDT/IDR rate

// DEX polling interval
const DEX_POLL_INTERVAL_MS = 12_000; // 12 detik
const RATE_REFRESH_INTERVAL_MS = 60_000; // refresh kurs IDR setiap 60 detik
const SUPABASE_POLL_INTERVAL_MS = 30_000; // cek target baru setiap 30 detik

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

/** @type {Map<string, object>} */
const activeTargets = new Map(); // id -> target (all)
const subscribedBinanceSymbols = new Set();

let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 50;
const RECONNECT_DELAY_BASE = 3000;

// Current IDR/THB rates
let usdtIdrRate = 16200; // fallback
let usdtThbRate = 33.5;  // fallback

// ==========================================
// Helpers
// ==========================================

function formatNumber(num) {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatIdr(num) {
  return `Rp${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)}`;
}

// ==========================================
// Telegram Voice Call (CallMeBot)
// ==========================================

async function makeTelegramVoiceCall(symbol) {
  const username = "@rifqichh";
  const text = encodeURIComponent(`Alarm Kripto! Target profit untuk koin ${symbol} telah tercapai. Segera cek aplikasi anda!`);
  const url = `https://api.callmebot.com/start.php?user=${username}&text=${text}&lang=id-ID-Standard-A`;
  
  try {
    console.log(`📞 Memanggil Telegram ${username} via CallMeBot...`);
    const res = await fetch(url);
    if (res.ok) {
       console.log(`✅ Panggilan telepon berhasil diinisiasi ke ${username}`);
    } else {
       console.error(`❌ Gagal menginisiasi panggilan telepon. Status: ${res.status}`);
    }
  } catch (error) {
    console.error(`❌ Error CallMeBot: ${error.message}`);
  }
}

// ==========================================
// Telegram Notification
// ==========================================

async function sendTelegramNotification(target, currentPrice, sourceName = "Binance") {
  const profitPercent = (((currentPrice - target.entry_price) / target.entry_price) * 100).toFixed(2);
  const isDex = target.data_source === "DEXSCREENER";

  const message = [
    `🚀 *TARGET PROFIT TERCAPAI!*`,
    ``,
    `📊 *Aset:* ${target.asset_name ? `${target.asset_name} (${target.symbol})` : `\`${target.symbol}\``}`,
    isDex
      ? `🔗 *Sumber:* DexScreener · ${target.chain_id || "DEX"}`
      : `⚡ *Sumber:* Binance.th`,
    ``,
    `💰 *Harga Masuk:* \`${isDex ? formatIdr(target.entry_price) : formatNumber(target.entry_price)}\``,
    `🎯 *Target Jual:* \`${isDex ? formatIdr(target.target_price) : formatNumber(target.target_price)}\``,
    `📈 *Harga Sekarang:* \`${isDex ? formatIdr(currentPrice) : formatNumber(currentPrice)}\``,
    `✅ *Profit:* \`+${profitPercent}%\``,
    isDex ? `💱 *Kurs USDT/IDR:* Rp${formatNumber(usdtIdrRate)}` : "",
    ``,
    `⏰ ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`,
  ].filter((l) => l !== "").join("\n");

  const chatId = target.telegram_chat_id || TELEGRAM_CHAT_ID;
  if (!chatId) {
    console.warn(`⚠️ Target ${target.symbol} tidak memiliki telegram_chat_id, skip notifikasi.`);
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "Markdown" }),
    });
    const result = await response.json();
    if (result.ok) {
      console.log(`✅ Telegram sent for ${target.symbol} (+${profitPercent}%) via ${sourceName}`);
      
      // Pengecekan waktu malam hari (18:00 - 05:59 WIB)
      const jakartaHour = parseInt(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: "numeric", hourCycle: "h23" }),
        10
      );
      
      if (jakartaHour >= 18 || jakartaHour < 6) {
        console.log(`🌙 Waktu menunjukkan jam ${jakartaHour}:00 WIB. Mengaktifkan panggilan alarm malam hari...`);
        await makeTelegramVoiceCall(target.symbol);
      }
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
// Rate Fetcher (USDT/IDR from Binance.com)
// ==========================================

async function refreshRates() {
  try {
    const [idrRes, thbRes] = await Promise.all([
      fetch(`${BINANCE_GLOBAL_API}/api/v3/ticker/price?symbol=USDTIDR`),
      fetch(`${BINANCE_GLOBAL_API}/api/v3/ticker/price?symbol=USDTTHB`),
    ]);

    if (idrRes.ok) {
      const d = await idrRes.json();
      usdtIdrRate = parseFloat(d.price || usdtIdrRate);
    }
    if (thbRes.ok) {
      const d = await thbRes.json();
      usdtThbRate = parseFloat(d.price || usdtThbRate);
    }

    console.log(`💱 Kurs diperbarui: 1 USDT = Rp${formatNumber(usdtIdrRate)} | ฿${usdtThbRate.toFixed(2)}`);
  } catch (err) {
    console.warn(`⚠️ Rate refresh failed (using cached): ${err.message}`);
  }
}

// ==========================================
// Price Check & Alert (shared)
// ==========================================

async function checkAndAlert(target, currentPriceIdr, sourceName) {
  if (currentPriceIdr >= target.target_price) {
    console.log(
      `🎯 Target hit! ${target.symbol}: ${isDex(target) ? formatIdr(currentPriceIdr) : formatNumber(currentPriceIdr)} >= ${isDex(target) ? formatIdr(target.target_price) : formatNumber(target.target_price)}`
    );
    await sendTelegramNotification(target, currentPriceIdr, sourceName);
    const updated = await markTargetCompleted(target.id);
    if (updated) {
      activeTargets.delete(target.id);
      console.log(`✅ Target ${target.symbol} (${target.id}) marked completed`);
    }
  }
}

function isDex(target) {
  return target.data_source === "DEXSCREENER";
}

// ==========================================
// LOOP A: Binance WebSocket
// ==========================================

async function handlePriceUpdate(symbol, currentPrice) {
  for (const [id, target] of activeTargets.entries()) {
    if (!isDex(target) && target.symbol === symbol.toUpperCase()) {
      await checkAndAlert(target, currentPrice, "Binance");
    }
  }
}

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
  for (const sym of symbols) {
    if (!typeMap[sym]) typeMap[sym] = "GLOBAL";
  }
  return typeMap;
}

function connectWebSocket(symbols, wssBase) {
  if (symbols.length === 0) return;
  const streams = symbols.map((s) => `${s.toLowerCase()}@miniTicker`).join("/");
  const wsUrl = `${wssBase}?streams=${streams}`;

  console.log(`🔌 Connecting Binance WS: ${wssBase}`);
  console.log(`📡 Symbols: ${symbols.join(", ")}`);

  ws = new WebSocket(wsUrl);

  ws.on("open", () => {
    console.log("✅ Binance WebSocket connected!");
    reconnectAttempts = 0;
  });

  ws.on("message", async (rawData) => {
    try {
      const message = JSON.parse(rawData.toString());
      const data = message.data;
      if (data && data.s && data.c) {
        await handlePriceUpdate(data.s, parseFloat(data.c));
      }
    } catch { /* ignore parse errors */ }
  });

  ws.on("ping", () => ws.pong());

  ws.on("close", (code) => {
    console.warn(`⚠️ Binance WS disconnected (code: ${code}). Reconnecting...`);
    scheduleReconnect();
  });

  ws.on("error", (error) => {
    console.error("❌ Binance WS error:", error.message);
  });
}

function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error("❌ Max reconnect attempts reached. Exiting...");
    process.exit(1);
  }
  const delay = Math.min(RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttempts), 60000);
  reconnectAttempts++;
  console.log(`🔄 Reconnecting Binance WS in ${delay / 1000}s (attempt ${reconnectAttempts})...`);
  setTimeout(() => refreshAndReconnectBinance(), delay);
}

async function refreshAndReconnectBinance() {
  // Get all BINANCE targets
  const binanceTargets = [...activeTargets.values()].filter((t) => !isDex(t));
  const symbols = [...new Set(binanceTargets.map((t) => t.symbol))];
  const symbolsKey = symbols.sort().join(",");
  const currentKey = [...subscribedBinanceSymbols].sort().join(",");

  if (symbolsKey !== currentKey) {
    subscribedBinanceSymbols.clear();
    symbols.forEach((s) => subscribedBinanceSymbols.add(s));

    if (ws) {
      ws.removeAllListeners();
      ws.close();
      ws = null;
    }

    if (symbols.length > 0) {
      const symbolTypes = await getSymbolTypes(symbols);
      const globalSymbols = symbols.filter((s) => symbolTypes[s] === "GLOBAL");
      const siteSymbols = symbols.filter((s) => symbolTypes[s] === "SITE");
      if (globalSymbols.length > 0) connectWebSocket(globalSymbols, BINANCE_WSS_GLOBAL);
      if (siteSymbols.length > 0) connectWebSocket(siteSymbols, BINANCE_WSS_SITE);
    } else {
      console.log("ℹ️  No BINANCE targets. WebSocket idle.");
    }
  }
}

// ==========================================
// LOOP B: DexScreener Polling
// ==========================================

async function pollDexTargets() {
  const dexTargets = [...activeTargets.values()].filter(
    (t) => isDex(t) && t.contract_address
  );

  if (dexTargets.length === 0) return;

  console.log(`🔍 Polling DexScreener for ${dexTargets.length} target(s)...`);

  await Promise.allSettled(
    dexTargets.map(async (target) => {
      try {
        const url = `https://api.dexscreener.com/latest/dex/tokens/${target.contract_address.toLowerCase()}`;
        const res = await fetch(url);
        if (!res.ok) return;

        const data = await res.json();
        const pairs = data.pairs || [];
        if (!pairs.length) return;

        // Best pair: highest liquidity
        const best = [...pairs].sort(
          (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        )[0];

        const priceUsd = parseFloat(best.priceUsd || "0");
        if (!priceUsd) return;

        // Convert to IDR
        const priceIdr = priceUsd * usdtIdrRate;

        console.log(
          `📊 DEX ${target.symbol}: $${priceUsd.toFixed(8)} × ${usdtIdrRate} = ${formatIdr(priceIdr)} (target: ${formatIdr(target.target_price)})`
        );

        await checkAndAlert(target, priceIdr, "DexScreener");
      } catch (err) {
        console.warn(`⚠️ DEX poll failed for ${target.symbol}: ${err.message}`);
      }
    })
  );
}

// ==========================================
// Master Refresh (targets + reconnect)
// ==========================================

async function masterRefresh() {
  const targets = await fetchActiveTargets();

  activeTargets.clear();
  for (const target of targets) {
    activeTargets.set(target.id, target);
  }

  const binanceCount = targets.filter((t) => !isDex(t)).length;
  const dexCount = targets.filter((t) => isDex(t)).length;
  console.log(`\n📊 Active targets: ${targets.length} total (Binance: ${binanceCount}, DEX: ${dexCount})`);

  // Reconnect Binance WS if needed
  await refreshAndReconnectBinance();
}

// ==========================================
// Banner
// ==========================================

function printBanner() {
  console.log(`
╔══════════════════════════════════════════════════════╗
║  🚀 Crypto Scalping Worker v2 — Hybrid Monitor      ║
║  ⚡ Binance.th WebSocket + 🔍 DexScreener Polling   ║
║  📱 Telegram Alert | 🗄️ Supabase | 💱 IDR/THB Rates ║
╚══════════════════════════════════════════════════════╝
  `);
  console.log(`📌 Supabase: ${SUPABASE_URL}`);
  console.log(`📌 Telegram Chat ID: ${TELEGRAM_CHAT_ID}`);
  console.log(`📌 DEX Poll Interval: ${DEX_POLL_INTERVAL_MS / 1000}s`);
  console.log(`📌 Rate Refresh: ${RATE_REFRESH_INTERVAL_MS / 1000}s`);
  console.log("");
}

// ==========================================
// Graceful Shutdown
// ==========================================

function setupGracefulShutdown() {
  const shutdown = (signal) => {
    console.log(`\n🛑 Received ${signal}. Shutting down...`);
    if (ws) ws.close();
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

  // 1. Fetch initial rates
  console.log("💱 Fetching exchange rates...");
  await refreshRates();

  // 2. Initial targets load + Binance WS connect
  await masterRefresh();

  // 3. Start DEX polling loop (Loop B)
  console.log(`\n🔄 Starting DexScreener polling (every ${DEX_POLL_INTERVAL_MS / 1000}s)...`);
  setInterval(async () => {
    try { await pollDexTargets(); }
    catch (err) { console.error("❌ DEX poll error:", err.message); }
  }, DEX_POLL_INTERVAL_MS);

  // 4. Supabase polling (check for new targets)
  console.log(`🔄 Starting Supabase polling (every ${SUPABASE_POLL_INTERVAL_MS / 1000}s)...`);
  setInterval(async () => {
    try { await masterRefresh(); }
    catch (err) { console.error("❌ Master refresh error:", err.message); }
  }, SUPABASE_POLL_INTERVAL_MS);

  // 5. Rate refresh loop
  console.log(`💱 Rate refresh loop (every ${RATE_REFRESH_INTERVAL_MS / 1000}s)...`);
  setInterval(async () => {
    try { await refreshRates(); }
    catch (err) { console.warn("⚠️ Rate refresh error:", err.message); }
  }, RATE_REFRESH_INTERVAL_MS);

  console.log("\n✅ Worker running. Waiting for price targets...\n");
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
