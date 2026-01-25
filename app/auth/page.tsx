"use client";

import { useEffect, useMemo, useState } from 'react';
import { hasCanfsAuthCookie, setCanfsAuthCookie } from '@/lib/useRequireCanfsAuth';

const DESTINATIONS = [
  { value: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { value: 'fna', label: 'Financial Need Analysis', path: '/fna' },
  { value: 'prospect', label: 'Prospect List', path: '/prospect' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [destination, setDestination] = useState('dashboard');
  const [error, setError] = useState<string | null>(null);

  const nextFromQuery = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return params.get('next') ?? '';
  }, []);

  useEffect(() => {
    if (hasCanfsAuthCookie()) {
      window.location.href = nextFromQuery || '/dashboard';
    }
  }, [nextFromQuery]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // TODO: replace with real auth; for now, accept any non-empty credentials
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setCanfsAuthCookie(1);

    if (nextFromQuery) {
      window.location.href = nextFromQuery;
      return;
    }

    const dest = DESTINATIONS.find((d) => d.value === destination);
    window.location.href = dest?.path ?? '/dashboard';
  };

  return (
    <div className="min-h-screen bg-slate-50 grid place-items-center p-6">
      <form
        onSubmit={signIn}
        className="w-full max-w-md bg-white border rounded-2xl p-6 shadow-sm space-y-4"
      >
        <div>
          <div className="text-2xl font-extrabold">CAN Financial Solutions</div>
          <div className="text-slate-600 mt-1">Admin Login</div>
          <div className="text-slate-500 text-sm mt-1">Protecting Your Tomorrow</div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <label className="block">
          <div className="text-sm font-semibold mb-1">Email</div>
          <input
            className="w-full rounded-lg border px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
          />
        </label>

        <label className="block">
          <div className="text-sm font-semibold mb-1">Password</div>
          <input
            type="password"
            className="w-full rounded-lg border px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>

        {!nextFromQuery && (
          <label className="block">
            <div className="text-sm font-semibold mb-1">Go to</div>
            <select
              className="w-full rounded-lg border px-3 py-2"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            >
              {DESTINATIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          type="submit"
          className="w-full rounded-xl bg-slate-900 text-white py-3 font-semibold hover:bg-slate-800"
        >
          Sign In →
        </button>

        <div className="text-xs text-slate-500 text-center">
          CAN Financial Solutions — Protecting Your Tomorrow
        </div>
      </form>
    </div>
  );
}
