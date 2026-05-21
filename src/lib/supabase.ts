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
  entry_price: number;
  target_price: number;
  status: "active" | "completed";
  created_at: string;
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
  entryPrice: number
): Promise<ScalpingTarget | null> {
  // Ambil user_id dari session yang aktif
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
