import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, Ban, CheckCheck, FileImage, Lock, Vault } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { BotonExcel } from '../../components/BotonExcel';
import { cx, Diferencia, Drawer, Empty, Field, Loading, Modal, PageHeader, Tabs } from '../../components/ui';
import { API, api, session } from '../../lib/api';
import { duracion, fechaHora, hoyISO, hora, money, moneySigned, sumarDias } from '../../lib/format';
import { fmt, INFO, type Moneda } from '../../lib/monedas';
import type { Movimiento, ResumenTurno } from '../../lib/types';

interface VentaTurno {
  id: string;
  numero: number;
  creadoEn: string;
  totalRef: number;
  pagadoRef: number;
  totales: Record<Moneda, number> | null;
  estado: 'pagada' | 'anulada';
  motivoAnulacion: string | null;
  socio: string | null;
  items: Array<{ descripcion: string; cantidad: number; subtotal: number; moneda: Moneda }> | null;
  pagos: Array<{ metodo: string; moneda: Moneda; montoMoneda: number; montoRef: number; vuelto: boolean; referencia: string | null }> | null;
}

export const archivoUrl = (id: number) => `${API}/archivos/${id}?t=${encodeURIComponent(session.token ?? '')}`;

export function AnularVenta({ venta, onClose, onDone }: { venta: { id: string; numero: number; totalRef: number }; onClose: () => void; onDone: () => void }) {
  const [motivo, setMotivo] = useState('');
  const m = useMutation({
    mutationFn: () => api(`/caja/ventas/${venta.id}/anular`, { body: { motivo } }),
    onSuccess: () => {
      toast.success(`Venta #${venta.numero} anulada`, { description: 'Stock devuelto, abonos revertidos y acceso ajustado.' });
      onDone();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal
      title={`Anular venta #${venta.numero}`}
      size="sm"
      onClose={onClose}
      footer={
        <button className="btn-danger" disabled={motivo.trim().length < 3 || m.isPending} onClick={() => m.mutate()}>
          <Ban className="h-4 w-4" /> Anular {money(venta.totalRef)}
        </button>
      }
    >
      <p className="mb-4 text-sm text-steel-400">Sale de lo esperado del turno, el stock vuelve al inventario, los abonos regresan a la deuda y si incluía un plan, el lector deja de dar acceso por esos días.</p>
      <Field label="Motivo">
        <input className="input" autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. cobro duplicado" />
      </Field>
    </Modal>
  );
}

const signoMoneda = (n: number, m: Moneda) => (n === 0 ? '✓' : `${n > 0 ? '+' : '−'}${fmt(Math.abs(n), m)}`);

export function TurnoDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [nota, setNota] = useState('');
  const [anular, setAnular] = useState<VentaTurno | null>(null);
  const [forzar, setForzar] = useState(false);
  const { data: t, isLoading } = useQuery({ queryKey: ['turno-det', id], queryFn: () => api<ResumenTurno & { ventas: VentaTurno[]; movimientos: Movimiento[] }>(`/caja/turnos/${id}`) });
  const refrescar = () => ['turno-det', 'turnos', 'dashboard', 'finanzas'].forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
  const revisar = useMutation({
    mutationFn: () => api(`/caja/turnos/${id}/revisar`, { body: { nota: nota || null } }),
    onSuccess: () => (toast.success('Cierre revisado'), refrescar()),
    onError: (e: Error) => toast.error(e.message),
  });
  const cerrar = useMutation({
    mutationFn: () => api(`/caja/turnos/${id}/cerrar`, { body: { declaraciones: [], nota: nota || 'Cerrado por administración' } }),
    onSuccess: () => (toast.success('Turno cerrado'), setForzar(false), refrescar()),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !t) {
    return (
      <Drawer title="Turno" onClose={onClose}>
        <Loading />
      </Drawer>
    );
  }
  const abierto = t.estado === 'abierto';
  return (
    <>
      <Drawer
        title={`Turno #${t.numero} · ${t.cajero}`}
        subtitle={`${fechaHora(t.abiertoEn)} → ${t.cerradoEn ? hora(t.cerradoEn) : 'abierto'} · ${duracion(t.abiertoEn, t.cerradoEn)}`}
        onClose={onClose}
        footer={
          abierto ? (
            <div className="flex w-full flex-wrap gap-2">
              <button className="btn-ghost" onClick={() => setForzar(true)}>
                <Lock className="h-4 w-4" /> Cerrar este turno
              </button>
              <BotonExcel path={`/caja/exportar/turno/${t.id}`} label="Excel del turno" />
            </div>
          ) : t.estado === 'cerrado' ? (
            <div className="flex w-full flex-wrap gap-2">
              <BotonExcel path={`/caja/exportar/turno/${t.id}`} label="Excel" />
              <input className="input flex-1" placeholder="Nota de revisión (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />
              <button className="btn-primary" disabled={revisar.isPending} onClick={() => revisar.mutate()}>
                <CheckCheck className="h-4 w-4" /> Marcar revisado
              </button>
            </div>
          ) : (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-ok">✓ Revisado{t.notaDueno ? ` · “${t.notaDueno}”` : ''}</p>
              <BotonExcel path={`/caja/exportar/turno/${t.id}`} label="Excel del turno" />
            </div>
          )
        }
      >
        <div className={cx('grid grid-cols-2 gap-3 rounded-2xl border p-5 md:grid-cols-4', !abierto && t.declaro && t.diferencia < 0 ? 'hazard border-bad/30' : 'border-white/[0.06] bg-white/[0.02]')}>
          <div>
            <p className="label">Vendido</p>
            <p className="tnum font-wide text-xl text-white">{money(t.totalVendidoRef)}</p>
            {t.fiadoRef > 0 && <p className="text-xs text-warn">fiado {money(t.fiadoRef)}</p>}
          </div>
          <div>
            <p className="label">Gastos caja</p>
            <p className="tnum font-wide text-xl text-bad">{money(t.egresosRef)}</p>
            {t.ingresosRef > 0 && <p className="text-xs text-ok">ingresos {money(t.ingresosRef)}</p>}
          </div>
          <div>
            <p className="label">Entregó</p>
            <p className="tnum font-wide text-xl text-steel-100">{abierto ? '—' : money(t.totalDeclaradoRef)}</p>
          </div>
          <div>
            <p className="label">{abierto ? 'En curso' : 'Resultado'}</p>
            {abierto ? <Diferencia n={0} abierto /> : <p className={cx('tnum font-wide text-xl', !t.declaro ? 'text-warn' : t.diferencia < 0 ? 'text-bad' : t.diferencia > 0 ? 'text-sky-300' : 'text-ok')}>{t.declaro ? moneySigned(t.diferencia) : 'Sin declarar'}</p>}
          </div>
        </div>

        <h4 className="label mt-6">Arqueo por método y moneda</h4>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
          <table className="table-base text-[13px]">
            <thead>
              <tr>
                <th>Método</th>
                <th className="text-right">Cobrado</th>
                <th className="text-right">Vueltos</th>
                <th className="text-right">Gastos</th>
                <th className="text-right">Esperado</th>
                <th className="text-right">Entregó</th>
                <th className="text-right">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {t.metodos.map((m) => (
                <tr key={m.metodo + m.moneda}>
                  <td className="font-bold text-steel-200">
                    {m.nombre} <span className="text-steel-500">{INFO[m.moneda].simbolo}</span>
                    {m.fondo > 0 && <span className="block text-[11px] font-normal text-steel-500">+ fondo {fmt(m.fondo, m.moneda)}</span>}
                    {m.ingresos > 0 && <span className="block text-[11px] font-normal text-ok">+ ingresos {fmt(m.ingresos, m.moneda)}</span>}
                  </td>
                  <td className="tnum text-right text-steel-300">{fmt(m.cobrado, m.moneda)}</td>
                  <td className="tnum text-right text-steel-500">{m.vueltos ? `−${fmt(m.vueltos, m.moneda)}` : '—'}</td>
                  <td className="tnum text-right text-steel-500">{m.egresos ? `−${fmt(m.egresos, m.moneda)}` : '—'}</td>
                  <td className="tnum text-right font-bold text-steel-100">{fmt(m.esperado, m.moneda)}</td>
                  <td className="tnum text-right text-steel-100">{abierto ? '—' : fmt(m.declarado, m.moneda)}</td>
                  <td className={cx('tnum text-right font-bold', abierto ? 'text-steel-600' : m.diferencia < 0 ? 'text-bad' : m.diferencia > 0 ? 'text-sky-300' : 'text-ok')}>
                    {abierto ? '—' : signoMoneda(m.diferencia, m.moneda)}
                    {!abierto && m.diferencia !== 0 && m.moneda !== t.monedaRef && <span className="block text-[11px] font-normal text-steel-500">≈ {moneySigned(m.diferenciaRef)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {t.notaCajero && <p className="mt-4 rounded-xl bg-white/[0.03] p-3 text-sm text-steel-300">📝 {t.cajero}: “{t.notaCajero}”</p>}

        {t.movimientos.length > 0 && (
          <>
            <h4 className="label mt-6">Gastos e ingresos del turno</h4>
            <div className="space-y-2">
              {t.movimientos.map((m) => (
                <div key={m.id} className={cx('flex items-center gap-3 rounded-xl bg-white/[0.02] px-4 py-2.5', m.anulado && 'opacity-40 line-through')}>
                  {m.tipo === 'egreso' ? <ArrowUpCircle className="h-4 w-4 text-bad" /> : <ArrowDownCircle className="h-4 w-4 text-ok" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-steel-100">{m.concepto}</p>
                    <p className="text-xs text-steel-500">
                      {m.categoria} · {m.metodoNombre} · {hora(m.creadoEn)}
                    </p>
                  </div>
                  {m.comprobanteId && (
                    <a href={archivoUrl(m.comprobanteId)} target="_blank" rel="noreferrer" className="text-steel-400 hover:text-flame-400" title="Ver comprobante">
                      <FileImage className="h-4 w-4" />
                    </a>
                  )}
                  <span className={cx('tnum text-sm font-bold', m.tipo === 'egreso' ? 'text-bad' : 'text-ok')}>{fmt(Number(m.monto), m.moneda)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <h4 className="label mt-6">Ventas del turno ({t.operaciones})</h4>
        <div className="space-y-2">
          {t.ventas.map((v) => (
            <div key={v.id} className={cx('rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3', v.estado === 'anulada' && 'opacity-50')}>
              <div className="flex items-start gap-3">
                <span className="tnum w-16 shrink-0 text-sm text-steel-500">{hora(v.creadoEn)}</span>
                <div className="min-w-0 flex-1">
                  <p className={cx('text-sm font-bold text-steel-100', v.estado === 'anulada' && 'line-through')}>
                    {(v.items ?? []).map((i) => `${i.descripcion}${i.cantidad > 1 ? ` ×${i.cantidad}` : ''} (${fmt(Number(i.subtotal), i.moneda)})`).join(' · ')}
                  </p>
                  <p className="text-xs text-steel-500">
                    #{v.numero} · {v.socio ?? 'Ocasional'}
                  </p>
                  <p className="text-xs text-steel-400">
                    {(v.pagos ?? [])
                      .map((p) => (p.vuelto ? `vuelto ${p.metodo} ${fmt(Math.abs(p.montoMoneda), p.moneda)}` : `${p.metodo} ${fmt(p.montoMoneda, p.moneda)}${p.referencia ? ` (ref ${p.referencia})` : ''}`))
                      .join(' · ') || 'Fiado'}
                  </p>
                  {Number(v.pagadoRef) < Number(v.totalRef) && <p className="text-xs text-warn">Quedó debiendo {money(Number(v.totalRef) - Number(v.pagadoRef))}</p>}
                  {v.motivoAnulacion && <p className="text-xs text-bad">Anulada: {v.motivoAnulacion}</p>}
                </div>
                <span className="tnum font-display font-extrabold text-white">{money(Number(v.totalRef))}</span>
                {v.estado === 'pagada' && (
                  <button className="rounded-lg p-1.5 text-steel-500 hover:bg-bad/10 hover:text-bad" title="Anular" onClick={() => setAnular(v)}>
                    <Ban className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Drawer>
      {anular && <AnularVenta venta={{ ...anular, totalRef: Number(anular.totalRef) }} onClose={() => setAnular(null)} onDone={refrescar} />}
      {forzar && (
        <Modal
          title="Cerrar turno de la cajera"
          size="sm"
          onClose={() => setForzar(false)}
          footer={
            <button className="btn-primary" disabled={cerrar.isPending} onClick={() => cerrar.mutate()}>
              Cerrar turno
            </button>
          }
        >
          <p className="text-sm text-steel-400">Úsalo si {t.cajero} olvidó cerrar. Quedará sin declaración de lo entregado; anota lo que recibiste.</p>
          <input className="input mt-4" placeholder="Nota (ej. recibí COP 120.000 en efectivo)" value={nota} onChange={(e) => setNota(e.target.value)} />
        </Modal>
      )}
    </>
  );
}

export default function Cierres() {
  const [desde, setDesde] = useState(sumarDias(hoyISO(), -6));
  const [hasta, setHasta] = useState(hoyISO());
  const [estado, setEstado] = useState<'' | 'abierto' | 'cerrado' | 'revisado'>('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['turnos', desde, hasta, estado],
    queryFn: () => api<ResumenTurno[]>('/caja/turnos', { query: { desde, hasta, estado: estado || undefined } }),
    refetchInterval: 30_000,
  });
  const cerrados = (data ?? []).filter((t) => t.estado !== 'abierto');
  const totalVendido = (data ?? []).reduce((s, t) => s + t.totalVendidoRef, 0);
  const balance = cerrados.reduce((s, t) => s + t.diferencia, 0);

  return (
    <div>
      <PageHeader
        title="Cierres de caja"
        kicker="Caja ciega"
        actions={<BotonExcel className="btn-primary" path="/caja/exportar/cierres" query={{ desde, hasta, estado: estado || undefined }} label="Descargar Excel de cierres" />}
      >
        Lo esperado contra lo que cada cajera entregó, por método y por moneda. El Excel trae el resumen de cada turno, el arqueo por método, los totales, las ventas y los movimientos de las fechas elegidas.
      </PageHeader>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Field label="Desde">
          <input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </Field>
        <Field label="Hasta">
          <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </Field>
        <Tabs
          value={estado}
          onChange={setEstado}
          items={[
            { value: '', label: 'Todos' },
            { value: 'abierto', label: 'Abiertos' },
            { value: 'cerrado', label: 'Por revisar' },
            { value: 'revisado', label: 'Revisados' },
          ]}
        />
        <div className="ml-auto flex gap-6 text-right">
          <div>
            <p className="label">Vendido</p>
            <p className="tnum font-wide text-xl text-white">{money(totalVendido)}</p>
          </div>
          <div>
            <p className="label">Balance cierres</p>
            <p className={cx('tnum font-wide text-xl', balance < 0 ? 'text-bad' : balance > 0 ? 'text-sky-300' : 'text-ok')}>{moneySigned(balance)}</p>
          </div>
        </div>
      </div>
      <div className="card overflow-hidden">
        {isLoading ? (
          <Loading />
        ) : !data?.length ? (
          <Empty icon={<Vault className="h-7 w-7" />} title="Sin turnos en estas fechas" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Turno</th>
                  <th>Horario</th>
                  <th className="text-right">Vendido</th>
                  <th className="text-right">Gastos</th>
                  <th className="text-right">Entregó</th>
                  <th>Resultado</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.map((t) => (
                  <tr key={t.id} className="cursor-pointer" onClick={() => setAbierto(t.id)}>
                    <td>
                      <p className="font-bold text-steel-100">
                        #{t.numero} · {t.cajero}
                      </p>
                      <p className="text-xs text-steel-500">
                        {t.operaciones} venta(s){t.anuladas ? ` · ${t.anuladas} anulada(s)` : ''}
                      </p>
                    </td>
                    <td className="text-steel-400">
                      {fechaHora(t.abiertoEn)} → {t.cerradoEn ? hora(t.cerradoEn) : '…'}
                    </td>
                    <td className="tnum text-right font-bold text-white">{money(t.totalVendidoRef)}</td>
                    <td className="tnum text-right text-steel-400">{t.egresosRef ? money(t.egresosRef) : '—'}</td>
                    <td className="tnum text-right text-steel-300">{t.estado === 'abierto' ? '—' : money(t.totalDeclaradoRef)}</td>
                    <td>
                      <Diferencia n={t.diferencia} declaro={t.declaro} abierto={t.estado === 'abierto'} />
                    </td>
                    <td>
                      <span className={cx('chip', t.estado === 'abierto' ? 'border-flame-500/30 text-flame-400' : t.estado === 'cerrado' ? 'border-warn/30 text-warn' : 'border-white/10 text-steel-500')}>
                        {t.estado === 'cerrado' ? 'Por revisar' : t.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {abierto && <TurnoDrawer id={abierto} onClose={() => setAbierto(null)} />}
    </div>
  );
}
