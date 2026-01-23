"use client";

import { useEffect, useState } from "react";
// If you are not using Supabase auth yet, comment this out or keep your own:
 import { getSupabase } from "@/lib/supabaseClient";

const DESTINATIONS = [
  { value: "dashboard", label: "Dashboard", path: "/dashboard" },
  { value: "fna", label: "Financial Need Analysis", path: "/fna" },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [destination, setDestination] = useState<string>("dashboard");
  const [msg, setMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(false); // simple version
/*
  useEffect(() => {
    // If you want auto-redirect when already logged in, add it here later.
    setChecking(false);
  }, []);
*/
  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    try {
      // If using Supabase auth, do it here; otherwise, skip to redirect.
      
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMsg(error.message);
        return;
      }
     

      // Find destination path from dropdown value
      const dest = DESTINATIONS.find((d) => d.value === destination);
      const path = dest?.path || "/dashboard";

      // IMPORTANT: redirect on success
      window.location.href = path;
    } catch (err: any) {
      setMsg(err?.message || "Sign-in failed");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <img src="/can-logo.png" className="h-14 w-auto" alt="CAN Financial Solutions" />
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border">
          <h1 className="text-2xl font-bold text-center mb-2">Admin Login</h1>
          <p className="text-sm text-slate-600 text-center mb-6">Protecting Your Tomorrow</p>

          {checking ? (
            <div className="text-center text-slate-600">Checking session...</div>
          ) : (
            <>
              {msg && (
                <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
                  {msg}
                </div>
              )}

              <form onSubmit={signIn} className="space-y-4">
                <label className="block">
                  <div className="text-sm font-semibold text-slate-700 mb-1">Email</div>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-4 py-3"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    autoComplete="email"
                  />
                </label>

                <label className="block">
                  <div className="text-sm font-semibold text-slate-700 mb-1">Password</div>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </label>

                <label className="block">
                  <div className="text-sm font-semibold text-slate-700 mb-1">Go to</div>
                  <select
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
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

                <button
                  type="submit"
                  className="w-full rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold py-3 text-sm"
                >
                  Sign In → {DESTINATIONS.find((d) => d.value === destination)?.label ?? "Dashboard"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
