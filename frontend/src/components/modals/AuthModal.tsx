'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Avatar } from '@/components/ui/Avatar';
import confetti from 'canvas-confetti';
import {
  Lock,
  Mail,
  User,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  X,
  Code,
  ShieldCheck,
  Zap,
  ArrowRight,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { setCurrentUser, users, refreshData } = useAppStore();

  const [tab, setTab] = useState<'LOGIN' | 'REGISTER' | 'FORGOT' | 'VERIFY'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('Fullstack Developer');
  const [skills, setSkills] = useState('React, Node.js, TypeScript');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [verifyToken, setVerifyToken] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e?: React.FormEvent, directEmail?: string) => {
    e?.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const loginEmail = directEmail || email;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      setCurrentUser(data.user);
      localStorage.setItem('devconnect_token', data.token);
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
      onClose();
      await refreshData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid login');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          title,
          skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      setCurrentUser(data.user);
      localStorage.setItem('devconnect_token', data.token);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.7 } });
      setSuccessMsg(data.message);
      setTimeout(() => {
        onClose();
        refreshData();
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate reset link');

      setSuccessMsg(data.message);
      if (data.resetToken) {
        setResetToken(data.resetToken);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password update failed');

      setSuccessMsg(data.message);
      setTimeout(() => setTab('LOGIN'), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verifyToken, email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      setSuccessMsg(data.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0e1320] shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Developer Authentication</h3>
            <p className="text-xs text-slate-400">
              Phase 1 Foundation • Email, Password, Sessions & Role Security
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl mb-4 text-xs">
          <button
            onClick={() => {
              setTab('LOGIN');
              setError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-colors ${
              tab === 'LOGIN' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setTab('REGISTER');
              setError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-colors ${
              tab === 'REGISTER' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign Up
          </button>
          <button
            onClick={() => {
              setTab('FORGOT');
              setError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-colors ${
              tab === 'FORGOT' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Reset
          </button>
          <button
            onClick={() => {
              setTab('VERIFY');
              setError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-colors ${
              tab === 'VERIFY' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Verify
          </button>
        </div>

        {/* Feedback alerts */}
        {error && (
          <div className="mb-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab 1: LOGIN */}
        {tab === 'LOGIN' && (
          <div className="space-y-4">
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="developer@zettaweb.dev"
                    className="w-full text-xs pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500/40"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setTab('FORGOT')}
                    className="text-[11px] text-indigo-400 hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-xs pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500/40"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>

            {/* Switch to Register */}
            <div className="pt-3 border-t border-white/10 text-center">
              <span className="text-xs text-slate-400">
                Don&apos;t have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setTab('REGISTER');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-indigo-400 hover:text-indigo-300 font-medium hover:underline"
                >
                  Create one now
                </button>
              </span>
            </div>
          </div>
        )}

        {/* Tab 2: REGISTER */}
        {tab === 'REGISTER' && (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full text-xs pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@zettaweb.dev"
                  className="w-full text-xs pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Password
              </label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full text-xs pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Developer Role
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Frontend / Backend"
                  className="w-full text-xs px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Skills
                </label>
                <input
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="React, Go, Python"
                  className="w-full text-xs px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer mt-2"
            >
              {loading ? 'Creating Account...' : 'Create Developer Account'}
            </button>

            <div className="pt-2 text-center">
              <span className="text-xs text-slate-400">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setTab('LOGIN');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-indigo-400 hover:text-indigo-300 font-medium hover:underline"
                >
                  Sign in here
                </button>
              </span>
            </div>
          </form>
        )}

        {/* Tab 3: FORGOT / RESET */}
        {tab === 'FORGOT' && (
          <div className="space-y-4">
            <form onSubmit={handleForgotPassword} className="space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Request Reset Token
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter account email"
                    className="w-full text-xs pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Generate Reset Link / Token
              </button>
            </form>

            {resetToken && (
              <form onSubmit={handleResetPassword} className="space-y-3 pt-3 border-t border-white/10">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                    Reset Token
                  </label>
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white/5 border border-white/10 rounded-xl font-mono text-cyan-300 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 6 chars)"
                    className="w-full text-xs px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Set New Password
                </button>
              </form>
            )}
          </div>
        )}

        {/* Tab 4: VERIFY */}
        {tab === 'VERIFY' && (
          <form onSubmit={handleVerifyEmail} className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Account Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email to verify"
                className="w-full text-xs px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Verification Token (Optional if requesting new code)
              </label>
              <input
                type="text"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                placeholder="e.g. vfy_xxxxxx"
                className="w-full text-xs px-3 py-2 bg-white/5 border border-white/10 rounded-xl font-mono text-cyan-300 outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer"
              >
                {verifyToken ? 'Confirm Token' : 'Send Verification Token'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
