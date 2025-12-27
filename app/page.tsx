"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import { Button, Card } from "@/components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // If already logged in, go to dashboard
    (async () => {
      try {
        const supabase = getSupabase();
        const { data } = await supabase.auth.getSession();
        if (data.session) window.location.href = "/dashboard";
      } catch (e: any) {
        setMsg(e?.message || "Supabase config error");
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message);
      else window.location.href = "/dashboard";
    } catch (e: any) {
      setMsg(e?.message || "Sign-in failed");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <img src="/can-logo.svg" className="h-10" alt="CAN Financial Solutions" />
        </div>

        <Card title="Admin Login">
          {checking ? (
            <div className="text-slate-600">Checking session...</div>
          ) : (
            <>
              {msg && (
                <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-red-700">
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
                    placeholder="admin@yourcompany.com"
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

                <Button type="submit" variant="primary">
                  Sign in
                </Button>
              </form>

              <div className="mt-4 text-xs text-slate-500">
                Tip: In Supabase → Authentication → Users, create an admin user (email/password).
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
