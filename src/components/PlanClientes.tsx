import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, CalendarClock, CheckCircle2, History, Phone, Search, Snowflake, Trash2, TriangleAlert, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { fecha, sumarDias } from '../lib/format';
import type { Plan } from '../lib/types';
import { SocioDrawer } from './socios';
import { Paginacion, Th, useTabla } from './Tabla';
import { cx, Loading, Modal } from './ui';

interface ClienteVigente {
  socioId: string;
  nombre: string;
  apellido: string;
  cedula: string | null;
  telefono: string | null;
  /** Primer día pagado del bloque con este plan */
  desde: string;
  /** Último día cubierto (incluye renovaciones ya pagadas) */
  hasta: string;
  renovaciones: number;
  congelada: boolean;
  congeladaDesde: string | null;
  porEmpezar: boolean;
  diasRestantes: number | null;
}
interface ClienteAnterior {
  socioId: string;
  nombre: string;
  apellido: string;
  cedula: string | null;
  telefono: string | null;
  ultimaFin: string;
}
interface UsoPlan {
  plan: { id: number; nombre: string; duracion: string };
  vigentes: ClienteVigente[];
  anteriores: ClienteAnterior[];
  tieneHistorial: boolean;
}

function EstadoCliente({ c }: { c: ClienteVigente }) {
  if (c.congelada)
    return (
      <span className="chip border-sky-400/30 text-sky-300">
        <Snowflake className="h-3 w-3" /> Congelada {c.congeladaDesde ? `desde ${fecha(c.congeladaDesde)}` : ''}
      </span>
    );
  if (c.porEmpezar) return <span className="chip border-white/15 text-steel-300">Empieza el {fecha(c.desde)}</span>;
  const d = c.diasRestantes ?? 0;
  if (d <= 1) return <span className="chip border-bad/30 bg-bad/10 text-bad">Vence hoy</span>;
  if (d <= 5) return <span className="chip border-warn/30 bg-warn/10 text-warn">Quedan {d} días</span>;
  return <span className="chip border-ok/30 text-ok">Quedan {d} días</span>;
}

const nombreCompleto = (c: { nombre: string; apellido: string }) => `${c.nombre} ${c.apellido}`.trim();

/**
 * Clientes de un plan, con sus fechas de mensualidad. Con `eliminar` además
 * guía el borrado: qué pasa con los vigentes (siguen o pasan a otro plan).
 */
