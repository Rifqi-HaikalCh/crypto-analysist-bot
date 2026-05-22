"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { onAuthStateChange, getCurrentUser } from "@/lib/auth";
import AuthForm from "@/components/auth-form";
import Dashboard from "@/components/dashboard";
import { Loader2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check initial auth state
    getCurrentUser().then((currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    // Subscribe to auth changes (login, logout, token refresh)
    const unsubscribe = onAuthStateChange((updatedUser) => {
      setUser(updatedUser);
    });

    return () => unsubscribe();
  }, []);

  // Loading screen while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-500 animate-spin" />
          </div>
          <p className="text-gray-500 text-sm font-medium">
            Memuat aplikasi...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {user ? (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          <Dashboard onLogout={() => setUser(null)} />
        </motion.div>
      ) : (
        <motion.div
          key="auth"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          <AuthForm onAuthSuccess={() => {}} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
