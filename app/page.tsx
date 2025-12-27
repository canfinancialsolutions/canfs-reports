"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
    else window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <img src="/can-logo.png" className="h-12" alt="CAN Financial Solutions" />
          <div>
            <div className="text-xl font-bold text-slate-800">CAN Reports</div>
            <div className="text-sm text-slate-500">Admin login</div>
          </div>
        </div>

        {msg && <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-red-700">{msg}</div>}

        <form onSubmit={signIn} className="space-y-4">
          <label className="block">
            <div className="text-sm font-semibold text-slate-700 mb-1">Email</div>
            <input className="w-full rounded-xl border border-slate-200 px-4 py-3"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>

          <label className="block">
            <div className="text-sm font-semibold text-slate-700 mb-1">Password</div>
            <input type="password" className="w-full rounded-xl border border-slate-200 px-4 py-3"
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>

          <button className="w-full rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
