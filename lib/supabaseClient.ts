
  import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient"; // adjust path if needed

function useRequireAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;

    const goAuth = () =>
      router.replace(`/auth?redirectedFrom=${encodeURIComponent(pathname)}`);

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      if (!data.session) return goAuth();
      setChecking(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!session) goAuth();
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, [router, pathname]);

  return { checking };
}
