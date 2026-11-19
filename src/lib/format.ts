import { fmt, getMonedaRef, type Moneda } from './monedas';

/** Monto en la moneda de referencia del negocio (reportes, cierres, finanzas). */
export const money = (n: number | null | undefined) => fmt(Number(n ?? 0), getMonedaRef());
export const moneySigned = (n: number) => (n > 0 ? `+${money(n)}` : n < 0 ? `−${money(Math.abs(n))}` : money(0));
/** Compatibilidad: el símbolo ya no se configura aquí. */
export const setMoneda = (_m: string) => undefined;
export const enMoneda = (n: number, m: Moneda) => fmt(n, m);

const pad = (n: number) => String(n).padStart(2, '0');
export const hoyISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const sumarDias = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return hoyISO(new Date(y!, m! - 1, d! + n));
};

export const fecha = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
};
export const fechaCorta = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
};
export const hora = (iso: string | Date | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
export const fechaHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

export const hace = (iso: string | null | undefined) => {
  if (!iso) return 'nunca';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'ayer' : `hace ${d} días`;
};

export const duracion = (desde: string, hasta?: string | null) => {
  const min = Math.round(((hasta ? new Date(hasta) : new Date()).getTime() - new Date(desde).getTime()) / 60000);
  const h = Math.floor(min / 60);
  return h ? `${h} h ${min % 60} min` : `${min} min`;
};

export const diasHasta = (iso: string | null) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((new Date(y!, m! - 1, d!).getTime() - hoy.getTime()) / 86400000);
};

export const iniciales = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
