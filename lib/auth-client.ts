// app/lib/auth-client.ts
export function setSession() {
  document.cookie = 'canfs_auth=true; path=/; max-age=86400'; // 1 day
}

export function clearSession() {
  document.cookie = 'canfs_auth=; path=/; max-age=0';
}

export function hasSession(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((c) => c.trim().startsWith('canfs_auth=true'));
}
