/**
 * Entrenamiento personalizado: quién pagó y quién no, por entrenador.
 * La recepción lo usa para cobrar y recordar; el dueño ve además el dinero
 * (lo cobrado en el mes y lo que falta pagarle a cada entrenador).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarCheck, CheckCircle2, Clock, HandCoins, MessageCircle, Pencil, Plus, Search, ShoppingCart, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AsignarPersonalizadoModal, EditarPersonalizadoModal } from '../../components/AjustesAdmin';
import { EntrenadorAvatar } from '../../components/entrenadores';
import { Paginacion, Th, useTabla } from '../../components/Tabla';
import { Avatar, cx, Empty, Loading, PageHeader, Stat, Tabs } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fecha, fechaDia } from '../../lib/format';
import type { EstadoPersonalizado } from '../../lib/types';

interface Fila {
  socioId: string;
  codigo: number;
  nombre: string;
  telefono: string | null;
  tieneFoto: boolean;
  entrenadorId: string;
  entrenador: string;
  estado: EstadoPersonalizado;
  estadoTexto: string;
  desde: string | null;
  hasta: string | null;
  diasRestantes: number;
  ultimoPago: { fecha: string; ticket: number | null; precioTexto: string; duracion: string; sinCobro?: boolean } | null;
  ultimo: { id: number; fechaInicio: string; fechaFin: string } | null;
  deudaTexto: string | null;
  pagos: number;
}
interface ResumenEntrenador {
  id: string;
  nombre: string;
  especialidad: string | null;
  tieneFoto: boolean;
  tarifaTexto: string | null;
  semanalTexto: string | null;
  comision: number;
  clientes: number;
  alDia: number;
  vencen: number;
  vencidos: number;
  deben: number;
  sinPago: number;
  cobradoMesTexto?: string;
  porPagarTexto?: string;
  retenidoTexto?: string | null;
}
interface Respuesta {
  filas: Fila[];
  entrenadores: ResumenEntrenador[];
  totales: { cobradoMesTexto: string; clientesMes: number } | null;
}

export const ESTADOS_PZ: Record<EstadoPersonalizado, { label: string; clase: string; icon: typeof CheckCircle2 }> = {
  al_dia: { label: 'Al día', clase: 'border-ok/30 bg-ok/[0.08] text-ok', icon: CheckCircle2 },
  por_empezar: { label: 'Pagado', clase: 'border-ok/30 bg-ok/[0.05] text-ok', icon: CalendarCheck },
  vence: { label: 'Vence pronto', clase: 'border-warn/30 bg-warn/[0.08] text-warn', icon: Clock },
  vencido: { label: 'Vencido', clase: 'border-bad/30 bg-bad/[0.08] text-bad', icon: AlertTriangle },
  debe: { label: 'Debe', clase: 'border-sky-400/30 bg-sky-400/[0.08] text-sky-300', icon: HandCoins },
  sin_pago: { label: 'Sin pagar', clase: 'border-white/10 bg-white/[0.03] text-steel-400', icon: UserPlus },
};

export function EstadoPz({ estado, texto }: { estado: EstadoPersonalizado; texto?: string }) {
  const e = ESTADOS_PZ[estado];
  return (
    <span className={cx('chip gap-1', e.clase)} title={texto}>
      <e.icon className="h-3 w-3" /> {e.label}
    </span>
  );
}

/** Mensaje de WhatsApp para recordarle al cliente. */
function enlaceWhatsapp(f: Fila) {
  if (!f.telefono) return null;
  const d = f.telefono.replace(/\D/g, '');
  if (d.length < 7) return null;
  const tel = d.startsWith('0') ? `58${d.slice(1)}` : d;
  const nombre = f.nombre.split(' ')[0];
  const motivo =
    f.estado === 'debe'
      ? `tiene un saldo pendiente de ${f.deudaTexto}`
      : f.estado === 'vencido'
        ? `venció el ${fechaDia(f.hasta)}`
        : f.estado === 'vence'
          ? `vence el ${fechaDia(f.hasta)}`
          : 'está listo para empezar';
  const texto = `¡Hola ${nombre}! Te escribimos de MERKGUSTO GYM 💪. Tu entrenamiento personalizado con ${f.entrenador} ${motivo}. Puedes renovarlo en recepción para no perder tu progreso. ¡Te esperamos!`;
  return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
}

type Filtro = 'todos' | 'cobrar' | 'al_dia' | 'sin_pago';

