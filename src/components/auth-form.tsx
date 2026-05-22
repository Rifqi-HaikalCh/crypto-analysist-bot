'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  Loader2,
  UserPlus,
  LogIn,
  ShieldCheck,
} from 'lucide-react';
import { signIn, signUp } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface AuthFormProps {
  onAuthSuccess: () => void;
}

export default function AuthForm({ onAuthSuccess }: AuthFormProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const isLogin = mode === 'login';

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setError(signInError);
          triggerShake();
        } else {
          onAuthSuccess();
        }
      } else {
        const { error: signUpError } = await signUp(email, password);
        if (signUpError) {
          setError(signUpError);
          triggerShake();
        } else {
          setSuccess('Akun berhasil dibuat! Silakan login.');
          setMode('login');
          setPassword('');
        }
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(isLogin ? 'register' : 'login');
    setError(null);
    setSuccess(null);
  };

  const shakeVariants = {
    shake: {
      x: [0, -8, 8, -6, 6, -3, 3, 0],
      transition: { duration: 0.5 },
    },
    idle: { x: 0 },
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-[128px]" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-[128px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Header */}
        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 shadow-lg shadow-cyan-500/25"
          >
            <ShieldCheck className="h-8 w-8 text-gray-900" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold tracking-tight text-gray-900"
          >
            Crypto Scalping Assistant
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-1 text-sm text-gray-600"
          >
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </motion.p>
        </div>

        {/* Card */}
        <motion.div
          variants={shakeVariants}
          animate={shake ? 'shake' : 'idle'}
          className={cn(
            'rounded-2xl border border-gray-200 bg-white p-8 shadow-2xl shadow-black/40 backdrop-blur-xl',
          )}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email field */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={cn(
                    'w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-slate-500 outline-none transition-all',
                    'focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20',
                  )}
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn(
                    'w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-11 text-sm text-gray-900 placeholder-slate-500 outline-none transition-all',
                    'focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-gray-700"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error message */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                    {error}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success message */}
            <AnimatePresence mode="wait">
              {success && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                    {success}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit button */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-lg transition-all',
                'bg-gradient-to-r from-cyan-500 to-emerald-500 shadow-cyan-500/25',
                'hover:from-cyan-400 hover:to-emerald-400 hover:shadow-cyan-500/30',
                'disabled:cursor-not-allowed disabled:opacity-60',
              )}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isLogin ? (
                <LogIn className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              <AnimatePresence mode="wait">
                <motion.span
                  key={mode}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  {loading
                    ? isLogin
                      ? 'Signing in...'
                      : 'Creating account...'
                    : isLogin
                      ? 'Sign In'
                      : 'Create Account'}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-100" />
            <span className="text-xs text-gray-500">or</span>
            <div className="h-px flex-1 bg-gray-100" />
          </div>

          {/* Toggle mode */}
          <button
            type="button"
            onClick={toggleMode}
            disabled={loading}
            className="w-full rounded-lg border border-gray-200 bg-white/50 px-4 py-2.5 text-sm text-gray-700 transition-all hover:border-gray-300 hover:bg-white hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={mode}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="inline-block"
              >
                {isLogin
                  ? "Don't have an account? Sign Up"
                  : 'Already have an account? Sign In'}
              </motion.span>
            </AnimatePresence>
          </button>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center text-xs text-gray-400"
        >
          Secured with end-to-end encryption
        </motion.p>
      </motion.div>
    </div>
  );
}
