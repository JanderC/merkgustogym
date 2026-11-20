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
    public details?: unknown,
  ) {
    super(message);
  }
}

/**
 * Sesiones de las apps de entrenadores y de clientes: van aparte de la del equipo
 * (un mismo teléfono puede tener las dos y no se mezclan).
 */
export function crearSesionApp<U>(clave: string) {
  const K = `merkgusto.${clave}`;
  return {
    get token(): string | null {
      try {
        return localStorage.getItem(`${K}.token`);
      } catch {
        return null;
      }
    },
    get datos(): U | null {
      try {
        const raw = localStorage.getItem(`${K}.datos`);
        return raw ? (JSON.parse(raw) as U) : null;
      } catch {
        return null;
      }
    },
    save(token: string, datos: U) {
      try {
        localStorage.setItem(`${K}.token`, token);
        localStorage.setItem(`${K}.datos`, JSON.stringify(datos));
      } catch {
        /* modo privado */
      }
    },
    clear() {
      try {
        localStorage.removeItem(`${K}.token`);
        localStorage.removeItem(`${K}.datos`);
      } catch {
        /* noop */
      }
    },
  };
}
export const sesionCoach = crearSesionApp<{ id: string; usuario: string; nombre: string }>('coach');
export const sesionCliente = crearSesionApp<{ nombre: string }>('cliente');

/** Base de la API. Vacío = mismo servidor (local). En Vercel: VITE_API_URL=https://<backend>.up.railway.app */
export const API = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')}/api`;

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

type Opciones = { method?: string; body?: unknown; query?: Record<string, unknown>; token?: string | null; on401?: () => void };

export async function api<T = unknown>(path: string, opts: Opciones = {}): Promise<T> {
  const token = opts.token !== undefined ? opts.token : session.token;
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
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Sin conexión con el servidor');
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      if (opts.token !== undefined) opts.on401?.();
      else onUnauthorized?.();
    }
    const d = data as { message?: string; details?: unknown } | null;
    throw new ApiError(res.status, d?.message ?? `Error ${res.status}`, d?.details);
  }
  return data as T;
}

export const fotoUrl = (socioId: string, bust?: string | number, token: string | null = session.token) =>
  `${API}/socios/${socioId}/foto?t=${encodeURIComponent(token ?? '')}${bust ? `&v=${bust}` : ''}`;

/** API de la app de entrenadores (si la sesión vence, vuelve a la pantalla de entrada). */
export const apiCoach = <T = unknown>(path: string, opts: Omit<Opciones, 'token' | 'on401'> = {}) =>
  api<T>(`/coach${path}`, {
    ...opts,
    token: sesionCoach.token,
    on401: () => {
      sesionCoach.clear();
      window.location.assign('/login');
    },
  });

/** API de la app del cliente. */
export const apiCliente = <T = unknown>(path: string, opts: Omit<Opciones, 'token' | 'on401'> = {}) =>
  api<T>(`/cliente${path}`, {
    ...opts,
    token: sesionCliente.token,
    on401: () => {
      sesionCliente.clear();
      window.location.assign('/cliente');
    },
  });

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
