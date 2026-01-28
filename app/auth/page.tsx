// app/auth/page.tsx
'use client';

import { useState } from 'react';

const DESTINATIONS = [
  { value: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { value: 'prospect', label: 'Prospect List', path: '/prospect' },
  { value: 'fna', label: 'Financial Need Analysis', path: '/fna' },
 ];

const AUTH_COOKIE = 'canfs_auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [destination, setDestination] = useState<string>('dashboard');
  const [error, setError] = useState<string | null>(null);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate credentials
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    // Set auth cookie with secure flag for HTTPS
    const secure = window.location.protocol === 'https:' ? '; secure' : '';
    document.cookie = `${AUTH_COOKIE}=true; path=/; max-age=86400; samesite=lax${secure}`;

    // Get the selected destination path
    const dest = DESTINATIONS.find((d) => d.value === destination);
    const redirectTo = dest?.path ?? '/dashboard';

    // Redirect to selected destination
    window.location.href = redirectTo;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
        <div className="flex flex-col items-center mb-6">
          <img src="/can-logo.png" alt="CAN Financial Solutions" className="h-14 mb-3" />
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Admin Login</h1>
          <p className="text-sm text-slate-600">Protecting Your Tomorrow</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={signIn} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Go to
            </label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            >
              {DESTINATIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 text-sm"
          >
            Sign In📲 → {DESTINATIONS.find((d) => d.value === destination)?.label ?? 'Dashboard'}
          </button>
        </form>

        <div className="mt-6 text-center text-[11px] text-slate-500">
          CAN Financial Solutions &mdash; Protecting Your Tomorrow
        </div>
      </div>
    </div>
  );
}
