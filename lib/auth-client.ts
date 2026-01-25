// app/lib/auth-client.ts  (or /lib/auth-client.ts in root and adjust imports)

export function setSession() {
  // simple flag cookie for demo auth
  document.cookie = 'canfs_auth=true; path=/; max-age=86400'; // 1 day
}

export function clearSession() {
  document.cookie = 'canfs_auth=; path=/; max-age=0';
}

export function hasSession(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((c) => c.trim().startsWith('canfs_auth=true'));
}
