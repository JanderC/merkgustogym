/**
 * Paginación y orden para cualquier lista.
 *
 *   const t = useTabla(data, { fecha: { label: 'Fecha', valor: (v) => v.fecha }, ... }, { id: 'ventas', orden: { col: 'fecha', dir: 'desc' } });
 *   <th><Th t={t} col="fecha">Fecha</Th></th> … {t.visibles.map(...)} … <Paginacion t={t} />
 *
 * Recuerda (por pantalla) cuántas filas ver y por qué columna ordenar.
 */
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { cx } from './ui';

type Valor = string | number | boolean | Date | null | undefined;
export type Columnas<T> = Record<string, { label: string; valor: (f: T) => Valor }>;
export type Dir = 'asc' | 'desc';
export interface Orden {
  col: string;
  dir: Dir;
}

export interface Tabla<T> {
  visibles: T[];
  ordenadas: T[];
  total: number;
  pagina: number;
  paginas: number;
  porPagina: number;
  desde: number;
  hasta: number;
  orden: Orden | null;
  columnas: Columnas<T>;
  setPagina: (p: number) => void;
  setPorPagina: (n: number) => void;
  setOrden: (o: Orden | null) => void;
  /** Clic en un encabezado: primero ascendente, luego descendente */
  ordenar: (col: string) => void;
}

export const TAMANOS = [10, 25, 50, 100];

const leer = (k: string) => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? 'null');
  } catch {
    return null;
  }
};
const guardar = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* modo privado: no se recuerda */
  }
};

const comparar = (a: Valor, b: Valor) => {
  const va = a instanceof Date ? a.getTime() : a;
  const vb = b instanceof Date ? b.getTime() : b;
  if (typeof va === 'number' && typeof vb === 'number') return va - vb;
  if (typeof va === 'boolean' && typeof vb === 'boolean') return Number(va) - Number(vb);
  return String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' });
};

export function useTabla<T>(filas: T[] | null | undefined, columnas: Columnas<T>, opts: { id: string; orden?: Orden | null; porPagina?: number }): Tabla<T> {
  const clave = `tabla:${opts.id}`;
  const guardado = leer(clave) as { orden?: Orden | null; porPagina?: number } | null;
  const [orden, setOrdenSt] = useState<Orden | null>(guardado?.orden !== undefined && (guardado.orden === null || guardado.orden.col in columnas) ? guardado.orden : (opts.orden ?? null));
  const [porPagina, setPorPaginaSt] = useState<number>(TAMANOS.includes(guardado?.porPagina ?? 0) ? guardado!.porPagina! : (opts.porPagina ?? 25));
  const [pagina, setPagina] = useState(1);

  const ordenadas = useMemo(() => {
    const base = filas ?? [];
    const c = orden && columnas[orden.col];
    if (!c) return base;
    const signo = orden.dir === 'asc' ? 1 : -1;
    // Los vacíos siempre al final, en cualquier sentido
    return [...base].sort((x, y) => {
      const a = c.valor(x);
      const b = c.valor(y);
      const va = a === null || a === undefined || a === '';
      const vb = b === null || b === undefined || b === '';
      if (va || vb) return va === vb ? 0 : va ? 1 : -1;
      return comparar(a, b) * signo;
    });
  }, [filas, orden]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = ordenadas.length;
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const actual = Math.min(pagina, paginas);
  // Al filtrar o cambiar el orden se vuelve a la primera página
  useEffect(() => setPagina(1), [total, orden?.col, orden?.dir, porPagina]);

  const persistir = (o: Orden | null, n: number) => guardar(clave, { orden: o, porPagina: n });
  const setOrden = (o: Orden | null) => {
    setOrdenSt(o);
    persistir(o, porPagina);
  };
  const setPorPagina = (n: number) => {
    setPorPaginaSt(n);
    persistir(orden, n);
  };
  const desde = total ? (actual - 1) * porPagina : 0;
  return {
    visibles: ordenadas.slice(desde, desde + porPagina),
    ordenadas,
    total,
    pagina: actual,
    paginas,
    porPagina,
    desde: total ? desde + 1 : 0,
    hasta: Math.min(desde + porPagina, total),
    orden,
    columnas,
    setPagina,
    setPorPagina,
    setOrden,
    ordenar: (col) => setOrden(orden?.col === col ? { col, dir: orden.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }),
  };
}

/** Encabezado que ordena al tocarlo. Va dentro del <th>. */
export function Th<T>({ t, col, children }: { t: Tabla<T>; col: string; children?: ReactNode }) {
  const activo = t.orden?.col === col;
  const Icono = !activo ? ArrowUpDown : t.orden!.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      className={cx('inline-flex items-center gap-1 uppercase tracking-[inherit] transition hover:text-white', activo && 'text-flame-300')}
      title={activo ? (t.orden!.dir === 'asc' ? 'Ascendente: toca para descendente' : 'Descendente: toca para ascendente') : 'Ordenar'}
      onClick={(e) => {
        e.stopPropagation();
        t.ordenar(col);
      }}
    >
      {children ?? t.columnas[col]?.label}
      <Icono className={cx('h-3 w-3 shrink-0', !activo && 'opacity-40')} />
    </button>
  );
}

