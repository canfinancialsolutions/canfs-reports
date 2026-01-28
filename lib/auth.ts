// lib/auth.ts
/**
 * Centralized authentication utilities for CAN Financial Solutions
 */

const AUTH_COOKIE = 'canfs_auth';

/**
 * Check if user has valid auth cookie
 */
export function hasAuthCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((c) => c.startsWith(`${AUTH_COOKIE}=true`));
}

/**
 * Clear auth cookie and redirect to login
 */
export function logout(): void {
  if (typeof window === 'undefined') return;
  
  // Clear the auth cookie
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`;
  
  // Redirect to login page
  window.location.href = '/auth';
}

/**
 * Set auth cookie (used by login page)
 */
export function setAuthCookie(): void {
  if (typeof window === 'undefined') return;
  
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${AUTH_COOKIE}=true; path=/; max-age=86400; samesite=lax${secure}`;
}
