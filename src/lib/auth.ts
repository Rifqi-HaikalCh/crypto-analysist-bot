import { supabase } from "./supabase";
import type { User, AuthError } from "@supabase/supabase-js";

// ==========================================
// Authentication Helper Functions
// ==========================================
// Menggunakan Supabase Auth dengan Email + Password.
// Konfigurasi: "Confirm email" di-disable di Supabase Dashboard,
// sehingga user bisa langsung login tanpa verifikasi email.

export type AuthResult = {
  user: User | null;
  error: string | null;
};

/**
 * Mendaftarkan user baru dengan email dan password.
 * Tidak memerlukan email aktif/valid — email buatan bisa digunakan.
 * Contoh: "trader1@mail.com", "john@fake.com"
 */
export async function signUp(
  email: string,
  password: string
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { user: null, error: getReadableError(error) };
  }

  return { user: data.user, error: null };
}

/**
 * Login user dengan email dan password.
 */
export async function signIn(
  email: string,
  password: string
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { user: null, error: getReadableError(error) };
  }

  return { user: data.user, error: null };
}

/**
 * Logout user dari session saat ini.
 */
export async function signOut(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: getReadableError(error) };
  }

  return { error: null };
}

/**
 * Mengambil data user yang sedang login (dari session aktif).
 * Return null jika tidak ada user yang login.
 */
export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

/**
 * Subscribe ke perubahan state auth (login, logout, token refresh, dll).
 * Berguna untuk reactive UI — auto-update saat user login/logout.
 *
 * @example
 * const unsubscribe = onAuthStateChange((user) => {
 *   if (user) console.log("Logged in:", user.email);
 *   else console.log("Logged out");
 * });
 * // Cleanup: unsubscribe();
 */
export function onAuthStateChange(
  callback: (user: User | null) => void
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });

  return () => subscription.unsubscribe();
}

// ==========================================
// Error Message Mapping
// ==========================================

/**
 * Mengubah error Supabase Auth menjadi pesan yang lebih mudah dipahami.
 */
function getReadableError(error: AuthError): string {
  const errorMap: Record<string, string> = {
    "Invalid login credentials": "Email atau password salah.",
    "User already registered": "Email sudah terdaftar. Silakan login.",
    "Password should be at least 6 characters":
      "Password minimal 6 karakter.",
    "Unable to validate email address: invalid format":
      "Format email tidak valid.",
    "Email rate limit exceeded":
      "Terlalu banyak percobaan. Coba lagi nanti.",
  };

  return errorMap[error.message] || error.message;
}