export default function Personalizados() {
  const { user } = useAuth();
  const gestion = user?.rol !== 'cajero';
  const [entrenador, setEntrenador] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('cobrar');
  const [buscar, setBuscar] = useState('');
  const [asignar, setAsignar] = useState(false);
  const [editar, setEditar] = useState<Fila | null>(null);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['personalizados'], queryFn: () => api<Respuesta>('/personalizados'), refetchInterval: 60_000 });

  const delEntrenador = useMemo(() => (data?.filas ?? []).filter((f) => !entrenador || f.entrenadorId === entrenador), [data, entrenador]);
  const filas = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return delEntrenador.filter((f) => {
      if (filtro === 'cobrar' && !['vencido', 'vence', 'debe'].includes(f.estado)) return false;
      if (filtro === 'al_dia' && !['al_dia', 'por_empezar'].includes(f.estado)) return false;
      if (filtro === 'sin_pago' && f.estado !== 'sin_pago') return false;
      return !q || f.nombre.toLowerCase().includes(q) || String(f.codigo) === q || f.entrenador.toLowerCase().includes(q);
    });
  }, [delEntrenador, filtro, buscar]);
  const cuenta = (...e: EstadoPersonalizado[]) => delEntrenador.filter((f) => e.includes(f.estado)).length;

  const t = useTabla(
    filas,
    {
      estado: { label: 'Estado', valor: (f) => ORDEN_ESTADO[f.estado] },
      nombre: { label: 'Cliente', valor: (f) => f.nombre },
      entrenador: { label: 'Entrenador', valor: (f) => f.entrenador },
      hasta: { label: 'Pagado hasta', valor: (f) => f.hasta },
      ultimo: { label: 'Último pago', valor: (f) => f.ultimoPago?.fecha },
    },
    { id: 'personalizados', orden: { col: 'estado', dir: 'asc' } },
  );

  if (isLoading || !data) return <Loading />;
  const ent = data.entrenadores.find((e) => e.id === entrenador);

  return (
    <div>
      <PageHeader
        title="Personalizados"
        kicker="Entrenamiento personalizado"
        actions={
          <button className="btn-primary" onClick={() => setAsignar(true)}>
            <Plus className="h-4 w-4" /> Asignar cliente
          </button>
        }
      >
        Quién pagó su personalizado y quién no, con cada entrenador. Se cobra en <b className="text-steel-200">Cobrar › Personalizado</b>.
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat accent label="Al día" value={cuenta('al_dia', 'por_empezar')} icon={<CheckCircle2 className="h-4 w-4" />} />
        <Stat label="Vencen pronto" value={cuenta('vence')} hint="5 días o menos" icon={<Clock className="h-4 w-4" />} />
        <Stat label="Vencidos" value={cuenta('vencido')} hint="Hay que cobrarles" icon={<AlertTriangle className="h-4 w-4" />} />
        <Stat label="Deben saldo" value={cuenta('debe')} hint="Pagaron una parte" icon={<HandCoins className="h-4 w-4" />} />
        {gestion && data.totales ? (
          <Stat label="Cobrado este mes" value={data.totales.cobradoMesTexto} hint={`${data.totales.clientesMes} cliente(s)`} />
        ) : (
          <Stat label="Asignados sin pagar" value={cuenta('sin_pago')} hint="Nunca han pagado personalizado" icon={<UserPlus className="h-4 w-4" />} />
        )}
      </div>

      {data.entrenadores.length === 0 ? (
        <Empty
          icon={<Users className="h-7 w-7" />}
          title="Ningún entrenador ofrece personalizado"
          hint={gestion ? 'Ponle su tarifa en Panel › Entrenadores › (entrenador) › Personalizado.' : 'El dueño configura la tarifa de cada entrenador.'}
        />
      ) : (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.entrenadores.map((e) => {
            const sel = entrenador === e.id;
            return (
              <button
                key={e.id}
                onClick={() => setEntrenador(sel ? null : e.id)}
                className={cx('card card-hover p-4 text-left transition', sel && 'border-flame-500/60 ring-2 ring-flame-500/30')}
              >
                <div className="flex items-center gap-3">
                  <EntrenadorAvatar e={e} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-steel-100">{e.nombre}</p>
                    <p className="truncate text-xs text-steel-500">{e.tarifaTexto ?? 'Sin tarifa'}{e.semanalTexto && ` · ${e.semanalTexto}`}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold">
                  <span className="chip border-ok/25 text-ok">{e.alDia} al día</span>
                  {e.vencen > 0 && <span className="chip border-warn/25 text-warn">{e.vencen} vencen</span>}
                  {e.vencidos > 0 && <span className="chip border-bad/25 text-bad">{e.vencidos} vencidos</span>}
                  {e.deben > 0 && <span className="chip border-sky-400/25 text-sky-300">{e.deben} deben</span>}
                  {e.sinPago > 0 && <span className="chip border-white/10 text-steel-400">{e.sinPago} sin pagar</span>}
                </div>
                {gestion && e.porPagarTexto !== undefined && (
                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-ink-950/50 p-2.5 text-xs">
                    <div>
                      <p className="text-steel-500">Cobrado este mes</p>
                      <p className="tnum font-bold text-steel-100">{e.cobradoMesTexto}</p>
                    </div>
                    <div>
                      <p className="text-steel-500">Por pagarle ({e.comision}%)</p>
                      <p className="tnum font-bold text-flame-300">{e.porPagarTexto}</p>
                      {e.retenidoTexto && <p className="text-[10px] text-sky-300">+ {e.retenidoTexto} cuando le paguen</p>}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs
          value={filtro}
          onChange={setFiltro}
          items={[
            { value: 'cobrar', label: `Por cobrar (${cuenta('vencido', 'vence', 'debe')})` },
            { value: 'al_dia', label: `Al día (${cuenta('al_dia', 'por_empezar')})` },
            { value: 'sin_pago', label: `Sin pagar (${cuenta('sin_pago')})` },
            { value: 'todos', label: `Todos (${delEntrenador.length})` },
          ]}
        />
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
          <input className="input pl-10" placeholder="Buscar cliente o entrenador…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </div>
      </div>
      {ent && (
        <p className="mb-3 text-sm text-steel-400">
          Viendo solo a los clientes de <b className="text-steel-100">{ent.nombre}</b>.{' '}
          <button className="font-bold text-flame-400 hover:underline" onClick={() => setEntrenador(null)}>
            Ver todos
          </button>
        </p>
      )}

      <div className="card overflow-hidden">
        {filas.length === 0 ? (
          <Empty
            icon={<CheckCircle2 className="h-7 w-7" />}
            title={filtro === 'cobrar' ? 'Nadie pendiente por cobrar' : 'No hay clientes aquí'}
            hint={filtro === 'cobrar' ? 'Todos los personalizados están al día.' : 'Prueba con otro filtro.'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th><Th t={t} col="nombre">Cliente</Th></th>
                    <th><Th t={t} col="entrenador">Entrenador</Th></th>
                    <th><Th t={t} col="estado">Estado</Th></th>
                    <th><Th t={t} col="hasta">Pagado hasta</Th></th>
                    <th><Th t={t} col="ultimo">Último pago</Th></th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {t.visibles.map((f) => {
                    const wa = ['vencido', 'vence', 'debe', 'por_empezar'].includes(f.estado) ? enlaceWhatsapp(f) : null;
                    return (
                      <tr key={`${f.socioId}|${f.entrenadorId}`}>
                        <td>
                          <div className="flex items-center gap-3">
                            <Avatar socioId={f.socioId} nombre={f.nombre} tieneFoto={f.tieneFoto} size={36} />
                            <div>
                              <p className="font-bold text-steel-100">{f.nombre}</p>
                              <p className="text-xs text-steel-500">#{f.codigo}{f.telefono && ` · ${f.telefono}`}</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-steel-300">{f.entrenador}</td>
                        <td>
                          <EstadoPz estado={f.estado} />
                          <p className="mt-1 text-xs text-steel-500">{f.estadoTexto}</p>
                        </td>
                        <td className="tnum text-steel-300">{f.hasta ? fechaDia(f.hasta) : '—'}</td>
                        <td className="text-xs text-steel-400">
                          {f.ultimoPago ? (
                            <>
                              <p className="text-steel-300">
                                {fecha(f.ultimoPago.fecha)} · {f.ultimoPago.duracion}
                              </p>
                              <p className="tnum">
                                {f.ultimoPago.precioTexto}
                                {f.ultimoPago.ticket && ` · ticket #${f.ultimoPago.ticket}`}
                                {f.pagos > 1 && ` · ${f.pagos} pagos`}
                              </p>
                            </>
                          ) : (
                            'Nunca'
                          )}
                        </td>
                        <td>
                          <div className="flex justify-end gap-2">
                            {gestion && f.ultimo && (
                              <button className="btn-ghost btn-sm" onClick={() => setEditar(f)} title="Cambiar fechas (no pasa por caja)">
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            {wa && (
                              <a href={wa} target="_blank" rel="noreferrer" className="btn-ghost btn-sm" title="Recordarle por WhatsApp">
                                <MessageCircle className="h-4 w-4 text-ok" />
                              </a>
                            )}
                            <Link to={f.estado === 'debe' ? `/mostrador?cliente=${f.socioId}` : `/mostrador?cliente=${f.socioId}&personalizado=${f.entrenadorId}`} className="btn-primary btn-sm">
                              <ShoppingCart className="h-4 w-4" /> {f.estado === 'debe' ? 'Abonar' : f.estado === 'sin_pago' ? 'Cobrar' : 'Renovar'}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Paginacion t={t} />
          </>
        )}
      </div>
      {asignar && <AsignarPersonalizadoModal onClose={() => setAsignar(false)} />}
      {editar && (
        <EditarPersonalizadoModal
          p={{ ...editar, ultimo: editar.ultimo, sinCobro: !!editar.ultimoPago?.sinCobro }}
          onClose={() => setEditar(null)}
          onDone={() => void qc.invalidateQueries({ queryKey: ['personalizados'] })}
        />
      )}
    </div>
  );
}

const ORDEN_ESTADO: Record<EstadoPersonalizado, number> = { debe: 0, vencido: 1, vence: 2, sin_pago: 3, por_empezar: 4, al_dia: 5 };
