"use client";

import { useEffect, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [destination, setDestination] = useState("dashboard");
  const [msg, setMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const DESTINATIONS = [
    { value: "dashboard", label: "Dashboard" },
    { value: "fna", label: "Financial Need Analysis" },
  ];

  useEffect(() => {
    setChecking(false); // Skip session check for now
  }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    
    // Simple redirect (add Supabase auth later)
    const dest = DESTINATIONS.find(d => d.value === destination);
    window.location.href = dest?.value || "/dashboard";
  };

  return (
<div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <img src="/can-logo.png" className="h-14 w-auto" alt="CAN Financial Solutions" />
          <img
            src="/can-logo.png"
            className="h-14 w-auto"
            alt="CAN Financial Solutions"
          />
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-8 border">
          <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Admin Login</h2>
          <p className="text-slate-600 text-center mb-8">Protecting Your Tomorrow</p>

          {checking ? (
            <div className="text-center py-8 text-slate-600">Loading...</div>
          ) : (
            <>
              {msg && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
                  {msg}
                </div>
              )}

              <form onSubmit={signIn} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@canfs.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Go to
                  </label>
                  <select
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 text-lg"
                >
                  Sign In → {DESTINATIONS.find(d => d.value === destination)?.label}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t text-xs text-slate-500 text-center">
                CAN Financial Solutions - Protecting Your Tomorrow
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
