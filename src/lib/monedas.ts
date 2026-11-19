/**
 * Multimoneda: USD · VES (bolívares) · COP (pesos colombianos).
 * Tablero en pesos (como velozalcambio), igual que en el backend:
 *   usdCop = "Dólar" (COP por $, 3.200) · vesCop = "Bs" (COP por Bs, 3)
 *   usdVes = Bs por $ = usdCop ÷ vesCop (derivado)
 *   COP 4.500 → Bs 4.500 ÷ 3 = 1.500 · → $ 4.500 ÷ 3.200 = 1,41
 */
export type Moneda = 'USD' | 'VES' | 'COP';
export interface Tasas {
  usdVes: number;
  usdCop: number;
  vesCop: number;
}

export const MONEDAS: Moneda[] = ['USD', 'VES', 'COP'];

export const INFO: Record<Moneda, { nombre: string; corto: string; simbolo: string; decimales: number }> = {
  USD: { nombre: 'Dólares', corto: 'Dólares', simbolo: '$', decimales: 2 },
  VES: { nombre: 'Bolívares', corto: 'Bolívares', simbolo: 'Bs', decimales: 2 },
  COP: { nombre: 'Pesos colombianos', corto: 'Pesos', simbolo: 'COP', decimales: 0 },
};

export function factor(de: Moneda, a: Moneda, t: Tasas): number {
  if (de === a) return 1;
  const k = `${de}>${a}`;
  if (k === 'USD>VES') return t.usdCop / t.vesCop;
  if (k === 'VES>USD') return t.vesCop / t.usdCop;
  if (k === 'USD>COP') return t.usdCop;
  if (k === 'COP>USD') return 1 / t.usdCop;
  if (k === 'VES>COP') return t.vesCop;
  return 1 / t.vesCop; // COP>VES
}
export const tasasDesdeTablero = (dolar: number, bs: number): Tasas => ({ usdCop: dolar, vesCop: bs, usdVes: dolar / bs });
/** "Dólar 3.200 · Bs 3" */
export const textoTablero = (t: Tasas) =>
  `Dólar ${t.usdCop.toLocaleString('es-VE', { maximumFractionDigits: 2 })} · Bs ${t.vesCop.toLocaleString('es-VE', { maximumFractionDigits: 4 })}`;
export const convertir = (monto: number, de: Moneda, a: Moneda, t: Tasas) => monto * factor(de, a, t);

export const redondear = (n: number, m: Moneda) => {
  const f = 10 ** INFO[m].decimales;
  return Math.round((n + Number.EPSILON) * f) / f;
};
/** Lo que se le cobra al cliente nunca queda corto por redondeo. */
export const redondearArriba = (n: number, m: Moneda) => {
  const f = 10 ** INFO[m].decimales;
  return Math.ceil(n * f - 1e-7) / f;
};

export function fmt(n: number, m: Moneda): string {
  const { simbolo, decimales } = INFO[m];
  const num = Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  return m === 'USD' ? `$${num}` : `${simbolo} ${num}`;
}

/** Las otras dos monedas, en texto pequeño: "Bs 1.500,00 · $1,36" */
export const equivalentes = (monto: number, de: Moneda, t: Tasas) =>
  MONEDAS.filter((m) => m !== de)
    .map((m) => fmt(redondearArriba(convertir(monto, de, m, t), m), m))
    .join(' · ');

/** Total de varias líneas (cada una en su moneda), exacto y redondeado hacia arriba por moneda. */
export function totales(lineas: Array<{ monto: number; moneda: Moneda }>, t: Tasas) {
  const exactos = { USD: 0, VES: 0, COP: 0 } as Record<Moneda, number>;
  for (const m of MONEDAS) exactos[m] = lineas.reduce((s, l) => s + convertir(l.monto, l.moneda, m, t), 0);
  const cobrar = Object.fromEntries(MONEDAS.map((m) => [m, redondearArriba(exactos[m], m)])) as Record<Moneda, number>;
  return { exactos, cobrar };
}

/** Interpreta lo que escribe la cajera: "1.250,50" · "1250.5" · "100.000" */
export function leerMonto(txt: string): number {
  const t = txt.trim().replace(/\s/g, '').replace(/^\$|^bs|^cop/i, '');
  if (!t) return 0;
  let n: number;
  if (t.includes(',') && t.includes('.')) n = Number(t.replace(/\./g, '').replace(',', '.'));
  else if (t.includes(',')) n = Number(t.replace(',', '.'));
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) n = Number(t.replace(/\./g, ''));
  else n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Moneda de referencia del negocio (la fija el backend). */
let monedaRef: Moneda = 'COP';
export const setMonedaRef = (m: Moneda) => {
  monedaRef = m;
};
export const getMonedaRef = () => monedaRef;
