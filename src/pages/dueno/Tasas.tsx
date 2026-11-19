import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowDownRight, ArrowUpRight, Calculator, Landmark, RefreshCw, ShoppingBag, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { cx, Loading, PageHeader, Tabs } from '../../components/ui';
import { api } from '../../lib/api';
import { fechaHora } from '../../lib/format';
import { convertir, fmt, INFO, leerMonto, MONEDAS, redondear, redondearArriba, tasasDesdeTablero, type Moneda, type Tasas } from '../../lib/monedas';
import type { Catalogo } from '../../lib/types';

type Tendencia = 'sube' | 'baja' | null;
interface Version extends Tasas {
  id: number;
  dolar: number;
  bs: number;
  fuenteUsdVes: 'manual' | 'bcv' | 'paralelo';
  fuenteUsdCop: 'manual' | 'trm';
  nota: string | null;
  creadoEn: string;
  creadoPor: string | null;
  tendencia?: { dolar: Tendencia; bs: Tendencia };
}
interface Respuesta {
  vigente: Version;
  historial: Version[];
  auto: { usdVes: 'manual' | 'bcv' | 'paralelo'; usdCop: 'manual' | 'trm' };
}
interface Externas {
  bcv: { valor: number; fecha: string | null } | null;
  paralelo: { valor: number; fecha: string | null } | null;
  trm: { valor: number; fecha: string | null } | null;
  consultadoEn: string;
  errores: string[];
}

const n = (v: number, d = 2) => Number(v).toLocaleString('es-VE', { maximumFractionDigits: d });
const txt = (v: number) => String(v).replace('.', ',');
const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Tablero de tasas en PESOS, como en velozalcambio:
 *   Dólar = cuántos pesos vale $1 (3.200) · Bs = cuántos pesos vale Bs 1 (3)
 * Un precio en pesos se divide por la tasa: COP 4.500 → Bs 1.500 → $1,41.
 */
