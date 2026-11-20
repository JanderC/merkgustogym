/**
 * Clientes del entrenador: su lista con alertas, buscar en el gimnasio para asignarse
 * clientes y la ficha de cada uno (progreso, rutina, clases, notas y su enlace).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  ClipboardCopy,
  Dumbbell,
  Flame,
  Link2,
  LineChart,
  MessageCircle,
  NotebookPen,
  Plus,
  Ruler,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Trophy,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AnilloDias, ChipAlerta, MedicionModal, ProgresoResumen, RutinaEditor, RutinaVista, Seccion, Titulo, type RutinaBase } from '../../components/app/AppUI';
import { Avatar, cx, Loading, Modal } from '../../components/ui';
import { apiCoach, sesionCoach } from '../../lib/api';
import { fecha, fechaCorta, hace, hora, hoyISO } from '../../lib/format';
import type { ClaseCoach, ClienteCoach, FichaCoach, Plantilla, RutinaCoach } from './tipos';
import { diaCorto, whatsappDe } from './tipos';

const FILTROS = [
  { v: 'todos', l: 'Todos' },
  { v: 'alertas', l: 'Atención' },
  { v: 'vence', l: 'Vencen' },
  { v: 'ausente', l: 'No vienen' },
  { v: 'sin_rutina', l: 'Sin rutina' },
] as const;

export function ClientesCoach() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const filtro = params.get('filtro') ?? 'todos';
  const [q, setQ] = useState('');
  const [buscarTodo, setBuscarTodo] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['coach-clientes'], queryFn: () => apiCoach<ClienteCoach[]>('/clientes') });
  const texto = q.trim().toLowerCase();
  const lista = (data ?? []).filter((c) => {
    if (texto && !`${c.nombre} ${c.apellido} ${c.codigo}`.toLowerCase().includes(texto)) return false;
    if (filtro === 'alertas') return c.alertas.some((a) => a.tipo !== 'medir');
    if (filtro !== 'todos') return c.alertas.some((a) => a.tipo === filtro);
    return true;
  });

  return (
    <div className="animate-rise">
      <Titulo
        kicker="Tu gente"
        accion={
          <button className="btn-primary" onClick={() => setBuscarTodo(true)}>
            <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">Agregar cliente</span>
          </button>
        }
      >
        Mis clientes
      </Titulo>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
        <input className="input pl-11" placeholder="Buscar entre tus clientes" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {FILTROS.map((f) => (
          <button
            key={f.v}
            onClick={() => setParams(f.v === 'todos' ? {} : { filtro: f.v }, { replace: true })}
            className={cx('shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition', filtro === f.v ? 'bg-flame-500 text-ink-950' : 'bg-white/[0.05] text-steel-400 hover:text-steel-100')}
          >
            {f.l}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Loading />
      ) : !data?.length ? (
        <div className="card mt-4 p-8 text-center">
          <UserPlus className="mx-auto h-10 w-10 text-flame-500" />
          <p className="mt-3 font-display text-lg font-extrabold text-white">Agrega a tus clientes</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-steel-400">Búscalos por nombre o cédula. La recepción también puede asignártelos desde su ficha.</p>
          <button className="btn-primary mt-5" onClick={() => setBuscarTodo(true)}>
            <Search className="h-4 w-4" /> Buscar en el gimnasio
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {lista.map((c) => (
            <Link key={c.id} to={`/coach/clientes/${c.id}`} className="card card-hover flex items-center gap-3 p-3.5">
              <Avatar socioId={c.id} nombre={`${c.nombre} ${c.apellido}`} tieneFoto={c.tieneFoto} size={46} token={sesionCoach.token} ring={c.vigente ? (c.diasRestantes <= 5 ? 'flame' : 'ok') : 'bad'} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-steel-100">
                  {c.nombre} {c.apellido}
                </p>
                <p className="truncate text-xs text-steel-500">
                  {c.vigente ? `${c.diasRestantes} día(s) · ${c.plan}` : 'Sin plan vigente'}
                  {c.rutina && ` · ${c.rutina}`}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.entrenosSemana > 0 && (
                    <span className="chip border-ok/30 bg-ok/10 text-ok">
                      <Flame className="h-3 w-3" /> {c.entrenosSemana} esta semana
                    </span>
                  )}
                  {c.alertas
                    .filter((a) => a.tipo !== 'medir')
                    .slice(0, 2)
                    .map((a) => (
                      <ChipAlerta key={a.tipo} {...a} />
                    ))}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-steel-600" />
            </Link>
          ))}
          {!lista.length && <p className="text-sm text-steel-500">Ningún cliente con ese filtro.</p>}
        </div>
      )}
      {buscarTodo && <BuscarCliente onClose={() => setBuscarTodo(false)} onAgregado={() => void qc.invalidateQueries({ queryKey: ['coach-clientes'] })} />}
    </div>
  );
}

function BuscarCliente({ onClose, onAgregado }: { onClose: () => void; onAgregado: () => void }) {
  const [q, setQ] = useState('');
  const { data, isFetching, error } = useQuery({
    queryKey: ['coach-buscar', q.trim()],
    queryFn: () => apiCoach<Array<{ id: string; codigo: number; nombre: string; apellido: string; tieneFoto: boolean; entrenador: string | null; mio: boolean }>>(`/buscar?q=${encodeURIComponent(q.trim())}`),
    enabled: q.trim().length >= 2,
  });
  const asignar = useMutation({
    mutationFn: (id: string) => apiCoach(`/clientes/${id}/asignar`, { body: {} }),
    onSuccess: () => (toast.success('Agregado a tus clientes'), onAgregado()),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal title="Agregar cliente" onClose={onClose}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
        <input className="input h-12 pl-11" placeholder="Nombre, cédula o número de cliente" autoFocus value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mt-3 space-y-1.5">
        {isFetching && <p className="text-sm text-steel-500">Buscando…</p>}
        {error && <p className="text-sm text-bad">{(error as Error).message}</p>}
        {data?.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5">
            <Avatar socioId={s.id} nombre={`${s.nombre} ${s.apellido}`} tieneFoto={s.tieneFoto} size={38} token={sesionCoach.token} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-steel-100">
                {s.nombre} {s.apellido}
              </p>
              <p className="text-xs text-steel-500">
                #{s.codigo}
                {s.entrenador && !s.mio && ` · con ${s.entrenador}`}
              </p>
            </div>
            {s.mio ? (
              <span className="chip border-ok/30 bg-ok/10 text-ok">Tuyo</span>
            ) : (
              <button className="btn-primary btn-sm" disabled={asignar.isPending} onClick={() => asignar.mutate(s.id)}>
                <Plus className="h-4 w-4" /> Agregar
              </button>
            )}
          </div>
        ))}
        {data && !data.length && <p className="text-sm text-steel-500">Nadie con ese nombre o cédula.</p>}
      </div>
    </Modal>
  );
}

// ═════════════ Ficha del cliente ═════════════
type Pestana = 'progreso' | 'rutina' | 'clases' | 'notas';

export function ClienteDetalle() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Pestana>('progreso');
  const [medir, setMedir] = useState(false);
  const [editar, setEditar] = useState<RutinaBase | 'nueva' | null>(null);
  const [inscribir, setInscribir] = useState(false);
  const [enlace, setEnlace] = useState<string | null>(null);
  const { data: f, isLoading, error } = useQuery({ queryKey: ['coach-ficha', id], queryFn: () => apiCoach<FichaCoach>(`/clientes/${id}`) });
  const { data: plantillas } = useQuery({ queryKey: ['coach-plantillas'], queryFn: () => apiCoach<Plantilla[]>('/plantillas') });
  const refrescar = () => {
    void qc.invalidateQueries({ queryKey: ['coach-ficha', id] });
    void qc.invalidateQueries({ queryKey: ['coach-clientes'] });
    void qc.invalidateQueries({ queryKey: ['coach-inicio'] });
  };
  const asignar = useMutation({
    mutationFn: (si: boolean) => apiCoach(`/clientes/${id}/asignar`, { method: si ? 'POST' : 'DELETE', body: si ? {} : undefined }),
    onSuccess: (_r, si) => {
      toast.success(si ? 'Ahora es tu cliente' : 'Ya no está en tu lista');
      refrescar();
      if (!si) nav('/coach/clientes');
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const portal = useMutation({
    mutationFn: (enviar: boolean) => apiCoach<{ url: string; enviado: boolean; error: string | null }>(`/clientes/${id}/enlace`, { body: { baseUrl: window.location.origin, enviar } }),
    onSuccess: (r, enviar) => {
      setEnlace(r.url);
      if (enviar && r.enviado) toast.success('Enlace enviado por WhatsApp');
      else if (enviar) toast.error(`No se pudo enviar por WhatsApp: ${r.error}. Cópialo y envíaselo tú.`);
      else void navigator.clipboard?.writeText(r.url).then(() => toast.success('Enlace copiado'), () => undefined);
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const borrarMed = useMutation({ mutationFn: (mid: number) => apiCoach(`/clientes/${id}/mediciones/${mid}`, { method: 'DELETE' }), onSuccess: refrescar, onError: (e: Error) => toast.error(e.message) });
  const reactivar = useMutation({ mutationFn: (rid: number) => apiCoach(`/clientes/${id}/rutinas/${rid}`, { method: 'PUT', body: { activa: true } }), onSuccess: refrescar, onError: (e: Error) => toast.error(e.message) });

  if (isLoading) return <Loading />;
  if (error || !f)
    return (
      <div className="card p-8 text-center">
        <p className="text-steel-300">{(error as Error | null)?.message}</p>
        <Link to="/coach/clientes" className="btn-ghost mt-4 inline-flex">
          Volver
        </Link>
      </div>
    );

  const nombre = `${f.nombre} ${f.apellido}`.trim();
  const activa = f.rutinas.find((r) => r.activa) as RutinaCoach | undefined;
  const total = f.vigente && f.hasta ? Math.max(f.diasRestantes, 30) : 30;

  return (
    <div className="animate-rise">
      <Link to="/coach/clientes" className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-steel-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Mis clientes
      </Link>

      {/* Encabezado */}
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-br from-ink-800 to-ink-900 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar socioId={f.id} nombre={nombre} tieneFoto={f.tieneFoto} size={68} token={sesionCoach.token} ring={f.vigente ? 'ok' : 'bad'} />
          <div className="min-w-0 flex-1">
            <h1 className="font-wide text-2xl text-white">{nombre}</h1>
            <p className="text-sm text-steel-400">
              #{f.codigo}
              {f.edad != null && ` · ${f.edad} años`} · cliente desde {fecha(f.desde.slice(0, 10))}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {f.alertas.map((a) => (
                <ChipAlerta key={a.tipo} {...a} />
              ))}
              {f.app.privado && (
                <span className="chip border-ok/30 text-ok">
                  <ShieldCheck className="h-3 w-3" /> Cuenta privada
                </span>
              )}
              {f.app.ultimoAcceso && <span className="chip border-white/10 text-steel-400">Usó la app {hace(f.app.ultimoAcceso)}</span>}
            </div>
          </div>
          <div className="hidden sm:block">{f.vigente && <AnilloDias restantes={f.diasRestantes} total={total} size={96} color={f.diasRestantes <= 5 ? '#F5A524' : '#2ED47A'} />}</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {f.telefono && (
            <a href={whatsappDe(f.telefono)} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
              <MessageCircle className="h-4 w-4 text-ok" /> WhatsApp
            </a>
          )}
          <button className="btn-ghost btn-sm" disabled={portal.isPending} onClick={() => portal.mutate(true)}>
            <Send className="h-4 w-4 text-flame-400" /> Enviar su enlace
          </button>
          <button className="btn-ghost btn-sm" disabled={portal.isPending} onClick={() => portal.mutate(false)}>
            <ClipboardCopy className="h-4 w-4" /> Copiar enlace
          </button>
          {f.mio ? (
            <button className="btn-ghost btn-sm" onClick={() => confirm(`¿Quitar a ${f.nombre} de tus clientes?`) && asignar.mutate(false)}>
              <UserMinus className="h-4 w-4 text-bad" /> Quitar
            </button>
          ) : (
            <button className="btn-primary btn-sm" onClick={() => asignar.mutate(true)}>
              <UserPlus className="h-4 w-4" /> Agregar a mis clientes
            </button>
          )}
        </div>
        {enlace && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-ink-950/60 px-3 py-2">
            <Link2 className="h-4 w-4 shrink-0 text-flame-400" />
            <code className="min-w-0 flex-1 truncate text-xs text-steel-300">{enlace}</code>
            <button className="text-steel-400 hover:text-flame-400" onClick={() => void navigator.clipboard?.writeText(enlace).then(() => toast.success('Copiado'))}>
              <ClipboardCopy className="h-4 w-4" />
            </button>
          </div>
        )}
        <p className="mt-2 text-[11px] text-steel-600">Con su enlace entra a su app sin clave (sirve si la olvidó). Generar uno nuevo desactiva el anterior.</p>
      </section>

      {/* Cifras */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label="Plan" valor={f.vigente ? `${f.diasRestantes} días` : 'Vencido'} hint={f.plan ?? '—'} tono={f.vigente ? 'text-ok' : 'text-bad'} />
        <Mini label="Última entrada" valor={f.ultimaEntrada ? fechaCorta(f.ultimaEntrada) : '—'} hint={f.diasSinVenir != null ? `hace ${f.diasSinVenir} día(s)` : 'nunca'} />
        <Mini label="Racha" valor={`${f.entrenos.racha} sem.`} hint={`${f.entrenos.estaSemana} día(s) esta semana`} tono="text-flame-400" />
        <Mini label="Entradas" valor={String(f.entradas.length)} hint="últimas registradas" />
      </div>

      {/* Pestañas */}
      <div className="mt-5 grid grid-cols-4 gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1">
        {(
          [
            ['progreso', 'Progreso', LineChart],
            ['rutina', 'Rutina', Dumbbell],
            ['clases', 'Clases', CalendarDays],
            ['notas', 'Notas', NotebookPen],
          ] as const
        ).map(([v, l, I]) => (
          <button key={v} onClick={() => setTab(v)} className={cx('flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-bold transition sm:flex-row sm:gap-1.5 sm:py-2.5 sm:text-sm', tab === v ? 'bg-flame-500 text-ink-950' : 'text-steel-400 hover:text-steel-100')}>
            <I className="h-4 w-4" /> {l}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'progreso' && (
          <Seccion
            titulo="Progreso"
            icono={<LineChart className="h-5 w-5 text-flame-500" />}
            accion={
              <button className="btn-primary btn-sm" onClick={() => setMedir(true)}>
                <Ruler className="h-4 w-4" /> Tomar medidas
              </button>
            }
          >
            {f.mediciones.length ? (
              <ProgresoResumen mediciones={f.mediciones} onBorrar={(mid) => borrarMed.mutate(mid)} puedeBorrar={(m) => (m as { autor?: string }).autor === 'entrenador'} />
            ) : (
              <p className="text-sm text-steel-400">Sin medidas todavía. Tómale peso y medidas hoy: las verá en su app con su gráfica de avance.</p>
            )}
          </Seccion>
        )}

        {tab === 'rutina' && (
          <Seccion
            titulo={activa ? activa.titulo : 'Rutina'}
            icono={<Dumbbell className="h-5 w-5 text-flame-500" />}
            accion={
              <button className="btn-primary btn-sm" onClick={() => setEditar(activa && activa.autor !== 'cliente' ? activa : 'nueva')}>
                {activa ? 'Editar' : 'Asignar rutina'}
              </button>
            }
          >
            {activa ? (
              <>
                <p className="mb-3 text-xs text-steel-500">
                  {activa.objetivo && `${activa.objetivo} · `}
                  {activa.autor === 'cliente' ? 'La creó el cliente' : activa.entrenador ? `De ${activa.entrenador}` : 'Del gimnasio'} · {hace(activa.actualizadoEn)}
                </p>
                {f.entrenos.hoy.length > 0 && (
                  <p className="mb-3 flex items-center gap-2 rounded-xl bg-ok/10 px-3 py-2 text-sm text-ok">
                    <Trophy className="h-4 w-4" /> Hoy marcó como hecho: {f.entrenos.hoy.join(', ')}
                  </p>
                )}
                <RutinaVista rutina={activa} hechos={f.entrenos.hoy} />
                {activa.autor === 'cliente' && (
                  <button className="btn-ghost btn-sm mt-3" onClick={() => setEditar('nueva')}>
                    <Plus className="h-4 w-4" /> Asignarle una rutina tuya
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-steel-400">Sin rutina. Asígnale una (o empieza desde una de tus plantillas): la verá en su app y podrá marcar cada día que entrene.</p>
            )}
            {f.entrenos.lista.length > 0 && (
              <div className="mt-4 border-t border-white/[0.05] pt-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-steel-500">Días que marcó</p>
                <div className="flex flex-wrap gap-1.5">
                  {f.entrenos.lista.slice(0, 14).map((e) => (
                    <span key={e.id} className="chip border-white/10 text-steel-300">
                      {fechaCorta(e.fecha)} · {e.dia}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {f.rutinas.filter((r) => !r.activa).length > 0 && (
              <div className="mt-4 border-t border-white/[0.05] pt-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-steel-500">Rutinas anteriores</p>
                {f.rutinas
                  .filter((r) => !r.activa)
                  .map((r) => (
                    <div key={r.id} className="flex items-center gap-3 py-1.5 text-sm">
                      <span className="min-w-0 flex-1 truncate text-steel-300">{r.titulo}</span>
                      <span className="text-xs text-steel-600">{fecha(r.actualizadoEn.slice(0, 10))}</span>
                      <button className="text-xs font-bold text-flame-400" onClick={() => reactivar.mutate(r.id)}>
                        Reactivar
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </Seccion>
        )}

        {tab === 'clases' && (
          <Seccion
            titulo="Sus clases"
            icono={<CalendarDays className="h-5 w-5 text-flame-500" />}
            accion={
              <button className="btn-primary btn-sm" onClick={() => setInscribir(true)}>
                <CalendarPlus className="h-4 w-4" /> Inscribir
              </button>
            }
          >
            {f.clases.length === 0 ? (
              <p className="text-sm text-steel-400">No está inscrito en clases. Inscríbelo en una de la semana.</p>
            ) : (
              <div className="space-y-1.5">
                {f.clases.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5">
                    <span className="h-8 w-1.5 rounded-full" style={{ background: c.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-steel-100">{c.nombre}</p>
                      <p className="text-xs text-steel-500">
                        {fechaCorta(c.inicio)} · {hora(c.inicio)}
                        {c.entrenador && ` · ${c.entrenador}`}
                        {c.reservadoPorSocio && ' · reservó él'}
                      </p>
                    </div>
                    {c.asistioEn ? <span className="chip border-ok/30 bg-ok/10 text-ok">Asistió</span> : new Date(c.inicio) < new Date() ? <span className="chip border-white/10 text-steel-500">No vino</span> : null}
                  </div>
                ))}
              </div>
            )}
          </Seccion>
        )}

        {tab === 'notas' && <Notas socioId={f.id} notas={f.notas} onCambio={refrescar} />}
      </div>

      {medir && (
        <MedicionModal
          titulo={`Medidas de ${f.nombre}`}
          anterior={f.mediciones[0]}
          onClose={() => setMedir(false)}
          guardar={async (b) => {
            await apiCoach(`/clientes/${id}/mediciones`, { body: b });
            toast.success('Medidas guardadas: ya las ve en su app');
            refrescar();
          }}
        />
      )}
      {editar && (
        <RutinaEditor
          titulo={editar === 'nueva' ? `Rutina para ${f.nombre}` : 'Editar rutina'}
          inicial={editar === 'nueva' ? null : editar}
          plantillas={editar === 'nueva' ? plantillas : undefined}
          onClose={() => setEditar(null)}
          guardar={async (b) => {
            if (editar !== 'nueva' && editar.id) await apiCoach(`/clientes/${id}/rutinas/${editar.id}`, { method: 'PUT', body: b });
            else await apiCoach(`/clientes/${id}/rutinas`, { body: b });
            toast.success('Rutina asignada: ya la ve en su app');
            refrescar();
          }}
          guardarPlantilla={async (b) => {
            await apiCoach('/plantillas', { body: b });
            toast.success('Guardada en tus plantillas');
            void qc.invalidateQueries({ queryKey: ['coach-plantillas'] });
          }}
        />
      )}
      {inscribir && <InscribirEnClase socioId={f.id} nombre={f.nombre} onClose={() => setInscribir(false)} onHecho={refrescar} />}
    </div>
  );
}

function Mini({ label, valor, hint, tono = 'text-white' }: { label: string; valor: string; hint: string; tono?: string }) {
  return (
    <div className="card p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-steel-500">{label}</p>
      <p className={cx('tnum mt-0.5 font-display text-lg font-extrabold', tono)}>{valor}</p>
      <p className="truncate text-[11px] text-steel-500">{hint}</p>
    </div>
  );
}

function Notas({ socioId, notas, onCambio }: { socioId: string; notas: FichaCoach['notas']; onCambio: () => void }) {
  const [texto, setTexto] = useState('');
  const crear = useMutation({
    mutationFn: () => apiCoach(`/clientes/${socioId}/notas`, { body: { texto } }),
    onSuccess: () => (setTexto(''), onCambio()),
    onError: (e: Error) => toast.error(e.message),
  });
  const borrar = useMutation({ mutationFn: (nid: number) => apiCoach(`/clientes/${socioId}/notas/${nid}`, { method: 'DELETE' }), onSuccess: onCambio });
  return (
    <Seccion titulo="Notas privadas" icono={<NotebookPen className="h-5 w-5 text-flame-500" />}>
      <p className="mb-3 text-xs text-steel-500">Solo las ves tú: lesiones, objetivos, cómo va. El cliente no las ve.</p>
      <div className="flex gap-2">
        <textarea className="input min-h-[52px] flex-1" rows={2} maxLength={500} placeholder="Ej. molestia en la rodilla izquierda, evitar saltos" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <button className="btn-primary self-end" disabled={texto.trim().length < 2 || crear.isPending} onClick={() => crear.mutate()}>
          <Send className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 space-y-2">
        {notas.map((n) => (
          <div key={n.id} className="group flex gap-3 rounded-xl bg-white/[0.03] p-3">
            <p className="flex-1 whitespace-pre-wrap text-sm text-steel-200">{n.texto}</p>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[11px] text-steel-600">{hace(n.creadoEn)}</span>
              <button className="text-steel-600 opacity-0 transition hover:text-bad group-hover:opacity-100" onClick={() => borrar.mutate(n.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {!notas.length && <p className="text-sm text-steel-500">Sin notas.</p>}
      </div>
    </Seccion>
  );
}

function InscribirEnClase({ socioId, nombre, onClose, onHecho }: { socioId: string; nombre: string; onClose: () => void; onHecho: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['coach-clases', hoyISO(), '0'], queryFn: () => apiCoach<ClaseCoach[]>(`/clases?desde=${hoyISO()}`) });
  const inscribir = useMutation({
    mutationFn: (claseId: number) => apiCoach(`/clases/${claseId}/inscribir`, { body: { socioIds: [socioId] } }),
    onSuccess: () => {
      toast.success(`${nombre} quedó inscrito`);
      onHecho();
      void qc.invalidateQueries({ queryKey: ['coach-clases'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const futuras = (data ?? []).filter((c) => new Date(c.inicio).getTime() > Date.now() - 30 * 60_000);
  return (
    <Modal title={`Inscribir a ${nombre}`} onClose={onClose}>
      {isLoading ? (
        <Loading />
      ) : !futuras.length ? (
        <p className="text-sm text-steel-400">No hay clases esta semana. Programa una desde Clases.</p>
      ) : (
        <div className="space-y-1.5">
          {futuras.map((c) => {
            const lleno = !!c.cupo && c.inscritos >= c.cupo;
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5">
                <span className="h-9 w-1.5 rounded-full" style={{ background: c.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-steel-100">
                    {c.nombre} {c.mia && <span className="text-xs text-flame-400">· tuya</span>}
                  </p>
                  <p className="text-xs text-steel-500">
                    {diaCorto(c.dia)} {c.hora} · {c.entrenador ?? 'sin entrenador'} · {c.inscritos}
                    {c.cupo ? `/${c.cupo}` : ''}
                  </p>
                </div>
                <button className="btn-primary btn-sm" disabled={lleno || inscribir.isPending} onClick={() => inscribir.mutate(c.id)}>
                  {lleno ? 'Lleno' : 'Inscribir'}
                </button>
              </div>
            );
          })}
        </div>
      )}
      <button className="mt-4 flex items-center gap-1 text-xs text-steel-500" onClick={onClose}>
        <X className="h-3.5 w-3.5" /> Cerrar
      </button>
    </Modal>
  );
}
