import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ==========================================
// Supabase Client Initialization (Lazy Singleton)
// ==========================================
// Menggunakan lazy init agar tidak crash saat Next.js
// melakukan server-side module evaluation.

let _supabase: SupabaseClient | null = null;

/**
 * Supabase client (anon/publishable key).
 * Digunakan di client-side — RLS otomatis aktif berdasarkan session user.
 * Lazy-initialized untuk menghindari error saat SSR module evaluation.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabase) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) {
        throw new Error(
          "Missing Supabase environment variables. Check .env.local file."
        );
      }
      _supabase = createClient(url, key);
    }
    return (_supabase as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// ==========================================
// Type Definitions
// ==========================================

export type ScalpingTarget = {
  id: string;
  user_id: string;
  symbol: string;
  asset_name: string | null;       // Nama lengkap aset (Bitcoin, Ethereum, dll)
  entry_price: number;             // Harga masuk dalam IDR (untuk DEX) atau THB/USDT (Binance)
  target_price: number;            // Auto: entry_price * 1.05
  capital: number | null;          // Modal yang diinvestasikan
  status: "active" | "completed";
  created_at: string;
  // DexScreener fields
  data_source: "BINANCE" | "DEXSCREENER";
  contract_address: string | null; // Contract address (DEX mode)
  chain_id: string | null;         // Chain: ethereum, bsc, solana, base, dll
  entry_price_usd: number | null;  // Harga masuk dalam USD (referensi DEX)
  telegram_chat_id: string | null; // Telegram Chat ID milik user
};

// ==========================================
// Database Helper Functions
// ==========================================
// CATATAN: Semua query di bawah otomatis ter-filter oleh RLS.
// User hanya bisa mengakses datanya sendiri — tidak perlu filter manual user_id.

/**
 * Mengambil scalping targets milik user yang sedang login.
 * RLS memastikan hanya data milik user tersebut yang dikembalikan.
 */
export async function getScalpingTargets(
  status: "active" | "completed" = "active"
): Promise<ScalpingTarget[]> {
  const { data, error } = await supabase
    .from("scalping_targets")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching scalping targets:", error.message);
    return [];
  }

  return data as ScalpingTarget[];
}

/**
 * Menambahkan target scalping baru.
 * user_id otomatis diisi oleh session user yang sedang login.
 * target_price otomatis dihitung oleh database (entry_price * 1.05).
 */
export async function addScalpingTarget(
  symbol: string,
  entryPrice: number,
  assetName?: string,
  capital?: number,
  // DexScreener fields
  dataSource: "BINANCE" | "DEXSCREENER" = "BINANCE",
  contractAddress?: string,
  chainId?: string,
  entryPriceUsd?: number,
  telegramChatId?: string
): Promise<ScalpingTarget | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("No authenticated user found.");
    return null;
  }

  const { data, error } = await supabase
    .from("scalping_targets")
    .insert({
      user_id: user.id,
      symbol: symbol.toUpperCase(),
      entry_price: entryPrice,
      asset_name: assetName || null,
      capital: capital || null,
      data_source: dataSource,
      contract_address: contractAddress || null,
      chain_id: chainId || null,
      entry_price_usd: entryPriceUsd || null,
      telegram_chat_id: telegramChatId || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error adding scalping target:", error.message);
    return null;
  }

  return data as ScalpingTarget;
}

/**
 * Mengupdate status scalping target (misal: active -> completed).
 * RLS memastikan user hanya bisa update datanya sendiri.
 */
export async function updateScalpingTargetStatus(
  id: string,
  status: "active" | "completed"
): Promise<boolean> {
  const { error } = await supabase
    .from("scalping_targets")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("Error updating scalping target:", error.message);
    return false;
  }

  return true;
}

/**
 * Mengupdate detail scalping target (Harga Masuk & Modal).
 * Target Price otomatis disesuaikan (+5%).
 */
export async function updateScalpingTargetDetails(
  id: string,
  entryPrice: number,
  capital?: number
): Promise<boolean> {
  const { error } = await supabase
    .from("scalping_targets")
    .update({ 
      entry_price: entryPrice,
      capital: capital || null
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating scalping target details:", error.message);
    return false;
  }

  return true;
}

/**
 * Menghapus scalping target berdasarkan ID.
 * RLS memastikan user hanya bisa delete datanya sendiri.
 */
export async function deleteScalpingTarget(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("scalping_targets")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting scalping target:", error.message);
    return false;
  }

  return true;
}

// ==========================================
// Watchlist Favorites Functions
// ==========================================

/**
 * Mengambil daftar simbol favorit milik user.
 * Menggunakan tabel `user_favorites` (user_id, symbols).
 */
export async function getUserFavorites(): Promise<string[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("user_favorites")
    .select("symbols")
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    // Jika tidak ketemu (belum ada baris), kembalikan array kosong
    return [];
  }

  return data.symbols as string[];
}

/**
 * Menyimpan/memperbarui daftar simbol favorit milik user.
 */
export async function updateUserFavorites(symbols: string[]): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { error } = await supabase
    .from("user_favorites")
    .upsert({ user_id: user.id, symbols }, { onConflict: "user_id" });

  if (error) {
    console.error("Error updating user favorites:", error.message);
    return false;
  }

  return true;
}