export function PlanClientesModal({ plan, eliminar, planes, onClose }: { plan: Plan; eliminar?: boolean; planes: Plan[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [buscar, setBuscar] = useState('');
  const [verAnteriores, setVerAnteriores] = useState(false);
  const [modo, setModo] = useState<'dejar' | 'mover'>('dejar');
  const [destinoId, setDestinoId] = useState<number | ''>('');
  const [socioId, setSocioId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['plan-uso', plan.id], queryFn: () => api<UsoPlan>(`/planes/${plan.id}/uso`) });

  const otros = planes.filter((p) => p.id !== plan.id);
  const filtrar = <T extends { nombre: string; apellido: string; cedula: string | null; telefono: string | null }>(l: T[]) => {
    const q = buscar.trim().toLowerCase();
    if (!q) return l;
    return l.filter((c) => `${nombreCompleto(c)} ${c.cedula ?? ''} ${c.telefono ?? ''}`.toLowerCase().includes(q));
  };
  const vigentes = useMemo(() => filtrar(data?.vigentes ?? []), [data, buscar]); // eslint-disable-line react-hooks/exhaustive-deps
  const anteriores = useMemo(() => filtrar(data?.anteriores ?? []), [data, buscar]); // eslint-disable-line react-hooks/exhaustive-deps
  const tv = useTabla(
    vigentes,
    {
      nombre: { label: 'Cliente', valor: (c) => nombreCompleto(c) },
      desde: { label: 'Pagó desde', valor: (c) => c.desde },
      hasta: { label: 'Vence', valor: (c) => c.hasta },
      proximo: { label: 'Próxima mensualidad', valor: (c) => (c.congelada ? null : c.hasta) },
      estado: { label: 'Estado', valor: (c) => (c.congelada ? 'congelada' : c.porEmpezar ? 'por empezar' : 'vigente') },
    },
    { id: 'plan-vigentes', orden: { col: 'hasta', dir: 'asc' }, porPagina: 10 },
  );
  const ta = useTabla(
    anteriores,
    {
      nombre: { label: 'Cliente', valor: (c) => nombreCompleto(c) },
      telefono: { label: 'Teléfono', valor: (c) => c.telefono },
      fin: { label: 'Venció el', valor: (c) => c.ultimaFin },
    },
    { id: 'plan-anteriores', orden: { col: 'fin', dir: 'desc' }, porPagina: 10 },
  );
  const nVig = data?.vigentes.length ?? 0;
  const nAnt = data?.anteriores.length ?? 0;
  const destino = otros.find((p) => p.id === destinoId);

  const m = useMutation({
    mutationFn: () => api<{ resultado: 'borrado' | 'archivado'; movidos: number; destino: string | null }>(`/planes/${plan.id}`, { method: 'DELETE', body: nVig ? { modo, destinoId: modo === 'mover' ? destinoId || undefined : undefined } : {} }),
    onSuccess: (r) => {
      toast.success(
        r.destino
          ? `Plan «${plan.nombre}» eliminado. ${nVig} cliente(s) pasaron a «${r.destino}» con las mismas fechas.`
          : nVig
            ? `Plan «${plan.nombre}» eliminado. Sus ${nVig} cliente(s) siguen hasta su vencimiento.`
            : `Plan «${plan.nombre}» eliminado.`,
      );
      for (const k of ['planes', 'planes-eliminados', 'catalogo', 'socios', 'socio']) void qc.invalidateQueries({ queryKey: [k] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const puedeEliminar = !m.isPending && !!data && !(nVig && modo === 'mover' && !destinoId);

  return (
    <>
      <Modal
        size="lg"
        onClose={onClose}
        title={
          <span className="flex items-center gap-2">
            {eliminar ? <Trash2 className="h-5 w-5 text-bad" /> : <Users className="h-5 w-5 text-flame-400" />}
            {eliminar ? `Eliminar plan «${plan.nombre}»` : `Clientes de «${plan.nombre}»`}
          </span>
        }
        footer={
          eliminar ? (
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <button className="btn-ghost" onClick={onClose}>
                Cancelar
              </button>
              <button className="btn-danger" disabled={!puedeEliminar} onClick={() => m.mutate()}>
                <Trash2 className="h-4 w-4" />
                {!nVig ? 'Eliminar plan' : modo === 'mover' ? `Pasar ${nVig} y eliminar` : `Eliminar y dejar a ${nVig} hasta vencer`}
              </button>
            </div>
          ) : undefined
        }
      >
        {isLoading || !data ? (
          <Loading />
        ) : (
          <div className="space-y-5">
            {/* Resumen */}
            <div className="grid grid-cols-2 gap-3">
              <div className={cx('rounded-2xl border p-4', nVig ? 'border-flame-500/30 bg-flame-500/[0.06]' : 'border-white/[0.06]')}>
                <p className="text-xs uppercase tracking-wider text-steel-500">Con el plan vigente</p>
                <p className="mt-1 font-display text-3xl font-extrabold text-white">{nVig}</p>
                <p className="text-xs text-steel-400">{nVig === 1 ? 'cliente' : 'clientes'} pagando este plan hoy</p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] p-4">
                <p className="text-xs uppercase tracking-wider text-steel-500">Lo tuvieron antes</p>
                <p className="mt-1 font-display text-3xl font-extrabold text-white">{nAnt}</p>
                <p className="text-xs text-steel-400">ya vencidos (queda en su historial)</p>
              </div>
            </div>

            {eliminar && !data.tieneHistorial && (
              <div className="flex items-start gap-3 rounded-2xl border border-ok/30 bg-ok/[0.06] p-4 text-sm">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ok" />
                <p className="text-steel-200">Este plan nunca se ha vendido. Se borra por completo y no afecta a ningún cliente.</p>
              </div>
            )}
            {eliminar && data.tieneHistorial && !nVig && (
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 p-4 text-sm">
                <History className="mt-0.5 h-5 w-5 shrink-0 text-steel-400" />
                <p className="text-steel-300">Nadie lo tiene vigente. El plan desaparece de caja y del catálogo, pero las membresías pasadas se conservan en el historial de cada cliente. Si te equivocas, lo puedes restaurar.</p>
              </div>
            )}

            {(nVig > 0 || nAnt > 0) && (nVig + nAnt > 6) && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
                <input className="input pl-9" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por nombre, cédula o teléfono…" />
              </div>
            )}

            {/* Vigentes */}
            {nVig > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
                  <CalendarClock className="h-4 w-4 text-flame-400" /> Clientes con este plan vigente
                </p>
                <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
                  <div className="overflow-x-auto">
                    <table className="table-base">
                      <thead>
                        <tr>
                          <th><Th t={tv} col="nombre" /></th>
                          <th><Th t={tv} col="desde" /></th>
                          <th><Th t={tv} col="hasta" /></th>
                          <th><Th t={tv} col="proximo" /></th>
                          <th><Th t={tv} col="estado" /></th>
                        </tr>
                      </thead>
                      <tbody>
                        {tv.visibles.map((c) => (
                          <tr key={c.socioId} className="cursor-pointer hover:bg-white/[0.03]" onClick={() => setSocioId(c.socioId)}>
                            <td>
                              <p className="font-bold text-steel-100">{nombreCompleto(c)}</p>
                              <p className="flex flex-wrap gap-x-3 text-xs text-steel-500">
                                {c.cedula && <span>C.I. {c.cedula}</span>}
                                {c.telefono && (
                                  <span className="inline-flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {c.telefono}
                                  </span>
                                )}
                              </p>
                            </td>
                            <td className="tnum whitespace-nowrap text-steel-300">{fecha(c.desde)}</td>
                            <td className="tnum whitespace-nowrap font-bold text-white">
                              {fecha(c.hasta)}
                              {c.renovaciones > 0 && <span className="block text-xs font-normal text-steel-500">incluye {c.renovaciones} renovación(es) pagada(s)</span>}
                            </td>
                            <td className="tnum whitespace-nowrap text-flame-300">{c.congelada ? '—' : fecha(sumarDias(c.hasta, 1))}</td>
                            <td>
                              <EstadoCliente c={c} />
                            </td>
                          </tr>
                        ))}
                        {!vigentes.length && (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-steel-500">
                              Nadie coincide con «{buscar}»
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <Paginacion t={tv} />
                </div>
                <p className="mt-1.5 text-xs text-steel-500">Toca un cliente para ver su ficha completa.</p>
              </div>
            )}

            {/* Qué pasa con los vigentes */}
            {eliminar && nVig > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
                  <TriangleAlert className="h-4 w-4 text-warn" /> ¿Qué pasa con estos {nVig} cliente(s)?
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setModo('dejar')}
                    className={cx('rounded-2xl border p-4 text-left transition', modo === 'dejar' ? 'border-flame-500/60 bg-flame-500/[0.08]' : 'border-white/[0.08] hover:border-white/20')}
                  >
                    <p className="flex items-center gap-2 font-bold text-white">
                      <CalendarClock className="h-4 w-4" /> Siguen hasta que venzan
                    </p>
                    <p className="mt-1 text-xs text-steel-400">Conservan sus fechas y su acceso. Cuando renueven, en caja eligen otro plan.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModo('mover')}
                    disabled={!otros.length}
                    className={cx('rounded-2xl border p-4 text-left transition disabled:opacity-40', modo === 'mover' ? 'border-flame-500/60 bg-flame-500/[0.08]' : 'border-white/[0.08] hover:border-white/20')}
                  >
                    <p className="flex items-center gap-2 font-bold text-white">
                      <ArrowRightLeft className="h-4 w-4" /> Pasarlos a otro plan
                    </p>
                    <p className="mt-1 text-xs text-steel-400">Mismas fechas de pago y vencimiento, sin cobrar nada. El lector se actualiza solo.</p>
                  </button>
                </div>
                {modo === 'mover' && (
                  <div className="mt-3">
                    <select className="input" value={destinoId} onChange={(e) => setDestinoId(e.target.value ? Number(e.target.value) : '')}>
                      <option value="">Elige el plan al que pasan…</option>
                      {otros.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} · {p.duracion}
                          {p.activo === false ? ' (oculto en caja)' : ''}
                        </option>
                      ))}
                    </select>
                    {destino && destino.accesoLector !== plan.accesoLector && (
                      <p className="mt-2 text-xs text-warn">
                        Ojo: «{destino.nombre}» {destino.accesoLector ? 'sí' : 'no'} da acceso por el lector facial; «{plan.nombre}» {plan.accesoLector ? 'sí' : 'no'}.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Anteriores */}
            {nAnt > 0 && (
              <div>
                <button type="button" className="flex items-center gap-2 text-sm font-bold text-steel-300 hover:text-white" onClick={() => setVerAnteriores((v) => !v)}>
                  <History className="h-4 w-4" /> {verAnteriores ? 'Ocultar' : 'Ver'} quiénes lo tuvieron antes ({nAnt})
                </button>
                {verAnteriores && (
                  <div className="mt-2 overflow-x-auto rounded-2xl border border-white/[0.06]">
                    <table className="table-base">
                      <thead>
                        <tr>
                          <th><Th t={ta} col="nombre" /></th>
                          <th><Th t={ta} col="telefono" /></th>
                          <th><Th t={ta} col="fin" /></th>
                        </tr>
                      </thead>
                      <tbody>
                        {ta.visibles.map((c) => (
                          <tr key={c.socioId} className="cursor-pointer hover:bg-white/[0.03]" onClick={() => setSocioId(c.socioId)}>
                            <td>
                              <p className="text-steel-100">{nombreCompleto(c)}</p>
                              {c.cedula && <p className="text-xs text-steel-500">C.I. {c.cedula}</p>}
                            </td>
                            <td className="text-steel-400">{c.telefono ?? '—'}</td>
                            <td className="tnum whitespace-nowrap text-steel-300">{fecha(c.ultimaFin)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Paginacion t={ta} />
                  </div>
                )}
              </div>
            )}

            {!eliminar && !nVig && !nAnt && <p className="py-6 text-center text-sm text-steel-500">Ningún cliente ha comprado este plan todavía.</p>}
          </div>
        )}
      </Modal>
      {socioId && <SocioDrawer socioId={socioId} onClose={() => setSocioId(null)} />}
    </>
  );
}
