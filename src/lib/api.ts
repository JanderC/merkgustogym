const TOKEN_KEY = 'merkgusto.token';
const USER_KEY = 'merkgusto.user';

export type Rol = 'dueno' | 'admin_caja' | 'cajero';
export interface SessionUser {
  id: string;
  usuario: string;
  nombre: string;
  rol: Rol;
}

export const session = {
  get token() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  get user(): SessionUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as SessionUser) : null;
    } catch {
      return null;
    }
  },
  save(token: string, user: SessionUser) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      /* modo privado */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      /* noop */
    }
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Base de la API. Vacío = mismo servidor (local). En Vercel: VITE_API_URL=https://<backend>.up.railway.app */
export const API = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')}/api`;

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; query?: Record<string, unknown> } = {}): Promise<T> {
  const qs = opts.query
    ? '?' +
      new URLSearchParams(
        Object.entries(opts.query)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : '';
  let res: Response;
  try {
    res = await fetch(`${API}${path}${qs}`, {
      method: opts.method ?? (opts.body ? 'POST' : 'GET'),
      headers: {
        ...(opts.body !== undefined && { 'Content-Type': 'application/json' }),
        ...(session.token && { Authorization: `Bearer ${session.token}` }),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Sin conexión con el servidor');
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) onUnauthorized?.();
    throw new ApiError(res.status, (data as { message?: string })?.message ?? `Error ${res.status}`);
  }
  return data as T;
}

export const fotoUrl = (socioId: string, bust?: string | number) =>
  `${API}/socios/${socioId}/foto?t=${encodeURIComponent(session.token ?? '')}${bust ? `&v=${bust}` : ''}`;

/** Descarga un archivo de la API (Excel, etc.) con la sesión actual. */
export async function descargar(path: string, query: Record<string, unknown> = {}, nombre = 'archivo.xlsx') {
  const qs = new URLSearchParams(
    Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  const res = await fetch(`${API}${path}${qs ? `?${qs}` : ''}`, { headers: session.token ? { Authorization: `Bearer ${session.token}` } : {} });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    if (res.status === 401) onUnauthorized?.();
    throw new ApiError(res.status, (data as { message?: string })?.message ?? `Error ${res.status}`);
  }
  const archivo = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? nombre;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
