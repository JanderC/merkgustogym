/**
 * Clases del entrenador (semana, pasar lista, inscribir a sus clientes, programar clases)
 * y sus plantillas de rutina.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Check, ChevronLeft, ChevronRight, LayoutTemplate, Pencil, Plus, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { RutinaEditor, RutinaVista, Titulo, type RutinaBase } from '../../components/app/AppUI';
import { Avatar, cx, Drawer, Field, Loading, Modal } from '../../components/ui';
import { apiCoach, sesionCoach } from '../../lib/api';
import { fecha, hoyISO, sumarDias } from '../../lib/format';
import { diaCorto, type ClaseCoach, type ClienteCoach, type Plantilla } from './tipos';

export function ClasesCoach() {
  const [desde, setDesde] = useState(hoyISO());
  const [soloMias, setSoloMias] = useState(true);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [nueva, setNueva] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['coach-clases', desde, soloMias ? '1' : '0'], queryFn: () => apiCoach<ClaseCoach[]>(`/clases?desde=${desde}&soloMias=${soloMias ? 1 : 0}`) });
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(desde, i));

  return (
    <div className="animate-rise">
      <Titulo
        kicker="Tu semana"
        accion={
          <button className="btn-primary" onClick={() => setNueva(true)}>
            <CalendarPlus className="h-4 w-4" /> <span className="hidden sm:inline">Programar clase</span>
          </button>
        }
      >
        Clases
      </Titulo>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-xl border border-white/[0.08]">
          <button className="p-2.5 text-steel-400 hover:text-white" onClick={() => setDesde(sumarDias(desde, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-sm font-bold text-steel-200">
            {fecha(desde)} – {fecha(sumarDias(desde, 6))}
          </span>
          <button className="p-2.5 text-steel-400 hover:text-white" onClick={() => setDesde(sumarDias(desde, 7))}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex rounded-xl bg-white/[0.04] p-1">
          {[
            [true, 'Mis clases'],
            [false, 'Todas'],
          ].map(([v, l]) => (
            <button key={String(v)} onClick={() => setSoloMias(v as boolean)} className={cx('rounded-lg px-3 py-1.5 text-sm font-bold', soloMias === v ? 'bg-flame-500 text-ink-950' : 'text-steel-400')}>
              {l as string}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <div className="space-y-5">
          {dias.map((d) => {
            const delDia = (data ?? []).filter((c) => c.dia === d);
            if (!delDia.length) return null;
            return (
              <div key={d}>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-steel-500">{d === hoyISO() ? 'Hoy' : diaCorto(d)}</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {delDia.map((c) => (
                    <button key={c.id} onClick={() => setAbierta(c.id)} className={cx('card card-hover relative overflow-hidden p-4 text-left', c.mia && 'border-flame-500/30')}>
                      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: c.color }} />
                      <div className="flex items-center gap-3 pl-2">
                        <span className="font-wide text-lg text-white">{c.hora}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-steel-100">{c.nombre}</p>
                          <p className="text-xs text-steel-500">
                            {c.mia ? 'Tu clase' : c.entrenador ?? 'Sin entrenador'} · {c.duracionMin} min
                          </p>
                        </div>
                        <span className="flex items-center gap-1 text-sm font-bold text-steel-300">
                          <Users className="h-4 w-4 text-steel-500" /> {c.inscritos}
                          {c.cupo ? `/${c.cupo}` : ''}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {!data?.length && <div className="card p-8 text-center text-steel-400">{soloMias ? 'No tienes clases esta semana. Programa una o mira todas las del gimnasio.' : 'No hay clases esta semana.'}</div>}
        </div>
      )}
      {abierta && <ClaseDrawer id={abierta} onClose={() => setAbierta(null)} />}
      {nueva && <NuevaClase onClose={() => setNueva(false)} />}
    </div>
  );
}

type Inscrito = { socioId: string; nombre: string; apellido: string; codigo: number; tieneFoto: boolean; asistioEn: string | null; reservadoPorSocio: boolean; mio: boolean; puedoQuitar: boolean; acceso: string; diasRestantes: number };
type DetalleClase = Omit<ClaseCoach, 'inscritos'> & { mia: boolean; esHoy: boolean; inscritos: Inscrito[] };

export function ClaseDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [agregar, setAgregar] = useState(false);
  const { data: c } = useQuery({ queryKey: ['coach-clase', id], queryFn: () => apiCoach<DetalleClase>(`/clases/${id}`) });
  const refrescar = () => ['coach-clase', 'coach-clases', 'coach-inicio', 'coach-ficha'].forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
  const pasar = useMutation({
    mutationFn: (socioId: string) => apiCoach(`/clases/${id}/pasar/${socioId}`, { body: {} }),
    onSuccess: () => (toast.success('Asistencia registrada'), refrescar()),
    onError: (e: Error) => toast.error(e.message),
  });
  const quitar = useMutation({ mutationFn: (socioId: string) => apiCoach(`/clases/${id}/inscritos/${socioId}`, { method: 'DELETE' }), onSuccess: refrescar, onError: (e: Error) => toast.error(e.message) });
  if (!c) return null;
  const llegaron = c.inscritos.filter((i) => i.asistioEn).length;
  return (
    <Drawer
      title={c.nombre}
      subtitle={`${diaCorto(c.dia)} · ${c.hora} · ${c.duracionMin} min${c.mia ? ' · tu clase' : c.entrenador ? ` · ${c.entrenador}` : ''}`}
      onClose={onClose}
      footer={
        <button className="btn-primary" onClick={() => setAgregar(true)}>
          <UserPlus className="h-4 w-4" /> Inscribir a mis clientes
        </button>
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="card p-3 text-center">
          <p className="font-wide text-2xl text-white">{c.inscritos.length}</p>
          <p className="text-[11px] text-steel-500">{c.mia ? 'inscritos' : 'tuyos inscritos'}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="font-wide text-2xl text-ok">{llegaron}</p>
          <p className="text-[11px] text-steel-500">llegaron</p>
        </div>
        <div className="card p-3 text-center">
          <p className="font-wide text-2xl text-steel-200">{c.cupo ?? '∞'}</p>
          <p className="text-[11px] text-steel-500">cupo</p>
        </div>
      </div>
      {c.mia && c.esHoy && <p className="mb-3 rounded-xl bg-flame-500/10 px-3 py-2 text-sm text-flame-300">Es hoy: toca ✓ cuando llegue cada uno. Quien no tenga mensualidad debe pasar por recepción.</p>}
      <div className="space-y-1.5">
        {c.inscritos.map((i) => {
          const nombre = `${i.nombre} ${i.apellido}`;
          return (
            <div key={i.socioId} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5">
              <Avatar socioId={i.socioId} nombre={nombre} tieneFoto={i.tieneFoto} size={38} token={sesionCoach.token} ring={i.acceso === 'sin_mensualidad' ? 'bad' : 'ok'} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-steel-100">{nombre}</p>
                <p className="text-xs text-steel-500">
                  {i.acceso === 'sin_mensualidad' ? <span className="text-bad">Sin mensualidad</span> : `${i.diasRestantes} día(s) de plan`}
                  {i.reservadoPorSocio && ' · reservó desde su app'}
                  {i.mio && ' · tu cliente'}
                </p>
              </div>
              {i.asistioEn ? (
                <span className="chip border-ok/30 bg-ok/10 text-ok">
                  <Check className="h-3 w-3" /> Llegó
                </span>
              ) : (
                <>
                  {c.mia && c.esHoy && (
                    <button className="btn-ok btn-sm" disabled={pasar.isPending} onClick={() => pasar.mutate(i.socioId)} title="Marcar asistencia">
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  {i.puedoQuitar && (
                    <button className="p-1 text-steel-600 hover:text-bad" onClick={() => confirm(`¿Quitar a ${i.nombre} de la clase?`) && quitar.mutate(i.socioId)} title="Quitar">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
        {!c.inscritos.length && <p className="text-sm text-steel-500">Nadie inscrito todavía.</p>}
      </div>
      {agregar && <AgregarAClase claseId={id} yaEstan={c.inscritos.map((i) => i.socioId)} onClose={() => setAgregar(false)} onHecho={refrescar} />}
    </Drawer>
  );
}

function AgregarAClase({ claseId, yaEstan, onClose, onHecho }: { claseId: number; yaEstan: string[]; onClose: () => void; onHecho: () => void }) {
  const { data } = useQuery({ queryKey: ['coach-clientes'], queryFn: () => apiCoach<ClienteCoach[]>('/clientes') });
  const [sel, setSel] = useState<string[]>([]);
  const m = useMutation({
    mutationFn: () => apiCoach<{ agregados: number }>(`/clases/${claseId}/inscribir`, { body: { socioIds: sel } }),
    onSuccess: (r) => (toast.success(`${r.agregados} inscrito(s)`), onHecho(), onClose()),
    onError: (e: Error) => toast.error(e.message),
  });
  const disponibles = (data ?? []).filter((c) => !yaEstan.includes(c.id));
  return (
    <Modal
      title="Inscribir a mis clientes"
      onClose={onClose}
      footer={
        <button className="btn-primary" disabled={!sel.length || m.isPending} onClick={() => m.mutate()}>
          Inscribir {sel.length || ''}
        </button>
      }
    >
      <div className="space-y-1.5">
        {disponibles.map((c) => {
          const on = sel.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => setSel(on ? sel.filter((x) => x !== c.id) : [...sel, c.id])}
              className={cx('flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition', on ? 'border-flame-500/50 bg-flame-500/[0.07]' : 'border-transparent bg-white/[0.03]')}
            >
              <span className={cx('grid h-6 w-6 place-items-center rounded-md border', on ? 'border-flame-500 bg-flame-500 text-ink-950' : 'border-white/20')}>{on && <Check className="h-4 w-4" />}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-steel-100">
                  {c.nombre} {c.apellido}
                </span>
                <span className="text-xs text-steel-500">{c.vigente ? `${c.diasRestantes} día(s) de plan` : 'Sin plan vigente'}</span>
              </span>
            </button>
          );
        })}
        {!disponibles.length && <p className="text-sm text-steel-500">Todos tus clientes ya están en esta clase (o aún no tienes clientes).</p>}
      </div>
    </Modal>
  );
}

const COLORES = ['#FF8A10', '#2ED47A', '#38BDF8', '#A78BFA', '#F472B6', '#F5A524'];

function NuevaClase({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: op } = useQuery({ queryKey: ['coach-opciones'], queryFn: () => apiCoach<{ planes: Array<{ id: number; nombre: string; duracion: string }> }>('/clases/opciones') });
  const [f, setF] = useState({ nombre: '', fecha: hoyISO(), hora: '18:00', duracionMin: 60, cupo: 15, nivel: 'todos', planId: '', repetirSemanas: 0, color: COLORES[0], descripcion: '' });
  const m = useMutation({
    mutationFn: () =>
      apiCoach<{ creadas: number }>('/clases', {
        body: { ...f, planId: f.planId ? Number(f.planId) : null, cupo: f.cupo || null, descripcion: f.descripcion || null },
      }),
    onSuccess: (r) => {
      toast.success(r.creadas > 1 ? `${r.creadas} clases programadas` : 'Clase programada');
      void qc.invalidateQueries({ queryKey: ['coach-clases'] });
      void qc.invalidateQueries({ queryKey: ['coach-inicio'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal
      title="Programar clase"
      onClose={onClose}
      footer={
        <button className="btn-primary" disabled={f.nombre.trim().length < 2 || m.isPending} onClick={() => m.mutate()}>
          <CalendarPlus className="h-4 w-4" /> Programar
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre" className="col-span-2">
          <input className="input" value={f.nombre} maxLength={80} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Ej. Funcional avanzado" autoFocus />
        </Field>
        <Field label="Día">
          <input type="date" className="input" min={hoyISO()} value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
        </Field>
        <Field label="Hora">
          <input type="time" className="input" value={f.hora} onChange={(e) => setF({ ...f, hora: e.target.value })} />
        </Field>
        <Field label="Duración (min)">
          <input className="input tnum" inputMode="numeric" value={f.duracionMin} onChange={(e) => setF({ ...f, duracionMin: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
        </Field>
        <Field label="Cupo (0 = libre)">
          <input className="input tnum" inputMode="numeric" value={f.cupo} onChange={(e) => setF({ ...f, cupo: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
        </Field>
        <Field label="Nivel">
          <select className="input" value={f.nivel} onChange={(e) => setF({ ...f, nivel: e.target.value })}>
            <option value="todos">Todos</option>
            <option value="principiante">Principiante</option>
            <option value="intermedio">Intermedio</option>
            <option value="avanzado">Avanzado</option>
          </select>
        </Field>
        <Field label="Repetir">
          <select className="input" value={f.repetirSemanas} onChange={(e) => setF({ ...f, repetirSemanas: Number(e.target.value) })}>
            <option value={0}>Solo esta vez</option>
            {[3, 7, 11].map((n) => (
              <option key={n} value={n}>
                {n + 1} semanas
              </option>
            ))}
          </select>
        </Field>
        <Field label="Plan de la clase (opcional)" className="col-span-2">
          <select className="input" value={f.planId} onChange={(e) => setF({ ...f, planId: e.target.value })}>
            <option value="">Cualquier mensualidad</option>
            {(op?.planes ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} · {p.duracion}
              </option>
            ))}
          </select>
        </Field>
        <div className="col-span-2">
          <span className="label">Color</span>
          <div className="flex gap-2">
            {COLORES.map((c) => (
              <button key={c} onClick={() => setF({ ...f, color: c })} className={cx('h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-ink-900', f.color === c ? 'ring-white' : 'ring-transparent')} style={{ background: c }} />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ═════════════ Plantillas ═════════════
export function Plantillas() {
  const qc = useQueryClient();
  const [editar, setEditar] = useState<Plantilla | 'nueva' | null>(null);
  const [ver, setVer] = useState<number | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['coach-plantillas'], queryFn: () => apiCoach<Plantilla[]>('/plantillas') });
  const refrescar = () => void qc.invalidateQueries({ queryKey: ['coach-plantillas'] });
  const borrar = useMutation({ mutationFn: (pid: number) => apiCoach(`/plantillas/${pid}`, { method: 'DELETE' }), onSuccess: () => (toast.success('Plantilla borrada'), refrescar()) });
  return (
    <div className="animate-rise">
      <Titulo
        kicker="Tus plantillas"
        accion={
          <button className="btn-primary" onClick={() => setEditar('nueva')}>
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nueva plantilla</span>
          </button>
        }
      >
        Rutinas
      </Titulo>
      <p className="-mt-2 mb-4 text-sm text-steel-400">Arma tus rutinas una vez y asígnalas a cualquier cliente en un toque (desde su ficha → Rutina).</p>
      {isLoading ? (
        <Loading />
      ) : !data?.length ? (
        <div className="card p-8 text-center">
          <LayoutTemplate className="mx-auto h-10 w-10 text-flame-500" />
          <p className="mt-3 font-display text-lg font-extrabold text-white">Crea tu primera plantilla</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-steel-400">Por ejemplo: Full body principiante, Hipertrofia 4 días, Glúteo y pierna…</p>
          <button className="btn-primary mt-5" onClick={() => setEditar('nueva')}>
            <Plus className="h-4 w-4" /> Nueva plantilla
          </button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((p) => (
            <div key={p.id} className="card p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-extrabold text-white">{p.titulo}</p>
                  <p className="text-xs text-steel-500">
                    {p.objetivo && `${p.objetivo} · `}
                    {p.dias.length} día(s) · {p.dias.reduce((n, d) => n + d.ejercicios.length, 0)} ejercicios
                  </p>
                </div>
                <button className="p-1.5 text-steel-500 hover:text-white" onClick={() => setEditar(p)} title="Editar">
                  <Pencil className="h-4 w-4" />
                </button>
                <button className="p-1.5 text-steel-500 hover:text-bad" onClick={() => confirm(`¿Borrar la plantilla "${p.titulo}"?`) && borrar.mutate(p.id)} title="Borrar">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <button className="mt-2 text-xs font-bold text-flame-400" onClick={() => setVer(ver === p.id ? null : p.id)}>
                {ver === p.id ? 'Ocultar' : 'Ver ejercicios'}
              </button>
              {ver === p.id && (
                <div className="mt-3">
                  <RutinaVista rutina={p} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {editar && (
        <RutinaEditor
          titulo={editar === 'nueva' ? 'Nueva plantilla' : 'Editar plantilla'}
          inicial={editar === 'nueva' ? null : (editar as RutinaBase)}
          onClose={() => setEditar(null)}
          guardar={async (b) => {
            if (editar !== 'nueva') await apiCoach(`/plantillas/${editar.id}`, { method: 'PUT', body: b });
            else await apiCoach('/plantillas', { body: b });
            toast.success('Plantilla guardada');
            refrescar();
          }}
        />
      )}
    </div>
  );
}
