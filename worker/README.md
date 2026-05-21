# Background Worker — Crypto Scalping Monitor

Worker Node.js mandiri yang berjalan **24/7** untuk memantau harga koin crypto di Binance `.th` secara real-time dan mengirimkan notifikasi Telegram saat target profit 5% tercapai.

## Cara Menjalankan

```bash
# Mode production
npm run worker

# Mode development (auto-restart on file change)
npm run worker:dev
```

> ⚠️ Worker harus dijalankan **terpisah** dari Next.js dev server.

## Persiapan Sebelum Menjalankan

### 1. Pastikan `.env.local` sudah terisi lengkap

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...      # Bukan anon key! Untuk bypass RLS
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...               # Wajib diisi!
BINANCE_WSS_GLOBAL=wss://www.binance.th/gstream
BINANCE_WSS_SITE=wss://www.binance.th/nstream
BINANCE_API_URL=https://api.binance.th
```

### 2. Cara mendapatkan TELEGRAM_CHAT_ID

1. Buka Telegram, cari bot `@userinfobot`
2. Kirim pesan `/start`
3. Bot akan membalas dengan **Chat ID** kamu
4. Copy angka tersebut ke `.env.local` sebagai `TELEGRAM_CHAT_ID`

Atau gunakan cara lain:
1. Kirim pesan apapun ke bot kamu (dari Telegram Bot API token)
2. Buka URL: `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Cari field `"chat": {"id": <angka>}`

### 3. Pastikan tabel Supabase sudah dibuat

Jalankan migration SQL di Supabase Dashboard:
```
supabase/migrations/001_create_scalping_targets.sql
```

## Arsitektur Worker

```
┌─────────────────────────────────────────────────┐
│              worker/index.js                     │
│                                                  │
│  ┌─────────────┐   setiap 30s   ┌─────────────┐ │
│  │  Polling    │ ─────────────▶ │  Supabase   │ │
│  │  Loop       │ ◀──────────── │  DB (active) │ │
│  └──────┬──────┘                └─────────────┘ │
│         │ symbols berubah?                       │
│         ▼                                        │
│  ┌─────────────┐   real-time    ┌─────────────┐ │
│  │  WebSocket  │ ◀──────────── │  Binance .th │ │
│  │  Client     │   price tick   │  WSS Stream  │ │
│  └──────┬──────┘                └─────────────┘ │
│         │ price >= target?                       │
│         ▼                                        │
│  ┌─────────────┐                ┌─────────────┐ │
│  │  Telegram   │ ─────────────▶ │  Telegram   │ │
│  │  Notifier   │                │  Bot API    │ │
│  └──────┬──────┘                └─────────────┘ │
│         │                                        │
│         ▼                                        │
│  ┌─────────────┐                                 │
│  │  Mark       │ → Supabase status='completed'   │
│  │  Completed  │                                 │
│  └─────────────┘                                 │
└─────────────────────────────────────────────────┘
```

## Catatan Teknis

| Fitur | Detail |
|-------|--------|
| **WebSocket** | Binance `.th` Combined Stream (`@miniTicker`) |
| **Symbol Type** | Auto-detect GLOBAL vs SITE via `/api/v1/exchangeInfo` |
| **Reconnect** | Exponential backoff, max 50 attempts |
| **Polling** | Supabase setiap 30 detik untuk target baru |
| **Auth** | `service_role` key untuk bypass RLS (baca semua user) |
| **Anti-spam** | Target di-mark `completed` setelah notifikasi terkirim |

## Cara Deploy (Production)

### Menggunakan PM2

```bash
# Install PM2
npm install -g pm2

# Jalankan worker
pm2 start worker/index.js --name "crypto-worker"

# Auto-restart saat reboot
pm2 startup
pm2 save

# Cek status
pm2 status
pm2 logs crypto-worker
```
