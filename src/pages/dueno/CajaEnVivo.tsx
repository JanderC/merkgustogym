/**
 * Caja en vivo (administración): cada caja abierta con lo que tiene ahora por
 * método y moneda, lo que va vendiendo y todo lo que pasa, actualizado cada 5 s.
 */
import { useQuery } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, Ban, Banknote, CircleDollarSign, Eye, Radio, Receipt, ShoppingCart, Trophy, Vault, Wallet } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BotonExcel } from '../../components/BotonExcel';
import { cx, Empty, Loading, PageHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { duracion, hace, hora, hoyISO, money, moneySigned } from '../../lib/format';
import { fmt, INFO, type Moneda } from '../../lib/monedas';
import type { FilaArqueo, ResumenTurno } from '../../lib/types';
import { MovimientoModal } from '../cajero/MiTurno';
import { TurnoDrawer } from './Cierres';

interface Evento {
  id: string;
  tipo: 'venta' | 'anulada' | 'ingreso' | 'egreso';
  hora: string;
  turnoId: string | null;
  cajero: string;
  titulo: string;
  detalle: string | null;
  montoRef: number;
  montoTexto: string;
}
interface EnVivo {
  ahora: string;
  dia: { vendido: number; cobrado: number; fiado: number; ingresos: number; egresos: number; ventas: number; anuladas: number; turnos: number; cerrados: number; balanceCierres: number };
  enCajas: { totalRef: number; efectivo: Array<{ moneda: Moneda; monto: number }>; metodos: Array<{ metodo: string; nombre: string; moneda: Moneda; esperado: number; ref: number; cobrado: number; egresos: number }> };
  cajas: Array<ResumenTurno & { enCajaRef: number; ultimaVenta: string | null }>;
  porHora: Array<{ hora: number; ventas: number; totalRef: number }>;
  top: Array<{ tipo: string; descripcion: string; cantidad: number }>;
  eventos: Evento[];
}

const ICONO = {
  venta: { icon: ShoppingCart, cls: 'text-flame-400 bg-flame-500/10' },
  anulada: { icon: Ban, cls: 'text-bad bg-bad/10' },
  ingreso: { icon: ArrowDownCircle, cls: 'text-ok bg-ok/10' },
  egreso: { icon: ArrowUpCircle, cls: 'text-bad bg-bad/10' },
} as const;

function Kpi({ label, value, hint, cls, icon: Icon }: { label: string; value: string; hint?: string; cls?: string; icon: typeof Wallet }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-steel-400">
        {label} <Icon className="h-4 w-4 text-steel-600" />
      </p>
      <p className={cx('tnum mt-2 font-wide text-2xl leading-none text-white', cls)}>{value}</p>
      {hint && <p className="mt-1.5 text-xs text-steel-500">{hint}</p>}
    </div>
  );
}