/** Barra de abajo: cuántos hay, ordenar por, asc/desc, filas por página y páginas. */
export function Paginacion<T>({ t, className, sinOrden }: { t: Tabla<T>; className?: string; sinOrden?: boolean }) {
  if (!t.total) return null;
  const cols = Object.entries(t.columnas);
  // Números de página alrededor de la actual: 1 … 4 5 [6] 7 8 … 20
  const nums: Array<number | '…'> = [];
  for (let i = 1; i <= t.paginas; i++) {
    if (i === 1 || i === t.paginas || Math.abs(i - t.pagina) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  const btn = 'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-bold transition disabled:opacity-30';
  return (
    <div className={cx('flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.06] px-4 py-3 text-xs text-steel-400', className)}>
      <span className="tnum">
        {t.desde}–{t.hasta} de <b className="text-steel-200">{t.total}</b>
      </span>
      {!sinOrden && cols.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span>Ordenar por</span>
          <select
            className="rounded-lg border border-white/10 bg-ink-850 px-2 py-1 text-xs text-steel-200"
            value={t.orden?.col ?? ''}
            onChange={(e) => t.setOrden(e.target.value ? { col: e.target.value, dir: t.orden?.dir ?? 'asc' } : null)}
          >
            <option value="">—</option>
            {cols.map(([k, c]) => (
              <option key={k} value={k}>
                {c.label}
              </option>
            ))}
          </select>
          <div className="flex overflow-hidden rounded-lg border border-white/10">
            {(['asc', 'desc'] as const).map((d) => (
              <button
                key={d}
                type="button"
                disabled={!t.orden}
                className={cx('inline-flex items-center gap-1 px-2 py-1 font-bold transition disabled:opacity-40', t.orden?.dir === d ? 'bg-flame-500/20 text-flame-300' : 'hover:text-white')}
                onClick={() => t.orden && t.setOrden({ ...t.orden, dir: d })}
              >
                {d === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {d === 'asc' ? 'Asc' : 'Desc'}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="ml-auto flex items-center gap-3">
        <label className="flex items-center gap-1.5">
          Ver
          <select className="rounded-lg border border-white/10 bg-ink-850 px-2 py-1 text-xs text-steel-200" value={t.porPagina} onChange={(e) => t.setPorPagina(Number(e.target.value))}>
            {TAMANOS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {t.paginas > 1 && (
          <div className="flex items-center gap-0.5">
            <button type="button" className={cx(btn, 'hover:bg-white/[0.06]')} disabled={t.pagina === 1} onClick={() => t.setPagina(1)} title="Primera">
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button type="button" className={cx(btn, 'hover:bg-white/[0.06]')} disabled={t.pagina === 1} onClick={() => t.setPagina(t.pagina - 1)} title="Anterior">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {nums.map((n, i) =>
              n === '…' ? (
                <span key={`g${i}`} className="px-1 text-steel-600">
                  …
                </span>
              ) : (
                <button key={n} type="button" className={cx(btn, 'tnum', n === t.pagina ? 'bg-flame-500 text-ink-950' : 'hover:bg-white/[0.06]')} onClick={() => t.setPagina(n)}>
                  {n}
                </button>
              ),
            )}
            <button type="button" className={cx(btn, 'hover:bg-white/[0.06]')} disabled={t.pagina === t.paginas} onClick={() => t.setPagina(t.pagina + 1)} title="Siguiente">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button type="button" className={cx(btn, 'hover:bg-white/[0.06]')} disabled={t.pagina === t.paginas} onClick={() => t.setPagina(t.paginas)} title="Última">
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
