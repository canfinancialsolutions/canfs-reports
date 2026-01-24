
"use client";

import { useEffect, useState } from "react";

function hasCanfsAuthCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .map((c) => c.trim())
    .some((c) => c.startsWith("canfs_auth=") && c.includes("true"));
}

export function useRequireCanfsAuth() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const ok = hasCanfsAuthCookie();
    if (!ok) {
      const next = encodeURIComponent(
        window.location.pathname + window.location.search
      );
      window.location.href = `/auth?next=${next}`;
      return;
    }
    setReady(true);
  }, []);

  return ready;
}