/** Filas de método de una caja: lo que debería tener ahora. */
function MetodosCaja({ metodos }: { metodos: FilaArqueo[] }) {
  if (!metodos.length) return <p className="py-3 text-center text-xs text-steel-600">Aún sin movimientos</p>;
  return (
    <div className="space-y-1">
      {metodos.map((m) => (
        <div key={`${m.metodo}${m.moneda}`} className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1 hover:bg-white/[0.03]">
          <span className="text-sm text-steel-300">
            {m.nombre} <span className="text-xs text-steel-500">{INFO[m.moneda].simbolo}</span>
          </span>
          <span className="text-right">
            <span className="tnum font-bold text-white">{fmt(m.esperado, m.moneda)}</span>
            {(m.egresos > 0 || m.vueltos > 0 || m.fondo > 0) && (
              <span className="block text-[11px] text-steel-500">
                {m.fondo > 0 && `fondo ${fmt(m.fondo, m.moneda)} · `}cobró {fmt(m.cobrado, m.moneda)}
                {m.vueltos > 0 && ` · vueltos −${fmt(m.vueltos, m.moneda)}`}
                {m.egresos > 0 && ` · gastos −${fmt(m.egresos, m.moneda)}`}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function CajaEnVivo() {
  const { data, isLoading, dataUpdatedAt } = useQuery({ queryKey: ['caja-en-vivo'], queryFn: () => api<EnVivo>('/caja/en-vivo'), refetchInterval: 5000, refetchIntervalInBackground: false });
  const [detalle, setDetalle] = useState<string | null>(null);
  const [mov, setMov] = useState<{ turnoId: string; tipo: 'ingreso' | 'egreso' } | null>(null);
  const [filtro, setFiltro] = useState<string | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Resaltar lo nuevo que va llegando
  const vistos = useRef<Set<string> | null>(null);
  const [nuevos, setNuevos] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!data) return;
    const ids = data.eventos.map((e) => e.id);
    if (vistos.current) {
      const n = ids.filter((id) => !vistos.current!.has(id));
      if (n.length) {
        setNuevos(new Set(n));
        setTimeout(() => setNuevos(new Set()), 6000);
      }
    }
    vistos.current = new Set(ids);
  }, [data]);

  const maxHora = useMemo(() => Math.max(1, ...(data?.porHora ?? []).map((h) => h.totalRef)), [data]);
  if (isLoading || !data) return <Loading />;
  const seg = Math.max(0, Math.round((Date.now() - dataUpdatedAt) / 1000));
  const eventos = filtro ? data.eventos.filter((e) => e.turnoId === filtro) : data.eventos;
  const horas = data.porHora.filter((h) => h.hora >= 6 && h.hora <= 21);
  const ahoraH = new Date().getHours();

  return (
    <div>
      <PageHeader
        title="Caja en vivo"
        kicker="Tiempo real"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 rounded-full border border-ok/30 bg-ok/[0.06] px-3 py-1.5 text-xs font-bold text-ok">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
              </span>
              EN VIVO · hace {seg}s
            </span>
            <BotonExcel path="/caja/exportar/cierres" query={{ desde: hoyISO(), hasta: hoyISO() }} label="Excel de hoy" />
          </div>
        }
      >
        Lo que tiene cada caja ahora mismo, por método y moneda, y cada venta, ingreso y gasto apenas pasa. Se actualiza solo cada 5 segundos.
      </PageHeader>

      {/* KPIs del día */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <div className="col-span-2 rounded-2xl border border-flame-500/30 bg-gradient-to-br from-flame-500/[0.12] to-transparent p-4">
          <p className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-flame-300">
            En las cajas ahora <Vault className="h-4 w-4" />
          </p>
          <p className="tnum mt-2 font-wide text-4xl leading-none text-white">{money(data.enCajas.totalRef)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.enCajas.efectivo.map((e) => (
              <span key={e.moneda} className="chip border-white/15 text-steel-100">
                <Banknote className="h-3 w-3 text-ok" /> {fmt(e.monto, e.moneda)}
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-steel-500">efectivo en gaveta · {data.cajas.length} caja(s) abierta(s)</p>
        </div>
        <Kpi label="Vendido hoy" value={money(data.dia.vendido)} hint={`${data.dia.ventas} venta(s)${data.dia.anuladas ? ` · ${data.dia.anuladas} anulada(s)` : ''}`} icon={Receipt} />
        <Kpi label="Cobrado" value={money(data.dia.cobrado)} hint={data.dia.fiado > 0 ? `fiado ${money(data.dia.fiado)}` : 'todo cobrado'} cls="text-ok" icon={CircleDollarSign} />
        <Kpi label="Ingresos" value={money(data.dia.ingresos)} icon={ArrowDownCircle} cls="text-ok" />
        <Kpi label="Gastos" value={money(data.dia.egresos)} icon={ArrowUpCircle} cls="text-bad" />
        <Kpi
          label="Cierres de hoy"
          value={moneySigned(data.dia.balanceCierres)}
          hint={`${data.dia.cerrados} de ${data.dia.turnos} turno(s) cerrados`}
          cls={data.dia.balanceCierres < 0 ? 'text-bad' : data.dia.balanceCierres > 0 ? 'text-sky-300' : 'text-ok'}
          icon={Wallet}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          {/* Cajas abiertas */}
          {!data.cajas.length ? (
            <div className="card">
              <Empty icon={<Vault className="h-7 w-7" />} title="No hay cajas abiertas" hint="Cuando una cajera abra su turno aparece aquí en vivo." />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {data.cajas.map((c) => {
                const reciente = c.ultimaVenta && Date.now() - new Date(c.ultimaVenta).getTime() < 90_000;
                const sel = filtro === c.id;
                return (
                  <div key={c.id} className={cx('plate p-5 pt-6 transition', sel && 'ring-2 ring-flame-500/60', reciente && 'border-ok/40')}>
                    <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-ok" />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-xl font-extrabold text-white">{c.cajero}</p>
                        <p className="text-xs text-steel-500">
                          Turno #{c.numero} · abrió {hora(c.abiertoEn)} · {duracion(c.abiertoEn)}
                        </p>
                      </div>
                      {reciente && <span className="animate-pulse rounded-full bg-ok/15 px-2 py-0.5 text-[10px] font-bold uppercase text-ok">Venta nueva</span>}
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-steel-500">Debe tener ahora</p>
                        <p className="tnum font-wide text-3xl text-white">{money(c.enCajaRef)}</p>
                      </div>
                      <div className="text-right text-xs text-steel-400">
                        <p>
                          <b className="tnum text-white">{c.operaciones}</b> venta(s) · <b className="tnum text-white">{money(c.totalVendidoRef)}</b>
                        </p>
                        {c.fiadoRef > 0 && <p className="text-warn">fiado {money(c.fiadoRef)}</p>}
                        {(c.ingresosRef > 0 || c.egresosRef > 0) && (
                          <p>
                            <span className="text-ok">+{money(c.ingresosRef)}</span> · <span className="text-bad">−{money(c.egresosRef)}</span>
                          </p>
                        )}
                        <p className="text-steel-500">última venta {c.ultimaVenta ? hace(c.ultimaVenta) : '—'}</p>
                      </div>
                    </div>
                    <div className="mt-3 border-t border-white/[0.06] pt-3">
                      <MetodosCaja metodos={c.metodos} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="btn-ghost btn-sm" onClick={() => setMov({ turnoId: c.id, tipo: 'egreso' })} title="Retiro de efectivo o gasto pagado con esta caja">
                        <ArrowUpCircle className="h-4 w-4 text-bad" /> Retiro / gasto
                      </button>
                      <button className="btn-ghost btn-sm" onClick={() => setMov({ turnoId: c.id, tipo: 'ingreso' })} title="Sencillo u otro ingreso a esta caja">
                        <ArrowDownCircle className="h-4 w-4 text-ok" /> Ingreso
                      </button>
                      <button className={cx('btn-ghost btn-sm', sel && 'text-flame-300')} onClick={() => setFiltro(sel ? null : c.id)}>
                        <Radio className="h-4 w-4" /> {sel ? 'Ver todas' : 'Solo esta caja'}
                      </button>
                      <button className="btn-ghost btn-sm ml-auto" onClick={() => setDetalle(c.id)}>
                        <Eye className="h-4 w-4" /> Detalle
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Total por método */}
          {data.enCajas.metodos.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-white/[0.06] px-5 py-3">
                <p className="font-display font-extrabold text-white">En todas las cajas, por método</p>
              </div>
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Método</th>
                    <th className="text-right">Cobrado</th>
                    <th className="text-right">Gastos</th>
                    <th className="text-right">Tiene ahora</th>
                    <th className="text-right">Equivale</th>
                  </tr>
                </thead>
                <tbody>
                  {data.enCajas.metodos.map((m) => (
                    <tr key={`${m.metodo}${m.moneda}`}>
                      <td className="font-bold text-steel-100">
                        {m.nombre} <span className="text-xs font-normal text-steel-500">{INFO[m.moneda].simbolo}</span>
                      </td>
                      <td className="tnum text-right text-steel-300">{fmt(m.cobrado, m.moneda)}</td>
                      <td className="tnum text-right text-bad">{m.egresos ? `−${fmt(m.egresos, m.moneda)}` : '—'}</td>
                      <td className="tnum text-right font-bold text-white">{fmt(m.esperado, m.moneda)}</td>
                      <td className="tnum text-right text-steel-400">{money(m.ref)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Ventas por hora + top */}
          <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
            <div className="card p-5">
              <p className="mb-4 font-display font-extrabold text-white">Ventas por hora</p>
              <div className="flex h-36 items-end gap-1">
                {horas.map((h) => (
                  <div key={h.hora} className="group relative flex flex-1 flex-col items-center justify-end" title={`${h.hora}:00 · ${h.ventas} venta(s) · ${money(h.totalRef)}`}>
                    <div className={cx('w-full rounded-t-md transition', h.hora === ahoraH ? 'bg-flame-500' : 'bg-flame-500/40 group-hover:bg-flame-500/70')} style={{ height: `${Math.max(h.totalRef ? 6 : 2, (h.totalRef / maxHora) * 100)}%` }} />
                    <span className={cx('mt-1 text-[9px]', h.hora === ahoraH ? 'font-bold text-flame-300' : 'text-steel-600')}>{h.hora}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-5">
              <p className="mb-3 flex items-center gap-2 font-display font-extrabold text-white">
                <Trophy className="h-4 w-4 text-flame-400" /> Lo más vendido hoy
              </p>
              {!data.top.length ? (
                <p className="text-sm text-steel-500">Aún no hay ventas</p>
              ) : (
                <div className="space-y-1.5">
                  {data.top.map((t, i) => (
                    <p key={t.descripcion} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-steel-200">
                        <span className="mr-2 text-steel-600">{i + 1}.</span>
                        {t.descripcion}
                      </span>
                      <span className="tnum font-bold text-white">×{t.cantidad}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lo que va pasando */}
        <div className="card flex max-h-[calc(100vh-140px)] flex-col overflow-hidden xl:sticky xl:top-[96px]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <p className="font-display font-extrabold text-white">Lo que va pasando</p>
            {filtro && (
              <button className="text-xs font-bold text-flame-300" onClick={() => setFiltro(null)}>
                Ver todas las cajas
              </button>
            )}
          </div>
          <div className="flex-1 divide-y divide-white/[0.04] overflow-y-auto">
            {!eventos.length && <p className="px-5 py-10 text-center text-sm text-steel-500">Hoy todavía no hay movimientos</p>}
            {eventos.map((e) => {
              const I = ICONO[e.tipo];
              return (
                <div key={e.id} className={cx('flex items-start gap-3 px-5 py-3 transition-colors duration-1000', nuevos.has(e.id) && 'bg-flame-500/[0.08]')}>
                  <span className={cx('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl', I.cls)}>
                    <I.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cx('truncate text-sm font-bold text-steel-100', e.tipo === 'anulada' && 'line-through opacity-60')}>{e.titulo}</p>
                    <p className="truncate text-xs text-steel-500">{e.detalle}</p>
                    <p className="text-[11px] text-steel-600">
                      {hora(e.hora)} · {e.cajero}
                    </p>
                  </div>
                  <span className={cx('tnum shrink-0 text-sm font-bold', e.tipo === 'egreso' || e.tipo === 'anulada' ? 'text-bad' : e.tipo === 'ingreso' ? 'text-ok' : 'text-white')}>{e.montoTexto}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {detalle && <TurnoDrawer id={detalle} onClose={() => setDetalle(null)} />}
      {mov && <MovimientoModal tipo={mov.tipo} endpoint={`/caja/turnos/${mov.turnoId}/movimientos`} onClose={() => setMov(null)} />}
    </div>
  );
}
