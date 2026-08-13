export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export async function api<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...init } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Request failed');
  return res.json();
}
