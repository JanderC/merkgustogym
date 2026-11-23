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
/** "lunes 30 nov": para que el cliente sepa qué día le toca volver a pagar. */
export const fechaDia = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'short' });
};

const sumarMeses = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = y! * 12 + (m! - 1) + n;
  const ny = Math.floor(t / 12);
  const nm = t % 12;
  const ultimo = new Date(ny, nm + 1, 0).getDate();
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d!, ultimo))}`;
};

/**
 * Vencimiento de un plan, igual que el servidor: semanas, meses y años de día a día
 * (lunes 23 → lunes 30; 23 nov → 23 dic). Si renueva continuando, desde el vencimiento anterior.
 */
export function finPlan(p: { tipoDuracion: 'dias' | 'semanas' | 'meses' | 'anios'; cantidad: number }, inicio: string, ancla?: string | null) {
  const base = ancla ?? inicio;
  if (p.tipoDuracion === 'semanas') return sumarDias(base, p.cantidad * 7);
  if (p.tipoDuracion === 'meses') return sumarMeses(base, p.cantidad);
  if (p.tipoDuracion === 'anios') return sumarMeses(base, p.cantidad * 12);
  return sumarDias(inicio, p.cantidad - 1);
}

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
