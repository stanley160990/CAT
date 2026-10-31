/**
 * API client helper for CAT application
 */

export async function apiRequest<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({
    success: false,
    error: `HTTP ${response.status}: Respons server tidak valid`,
  }));

  if (!response.ok) {
    throw new Error(data.error || `Terjadi kesalahan (Kode: ${response.status})`);
  }

  return data;
}

// Authentication Storage
const AUTH_KEY = 'cat_auth_user';

export function saveAuthUser(user: any): void {
  try {
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(user));
  } catch (e) {
    console.error('Failed to save auth to session:', e);
  }
}

export function getAuthUser(): any | null {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function clearAuthUser(): void {
  try {
    sessionStorage.removeItem(AUTH_KEY);
  } catch (e) {
    console.error('Failed to clear auth session:', e);
  }
}
