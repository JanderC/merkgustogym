import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, Ban, FileImage, HandCoins, Plus, Scale, TrendingUp, Wallet } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { BarSerie } from '../../components/charts';
import { BotonExcel } from '../../components/BotonExcel';
import { cx, Empty, Field, Loading, Modal, PageHeader, Stat, Tabs } from '../../components/ui';
import { api } from '../../lib/api';
import { fecha, fechaCorta, fechaHora, hoyISO, money, moneySigned, sumarDias } from '../../lib/format';
import { fmt, INFO, type Moneda } from '../../lib/monedas';
import type { Movimiento } from '../../lib/types';
import { MovimientoModal } from '../cajero/MiTurno';
import { archivoUrl } from './Cierres';

interface Resumen {
  monedaRef: Moneda;
  totales: { vendido: number; cobrado: number; fiado: number; abonosCobrados: number; otrosIngresos: number; egresos: number; costoVendido: number; utilidad: number; operaciones: number };
  flujo: Array<{ moneda: Moneda; ventas: number; ingresos: number; egresos: number; neto: number }>;
  porMetodo: Array<{ nombre: string; moneda: Moneda; montoMoneda: number; montoRef: number; n: number }>;
  categorias: Array<{ tipo: 'ingreso' | 'egreso'; categoria: string; montoRef: number; n: number }>;
  serie: Array<{ fecha: string; cobrado: number; otrosIngresos: number; egresos: number; neto: number }>;
  porCobrar: { saldo: number; clientes: number };
  cierres: { cantidad: number; abiertos: number; faltantes: number; sobrantes: number; sinDeclarar: number };
}
interface DeudaFila {
  id: number;
  concepto: string;
  moneda: Moneda;
  montoTotal: number;
  saldo: number;
  creadoEn: string;
  socio: string;
  telefono: string | null;
}

const rangos = {
  hoy: () => [hoyISO(), hoyISO()],
  '7': () => [sumarDias(hoyISO(), -6), hoyISO()],
  mes: () => [hoyISO().slice(0, 8) + '01', hoyISO()],
  '30': () => [sumarDias(hoyISO(), -29), hoyISO()],
} as const;

