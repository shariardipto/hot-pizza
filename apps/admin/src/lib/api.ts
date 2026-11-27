'use client';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { path: (string | number)[]; message: string }[],
  ) {
    super(message);
  }
}

/** Fetch wrapper for the admin API (`/api/v1/admin/*`, proxied same-origin; cookies included). */
export async function api<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(path.startsWith('/api/') ? path : `/api/v1/admin${path}`, {
    credentials: 'include',
    ...rest,
    headers: { Accept: 'application/json', ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 401 && typeof window !== 'undefined' && !location.pathname.startsWith('/login')) {
    location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
  }
  if (res.status === 204) return undefined as T;
  if (res.status === 403 && typeof window !== 'undefined' && !location.pathname.startsWith('/account')) {
    const peek = await res.clone().json().catch(() => null);
    if (peek?.error?.code === 'two_factor_required') location.href = '/account?setup=2fa';
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? res.statusText, data?.error?.details);
  return data as T;
}

export const get = <T = any>(path: string) => api<T>(path);
export const post = <T = any>(path: string, json?: unknown) => api<T>(path, { method: 'POST', json: json ?? {} });
export const put = <T = any>(path: string, json: unknown) => api<T>(path, { method: 'PUT', json });
export const patch = <T = any>(path: string, json: unknown) => api<T>(path, { method: 'PATCH', json });
export const del = <T = any>(path: string) => api<T>(path, { method: 'DELETE' });

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.details?.length) return `${e.message}: ${e.details.map((d) => `${d.path.join('.')} → ${d.message}`).join('; ')}`;
    return e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}

export const qs = (o: Record<string, unknown>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
};
