"use client";

import { useEffect, useState } from 'react';

export function hasCanfsAuthCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split(';')
    .map((c) => c.trim())
    .some((c) => c.startsWith('canfs_auth=') && c.includes('true'));
}

export function setCanfsAuthCookie(days = 1) {
  const maxAge = Math.max(1, Math.floor(days * 86400));
  document.cookie = `canfs_auth=true; path=/; max-age=${maxAge}; samesite=lax`;
}

export function clearCanfsAuthCookie() {
  document.cookie = 'canfs_auth=; path=/; max-age=0; samesite=lax';
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