export default function Finanzas() {
  const qc = useQueryClient();
  const [rango, setRango] = useState<keyof typeof rangos | 'custom'>('hoy');
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [tab, setTab] = useState<'movimientos' | 'deudas'>('movimientos');
  const [nuevo, setNuevo] = useState(false);
  const [anular, setAnular] = useState<Movimiento | null>(null);
  const { data: r, isLoading } = useQuery({ queryKey: ['finanzas', desde, hasta], queryFn: () => api<Resumen>('/finanzas/resumen', { query: { desde, hasta } }) });
  const { data: movs } = useQuery({ queryKey: ['movimientos', desde, hasta], queryFn: () => api<Movimiento[]>('/caja/movimientos', { query: { desde, hasta } }) });
  const { data: deudas } = useQuery({ queryKey: ['deudas'], queryFn: () => api<DeudaFila[]>('/caja/deudas') });

  const elegir = (k: keyof typeof rangos | 'custom') => {
    setRango(k);
    if (k !== 'custom') {
      const [d, h] = rangos[k]();
      setDesde(d!);
      setHasta(h!);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finanzas"
        kicker="Dinero del negocio"
        actions={
          <div className="flex flex-wrap gap-2">
            <BotonExcel path="/caja/exportar/movimientos" query={{ desde, hasta }} label="Excel de movimientos" />
            <BotonExcel path="/caja/exportar/cierres" query={{ desde, hasta }} label="Excel de cierres" />
            <button className="btn-primary" onClick={() => setNuevo(true)}>
              <Plus className="h-4 w-4" /> Ingreso / gasto
            </button>
          </div>
        }
      >
        Todo sumado en {INFO[r?.monedaRef ?? 'COP'].nombre.toLowerCase()} con la tasa de cada operación, y el flujo real de cada moneda.
      </PageHeader>

      <div className="flex flex-wrap items-end gap-3">
        <Tabs
          value={rango}
          onChange={elegir}
          items={[
            { value: 'hoy', label: 'Hoy' },
            { value: '7', label: '7 días' },
            { value: 'mes', label: 'Este mes' },
            { value: '30', label: '30 días' },
            { value: 'custom', label: 'Fechas' },
          ]}
        />
        {rango === 'custom' && (
          <>
            <Field label="Desde">
              <input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </Field>
            <Field label="Hasta">
              <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </Field>
          </>
        )}
      </div>

      {isLoading || !r ? (
        <Loading />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Stat accent label="Cobrado" value={money(r.totales.cobrado)} icon={<Wallet className="h-5 w-5" />} hint={`Vendido ${money(r.totales.vendido)} · ${r.totales.operaciones} venta(s)`} />
            <Stat label="Gastos" value={money(r.totales.egresos)} icon={<ArrowUpCircle className="h-5 w-5" />} hint={`Otros ingresos ${money(r.totales.otrosIngresos)}`} />
            <Stat label="Utilidad" value={<span className={r.totales.utilidad < 0 ? 'text-bad' : ''}>{money(r.totales.utilidad)}</span>} icon={<TrendingUp className="h-5 w-5" />} hint={`Costo de productos ${money(r.totales.costoVendido)}`} />
            <Stat label="Por cobrar" value={money(r.porCobrar.saldo)} icon={<HandCoins className="h-5 w-5" />} hint={`${r.porCobrar.clientes} cliente(s) · abonado en el periodo ${money(r.totales.abonosCobrados)}`} />
          </div>

          {/* Flujo real por moneda */}
          <div className="grid gap-4 md:grid-cols-3">
            {r.flujo.map((f) => (
              <div key={f.moneda} className="plate p-5 pt-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-steel-400">{INFO[f.moneda].nombre}</p>
                <p className={cx('tnum mt-2 font-wide text-2xl', f.neto < 0 ? 'text-bad' : 'text-white')}>{fmt(f.neto, f.moneda)}</p>
                <div className="mt-3 space-y-1 text-xs">
                  <p className="flex justify-between text-steel-400">
                    <span>Ventas (neto de vueltos)</span>
                    <span className="tnum text-steel-200">{fmt(f.ventas, f.moneda)}</span>
                  </p>
                  {f.ingresos > 0 && (
                    <p className="flex justify-between text-steel-400">
                      <span>Ingresos</span>
                      <span className="tnum text-ok">+{fmt(f.ingresos, f.moneda)}</span>
                    </p>
                  )}
                  {f.egresos > 0 && (
                    <p className="flex justify-between text-steel-400">
                      <span>Gastos</span>
                      <span className="tnum text-bad">−{fmt(f.egresos, f.moneda)}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <div className="card p-5">
              <p className="font-display font-extrabold text-white">Neto por día</p>
              <p className="mb-4 text-xs text-steel-500">Cobrado + otros ingresos − gastos</p>
              <BarSerie data={r.serie} x="fecha" y="neto" nombre="Neto" formatY={(v) => money(v)} formatX={fechaCorta} height={240} />
            </div>
            <div className="space-y-6">
              <div className="card p-5">
                <p className="mb-3 font-display font-extrabold text-white">Por método de pago</p>
                <div className="space-y-2">
                  {r.porMetodo.length === 0 && <p className="text-sm text-steel-500">Sin cobros en el periodo.</p>}
                  {r.porMetodo.map((m) => (
                    <div key={m.nombre + m.moneda} className="flex items-center justify-between text-sm">
                      <span className="text-steel-300">
                        {m.nombre} <span className="text-steel-600">{INFO[m.moneda].simbolo}</span>
                      </span>
                      <span className="tnum text-right">
                        <b className="text-steel-100">{fmt(m.montoMoneda, m.moneda)}</b>
                        {m.moneda !== r.monedaRef && <span className="ml-2 text-xs text-steel-500">≈ {money(m.montoRef)}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card p-5">
                <p className="mb-3 flex items-center gap-2 font-display font-extrabold text-white">
                  <Scale className="h-4 w-4 text-steel-400" /> Cierres de caja
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <p className="text-steel-400">
                    Cerrados <b className="block text-lg text-white">{r.cierres.cantidad}</b>
                  </p>
                  <p className="text-steel-400">
                    Abiertos <b className="block text-lg text-white">{r.cierres.abiertos}</b>
                  </p>
                  <p className="text-steel-400">
                    Faltantes <b className={cx('tnum block text-lg', r.cierres.faltantes < 0 ? 'text-bad' : 'text-ok')}>{moneySigned(r.cierres.faltantes)}</b>
                  </p>
                  <p className="text-steel-400">
                    Sobrantes <b className="tnum block text-lg text-sky-300">{moneySigned(r.cierres.sobrantes)}</b>
                  </p>
                </div>
                {r.cierres.sinDeclarar > 0 && <p className="mt-2 text-xs text-warn">{r.cierres.sinDeclarar} cierre(s) sin declarar lo entregado</p>}
              </div>
            </div>
          </div>

          {r.categorias.length > 0 && (
            <div className="card p-5">
              <p className="mb-3 font-display font-extrabold text-white">Por categoría</p>
              <div className="grid gap-2 md:grid-cols-2">
                {r.categorias.map((c) => (
                  <div key={c.tipo + c.categoria} className="flex items-center justify-between rounded-xl bg-white/[0.02] px-4 py-2.5 text-sm">
                    <span className="flex items-center gap-2 text-steel-300">
                      {c.tipo === 'egreso' ? <ArrowUpCircle className="h-4 w-4 text-bad" /> : <ArrowDownCircle className="h-4 w-4 text-ok" />}
                      {c.categoria} <span className="text-steel-600">({c.n})</span>
                    </span>
                    <span className={cx('tnum font-bold', c.tipo === 'egreso' ? 'text-bad' : 'text-ok')}>{money(c.montoRef)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: 'movimientos', label: `Movimientos (${movs?.length ?? 0})` },
              { value: 'deudas', label: `Cuentas por cobrar (${deudas?.length ?? 0})` },
            ]}
          />
        </div>
        {tab === 'movimientos' ? (
          !movs?.length ? (
            <Empty icon={<Wallet className="h-7 w-7" />} title="Sin ingresos ni gastos en el periodo" />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Concepto</th>
                    <th>Método</th>
                    <th className="text-right">Monto</th>
                    <th>Quién</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {movs.map((m) => (
                    <tr key={m.id} className={cx(m.anulado && 'opacity-40')}>
                      <td className="text-steel-400">{fechaHora(m.creadoEn)}</td>
                      <td>
                        <p className={cx('font-bold text-steel-100', m.anulado && 'line-through')}>
                          {m.tipo === 'egreso' ? <ArrowUpCircle className="mr-1.5 inline h-4 w-4 text-bad" /> : <ArrowDownCircle className="mr-1.5 inline h-4 w-4 text-ok" />}
                          {m.concepto}
                        </p>
                        <p className="text-xs text-steel-500">
                          {m.categoria}
                          {m.turno ? ` · turno #${m.turno}` : ' · administración'}
                          {m.motivoAnulacion && ` · anulado: ${m.motivoAnulacion}`}
                        </p>
                      </td>
                      <td className="text-steel-400">{m.metodoNombre}</td>
                      <td className={cx('tnum text-right font-bold', m.tipo === 'egreso' ? 'text-bad' : 'text-ok')}>
                        {fmt(Number(m.monto), m.moneda)}
                        {m.moneda !== r?.monedaRef && <span className="block text-xs font-normal text-steel-500">≈ {money(Number(m.montoRef))}</span>}
                      </td>
                      <td className="text-steel-400">{m.usuario}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          {m.comprobanteId && (
                            <a href={archivoUrl(m.comprobanteId)} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-steel-500 hover:text-flame-400" title="Comprobante">
                              <FileImage className="h-4 w-4" />
                            </a>
                          )}
                          {!m.anulado && (
                            <button className="rounded-lg p-1.5 text-steel-500 hover:bg-bad/10 hover:text-bad" title="Anular" onClick={() => setAnular(m)}>
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : !deudas?.length ? (
          <Empty icon={<HandCoins className="h-7 w-7" />} title="Nadie debe nada" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Concepto</th>
                  <th>Desde</th>
                  <th className="text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {deudas.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <p className="font-bold text-steel-100">{d.socio}</p>
                      <p className="text-xs text-steel-500">{d.telefono ?? 'sin teléfono'}</p>
                    </td>
                    <td className="max-w-[360px] truncate text-steel-400">{d.concepto}</td>
                    <td className="text-steel-400">{fecha(d.creadoEn)}</td>
                    <td className="tnum text-right font-bold text-warn">{fmt(Number(d.saldo), d.moneda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {nuevo && <MovimientoModal tipo="egreso" endpoint="/caja/movimientos" onClose={() => setNuevo(false)} onDone={() => void qc.invalidateQueries({ queryKey: ['finanzas'] })} />}
      {anular && <AnularMovimiento mov={anular} onClose={() => setAnular(null)} />}
    </div>
  );
}

function AnularMovimiento({ mov, onClose }: { mov: Movimiento; onClose: () => void }) {
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState('');
  const m = useMutation({
    mutationFn: () => api(`/caja/movimientos/${mov.id}/anular`, { body: { motivo } }),
    onSuccess: () => {
      toast.success('Movimiento anulado');
      ['movimientos', 'finanzas', 'turnos', 'turno-det'].forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal
      title="Anular movimiento"
      size="sm"
      onClose={onClose}
      footer={
        <button className="btn-danger" disabled={motivo.trim().length < 3 || m.isPending} onClick={() => m.mutate()}>
          Anular
        </button>
      }
    >
      <p className="mb-4 text-sm text-steel-400">
        {mov.concepto} · {fmt(Number(mov.monto), mov.moneda)}. Si era de un turno, cambia lo esperado de ese cierre.
      </p>
      <Field label="Motivo">
        <input className="input" autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Field>
    </Modal>
  );
}
