"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient"; // adjust path if needed

export default function AuthPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const [loading, setLoading] = useState(false);

  const target = useMemo(() => {
    return sp.get("redirectedFrom") || "/dashboard";
  }, [sp]);

  // If already logged in, go straight to target
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) router.replace(target);
    })();
  }, [router, target]);

  async function handleSignIn(email: string, password: string) {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (!error) {
      router.replace(target);
    } else {
      // show your error UI as you already do
      console.error(error.message);
    }
  }

  return (
    // keep your existing auth UI,
    // call handleSignIn(email, password) on Sign In
    null
  );
}