export default function TasasPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['tasas'], queryFn: () => api<Respuesta>('/tasas') });
  const { data: cat } = useQuery({ queryKey: ['catalogo'], queryFn: () => api<Catalogo>('/pos/catalogo') });
  const { data: ext, refetch: recargarExt, isFetching } = useQuery({ queryKey: ['tasas-ext'], queryFn: () => api<Externas>('/tasas/externas') });
  const [f, setF] = useState({ dolar: '', bs: '' });
  const [fuente, setFuente] = useState<{ dolar: Version['fuenteUsdCop']; bs: Version['fuenteUsdVes'] }>({ dolar: 'manual', bs: 'manual' });
  useEffect(() => {
    if (data) {
      setF({ dolar: txt(data.vigente.dolar), bs: txt(data.vigente.bs) });
      setFuente({ dolar: data.vigente.fuenteUsdCop, bs: data.vigente.fuenteUsdVes });
    }
  }, [data]);

  const dolar = leerMonto(f.dolar);
  const bs = leerMonto(f.bs);
  const validas = dolar > 0 && bs > 0;
  const nuevas = validas ? tasasDesdeTablero(dolar, bs) : null;
  const refrescar = () => ['tasas', 'config-publica', 'catalogo'].forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));

  const guardar = useMutation({
    mutationFn: () => api('/tasas', { body: { dolar, bs, fuenteDolar: fuente.dolar, fuenteBs: fuente.bs } }),
    onSuccess: () => (toast.success('Tablero de tasas publicado'), refrescar()),
    onError: (e: Error) => toast.error(e.message),
  });
  const auto = useMutation({
    mutationFn: (b: Partial<Respuesta['auto']>) => api('/tasas/auto', { method: 'PUT', body: b }),
    onSuccess: () => (toast.success('Actualización automática guardada'), refrescar()),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return <Loading />;
  const v = data.vigente;
  const tend = data.historial[0]?.id === v.id ? data.historial[0].tendencia : undefined;
  const cambio = validas && (Math.abs(dolar - v.dolar) > 1e-9 || Math.abs(bs - v.bs) > 1e-9);
  // BCV/paralelo dan Bs por $: con el dólar en pesos se saca cuántos pesos vale Bs 1
  const sugerirBs = (bsPorDolar: number) => r2((dolar || v.dolar) / bsPorDolar);

  return (
    <div className="space-y-6">
      <PageHeader title="Tasas del día" kicker="Tablero en pesos">
        Todo se calcula desde el peso. Publicado {fechaHora(v.creadoEn)}
        {v.creadoPor ? ` por ${v.creadoPor}` : v.nota ? ` · ${v.nota}` : ''}.
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="plate p-6 pt-8">
          <div className="grid gap-4 md:grid-cols-2">
            <Casilla
              titulo="Dólar"
              detalle="Pesos por $1"
              valor={f.dolar}
              onChange={(x) => (setF({ ...f, dolar: x }), setFuente({ ...fuente, dolar: 'manual' }))}
              fuente={fuente.dolar}
              tendencia={tend?.dolar ?? null}
              ejemplo={dolar > 0 ? `$10 × ${n(dolar)} = COP ${n(10 * dolar, 0)}` : 'Ej.: 3.200'}
            />
            <Casilla
              titulo="Bs"
              detalle="Pesos por Bs 1"
              valor={f.bs}
              onChange={(x) => (setF({ ...f, bs: x }), setFuente({ ...fuente, bs: 'manual' }))}
              fuente={fuente.bs}
              tendencia={tend?.bs ?? null}
              ejemplo={bs > 0 ? `Bs 1.000 × ${n(bs, 4)} = COP ${n(1000 * bs, 0)}` : 'Ej.: 3'}
            />
          </div>

          <div className="mt-4 grid gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm md:grid-cols-3">
            <Regla titulo="Precio en pesos → Bs" formula={bs > 0 ? `COP 4.500 ÷ ${n(bs, 4)}` : '—'} resultado={bs > 0 ? fmt(redondearArriba(4500 / bs, 'VES'), 'VES') : '—'} />
            <Regla titulo="Precio en pesos → $" formula={dolar > 0 ? `COP 4.500 ÷ ${n(dolar)}` : '—'} resultado={dolar > 0 ? fmt(redondearArriba(4500 / dolar, 'USD'), 'USD') : '—'} />
            <Regla titulo="$1 en bolívares (sale solo)" formula={validas ? `${n(dolar)} ÷ ${n(bs, 4)}` : '—'} resultado={validas ? fmt(redondear(dolar / bs, 'VES'), 'VES') : '—'} />
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            {cambio && <span className="text-xs text-warn">Sin publicar: la caja sigue con las tasas anteriores</span>}
            <button className="btn-primary" disabled={!validas || !cambio || guardar.isPending} onClick={() => guardar.mutate()}>
              Publicar tablero
            </button>
          </div>
        </div>

        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="flex items-center gap-2 font-display font-extrabold text-white">
              <Landmark className="h-5 w-5 text-flame-500" /> Fuentes en vivo
            </p>
            <button className="btn-ghost btn-sm" onClick={() => void recargarExt()} disabled={isFetching}>
              <RefreshCw className={cx('h-4 w-4', isFetching && 'animate-spin')} /> Consultar
            </button>
          </div>
          <div className="space-y-2">
            <Fuente
              nombre="TRM Colombia"
              detalle="Pesos por $ → Dólar"
              dato={ext?.trm}
              propuesta={ext?.trm ? `Dólar ${n(Math.round(ext.trm.valor), 0)}` : null}
              onUsar={() => ext?.trm && (setF({ ...f, dolar: txt(Math.round(ext.trm.valor)) }), setFuente({ ...fuente, dolar: 'trm' }))}
            />
            <Fuente
              nombre="BCV oficial"
              detalle="Bs por $ → se saca el Bs"
              dato={ext?.bcv}
              propuesta={ext?.bcv ? `Bs ${n(sugerirBs(ext.bcv.valor))}` : null}
              onUsar={() => ext?.bcv && (setF({ ...f, bs: txt(sugerirBs(ext.bcv.valor)) }), setFuente({ ...fuente, bs: 'bcv' }))}
            />
            <Fuente
              nombre="Paralelo"
              detalle="Bs por $ → se saca el Bs"
              dato={ext?.paralelo}
              propuesta={ext?.paralelo ? `Bs ${n(sugerirBs(ext.paralelo.valor))}` : null}
              onUsar={() => ext?.paralelo && (setF({ ...f, bs: txt(sugerirBs(ext.paralelo.valor)) }), setFuente({ ...fuente, bs: 'paralelo' }))}
            />
          </div>
          {ext?.errores.length ? <p className="mt-2 text-xs text-warn">{ext.errores.join(' · ')}</p> : null}
          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <p className="label">Actualizar solas cada 30 min</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-steel-300">Dólar</span>
                <Tabs
                  value={data.auto.usdCop}
                  onChange={(x) => auto.mutate({ usdCop: x })}
                  items={[
                    { value: 'manual', label: 'Manual' },
                    { value: 'trm', label: 'TRM' },
                  ]}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-steel-300">Bs</span>
                <Tabs
                  value={data.auto.usdVes}
                  onChange={(x) => auto.mutate({ usdVes: x })}
                  items={[
                    { value: 'manual', label: 'Manual' },
                    { value: 'bcv', label: 'BCV' },
                    { value: 'paralelo', label: 'Paralelo' },
                  ]}
                />
              </div>
              <p className="text-xs text-steel-500">En la frontera lo normal es dejarlas en manual, como en la casa de cambio.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <PreciosConTasas cat={cat} tasas={nuevas} cambio={cambio} />
        <Calculadora tasas={nuevas ?? v} />
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <p className="flex items-center gap-2 font-display font-extrabold text-white">
            <TrendingUp className="h-5 w-5 text-steel-400" /> Versiones publicadas
          </p>
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Fecha</th>
                <th className="text-right">Dólar</th>
                <th className="text-right">Bs</th>
                <th className="text-right">$1 en Bs</th>
                <th>Quién</th>
              </tr>
            </thead>
            <tbody>
              {data.historial.map((h) => (
                <tr key={h.id}>
                  <td className="text-steel-400">{fechaHora(h.creadoEn)}</td>
                  <td className="tnum text-right text-steel-100">
                    <Flecha t={h.tendencia?.dolar ?? null} /> {n(h.dolar)} {h.fuenteUsdCop !== 'manual' && <span className="text-[10px] uppercase text-flame-400">trm</span>}
                  </td>
                  <td className="tnum text-right text-steel-100">
                    <Flecha t={h.tendencia?.bs ?? null} /> {n(h.bs, 4)} {h.fuenteUsdVes !== 'manual' && <span className="text-[10px] uppercase text-flame-400">{h.fuenteUsdVes}</span>}
                  </td>
                  <td className="tnum text-right text-steel-400">{n(h.dolar / h.bs)}</td>
                  <td className="text-xs text-steel-500">{h.creadoPor ?? h.nota ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Flecha({ t }: { t: Tendencia }) {
  if (t === 'sube') return <ArrowUpRight className="inline h-3.5 w-3.5 text-ok" />;
  if (t === 'baja') return <ArrowDownRight className="inline h-3.5 w-3.5 text-danger" />;
  return null;
}

function Casilla(p: { titulo: string; detalle: string; valor: string; onChange: (v: string) => void; fuente: string; tendencia: Tendencia; ejemplo: string }) {
  return (
    <label className="block rounded-2xl border border-flame-500/25 bg-flame-500/[0.04] p-4 focus-within:border-flame-500/60">
      <span className="flex items-baseline justify-between">
        <span className="font-display text-lg font-extrabold uppercase tracking-wide text-white">{p.titulo}</span>
        <span className="flex items-center gap-1 text-xs text-steel-400">
          {p.tendencia && (
            <span className={cx('flex items-center gap-0.5 font-bold', p.tendencia === 'sube' ? 'text-ok' : 'text-danger')}>
              <Flecha t={p.tendencia} /> {p.tendencia}
            </span>
          )}
          {p.detalle}
        </span>
      </span>
      <input className="input tnum mt-2 font-wide text-3xl" inputMode="decimal" value={p.valor} onChange={(e) => p.onChange(e.target.value)} />
      <span className="mt-2 flex items-center justify-between text-xs text-steel-400">
        <span>{p.ejemplo}</span>
        {p.fuente !== 'manual' && <span className="chip border-flame-500/30 uppercase text-flame-300">{p.fuente}</span>}
      </span>
    </label>
  );
}

function Regla({ titulo, formula, resultado }: { titulo: string; formula: string; resultado: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-steel-500">{titulo}</p>
      <p className="tnum text-steel-300">
        {formula} = <span className="font-bold text-white">{resultado}</span>
      </p>
    </div>
  );
}

function Fuente({ nombre, detalle, dato, propuesta, onUsar }: { nombre: string; detalle: string; dato: { valor: number; fecha: string | null } | null | undefined; propuesta: string | null; onUsar: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3">
      <div className="flex-1">
        <p className="font-bold text-steel-100">{nombre}</p>
        <p className="text-xs text-steel-500">
          {detalle}
          {dato?.fecha ? ` · ${fechaHora(dato.fecha)}` : ''}
        </p>
      </div>
      <div className="text-right">
        <p className="tnum font-display text-lg font-extrabold text-white">{dato ? n(dato.valor) : '—'}</p>
        {propuesta && <p className="tnum text-[11px] text-flame-400">{propuesta}</p>}
      </div>
      <button className="btn-ghost btn-sm" disabled={!dato} onClick={onUsar}>
        Usar
      </button>
    </div>
  );
}

/** Cómo quedan los precios reales del gimnasio con las tasas escritas (antes de publicarlas). */
function PreciosConTasas({ cat, tasas, cambio }: { cat: Catalogo | undefined; tasas: Tasas | null; cambio: boolean }) {
  const filas = [
    ...(cat?.productos ?? []).filter((p) => p.activo !== false).map((p) => ({ k: `p${p.id}`, nombre: p.nombre, monto: p.precio, moneda: p.moneda })),
    ...(cat?.planes ?? []).map((p) => ({ k: `m${p.id}`, nombre: p.nombre, monto: p.precio, moneda: p.moneda })),
  ];
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <p className="flex items-center gap-2 font-display font-extrabold text-white">
          <ShoppingBag className="h-5 w-5 text-flame-500" /> Así se cobra en caja
        </p>
        {cambio && <span className="chip border-warn/30 text-warn">vista previa</span>}
      </div>
      <div className="max-h-[380px] overflow-y-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Producto / plan</th>
              {MONEDAS.map((m) => (
                <th key={m} className="text-right">
                  {INFO[m].simbolo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasas &&
              filas.map((f) => (
                <tr key={f.k}>
                  <td className="text-steel-200">{f.nombre}</td>
                  {MONEDAS.map((m) => (
                    <td key={m} className={cx('tnum text-right', m === f.moneda ? 'font-bold text-flame-400' : 'text-steel-300')}>
                      {fmt(m === f.moneda ? f.monto : redondearArriba(convertir(f.monto, f.moneda, m, tasas), m), m)}
                    </td>
                  ))}
                </tr>
              ))}
            {!filas.length && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-steel-500">
                  Sin productos ni planes todavía
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="border-t border-white/[0.06] px-5 py-3 text-xs text-steel-500">En naranja, el precio en su moneda. Las otras salen dividiendo o multiplicando por el tablero, redondeando hacia arriba.</p>
    </div>
  );
}

/** Convertidor rápido con las tasas escritas. */
function Calculadora({ tasas }: { tasas: Tasas }) {
  const [monto, setMonto] = useState('4500');
  const [de, setDe] = useState<Moneda>('COP');
  const m = leerMonto(monto);
  return (
    <div className="card p-6">
      <p className="mb-4 flex items-center gap-2 font-display font-extrabold text-white">
        <Calculator className="h-5 w-5 text-flame-500" /> Convertidor
      </p>
      <div className="flex gap-2">
        <input className="input tnum flex-1 text-lg" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} />
        <Tabs value={de} onChange={setDe} items={MONEDAS.map((x) => ({ value: x, label: INFO[x].simbolo }))} />
      </div>
      <ArrowDown className="mx-auto my-3 h-5 w-5 text-steel-600" />
      <div className="space-y-2">
        {MONEDAS.filter((x) => x !== de).map((a) => (
          <div key={a} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3">
            <span className="text-sm text-steel-400">{INFO[a].nombre}</span>
            <span className="tnum font-wide text-xl text-white">{fmt(redondear(convertir(m, de, a, tasas), a), a)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
