# AI Developer Instructions (claude.md)

## 1. Tentang Project dan Tujuan
**Nama Project:** AI Crypto Scalping Assistant & 24/7 Alert System
**Tujuan:** Membangun sistem asisten *trading crypto* (scalping) yang otonom. Sistem ini memungkinkan pengguna memasukkan target koin dan harga beli. Terdapat *background worker* yang memantau harga secara *real-time* 24/7 dan mengirimkan notifikasi via Telegram saat target profit 5% tercapai. Selain itu, sistem dilengkapi dengan "Agentic AI" yang dapat menganalisis grafik harga (*candlestick* multi-timeframe) dari Binance untuk memberikan rekomendasi terstruktur: "BELI" atau "JANGAN BELI".

## 2. Tech Stack, Framework, dan Design System
- **Frontend & Main Backend:** Next.js (App Router).
- **Design System & Styling:** Tailwind CSS (dikombinasikan dengan komponen Shadcn UI jika diperlukan untuk mempercepat UI).
- **Database:** Supabase (PostgreSQL).
- **Background Worker:** Node.js murni (menjalankan koneksi WebSocket terpisah).
- **AI Engine:** Vercel AI SDK dengan model Google Gemini (`gemini-1.5-flash`).
- **Data Source:** Binance API (WebSocket untuk *real-time stream*, REST API untuk histori *Klines/Candlestick*).
- **Notification:** Telegram Bot API.

## 3. Struktur Folder Utama
```text
/
├── app/                  # Route Next.js (Halaman utama, API routes untuk AI)
│   ├── api/              # Endpoint API lokal (menjembatani frontend dengan AI/Binance)
│   ├── globals.css       # Tailwind entry point
│   └── page.jsx          # Dashboard utama
├── components/           # Komponen React yang modular dan dapat digunakan ulang (UI)
├── lib/                  # Utility functions (Supabase client, formatter, integrasi API)
├── worker/               # Skrip Node.js mandiri untuk Background Worker 24/7
│   └── index.js          # Entry point untuk WebSocket dan Telegram sender
├── .env.local            # Environment variables (API Keys, DB URL)
└── claude.md             # File instruksi ini
 
## 4. Informasi tambahan
- **Supabase:** Konfigurasi database dan auth (cek `.env.local`).
- **Telegram Bot:** Integrasi bot untuk notifikasi (cek `.env.local`).
- **Binance API:** Akses market data (cek `.env.local`).