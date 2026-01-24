
// lib/canfsAuth.ts
export function hasCanfsAuthCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .map((c) => c.trim())
    .some((c) => c.startsWith("canfs_auth=") && c.includes("true"));
}

export function setCanfsAuthCookie() {
  // 1 day cookie, available across all paths
  document.cookie = `canfs_auth=true; path=/; max-age=86400; samesite=lax`;
}

export function clearCanfsAuthCookie() {
  document.cookie = `canfs_auth=; path=/; max-age=0; samesite=lax`;
}
