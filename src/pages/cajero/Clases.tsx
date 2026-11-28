/**
 * Clases grupales (CrossFit, Funcional, Funcional avanzada…) ancladas a planes.
 * La cajera crea la clase, elige al entrenador, inscribe a la gente y le da
 * entrada, tenga o no mensualidad.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  DoorOpen,
  Dumbbell,
  Footprints,
  Gift,
  MessageCircle,
  HeartPulse,
  Infinity as InfinityIcon,
  Pencil,
  PersonStanding,
  Plus,
  RotateCcw,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { SocioForm, SocioPicker } from '../../components/socios';
import { Paginacion, Th, useTabla } from '../../components/Tabla';
import { Avatar, cx, Drawer, Empty, Field, Loading, Modal, NumInput, PageHeader, Tabs } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fecha, hora, hoyISO, sumarDias } from '../../lib/format';
import { fmt, INFO, leerMonto, MONEDAS, type Moneda } from '../../lib/monedas';

// ── Tipos ────────────────────────────────────────────────────────────
type Car = 'movilidad' | 'fuerza' | 'cardio' | 'resistencia' | 'potencia' | 'desplazamiento';
type Nivel = 'principiante' | 'intermedio' | 'avanzado' | 'todos';
interface Clase {
  id: number;
  nombre: string;
  descripcion: string | null;
  planId: number | null;
  plan: string | null;
  planColor: string | null;
  entrenadorId: string | null;
  entrenador: string | null;
  entrenadorEspecialidad: string | null;
  inicio: string;
  duracionMin: number;
  cupo: number | null;
  nivel: Nivel | null;
  caracteristicas: Partial<Record<Car, number>>;
  color: string;
  estado: 'programada' | 'cancelada';
  motivoCancelacion: string | null;
  dia: string;
  hora: string;
  inscritos: number;
  asistieron: number;
  /** Precio para quien no tiene mensualidad (bailoterapia…) */
  precio: string | number | null;
  moneda: Moneda;
  pagaron: number;
}
interface Inscrito {
  socioId: string;
  codigo: number;
  nombre: string;
  apellido: string;
  cedula: string | null;
  telefono: string | null;
  tieneFoto: boolean;
  cobertura: 'plan' | 'mensualidad' | 'pase' | 'cortesia' | null;
  asistioEn: string | null;
  pasoPor: string | null;
  acceso: 'plan' | 'mensualidad' | 'sin_mensualidad';
  plan: string | null;
  diasRestantes: number;
  hasta: string | null;
  congelada: boolean;
  /** Pagó la clase en caja */
  ventaId: string | null;
  ticket: number | null;
}
interface Sugerido {
  socioId: string;
  codigo: number;
  nombre: string;
  apellido: string;
  cedula: string | null;
  tieneFoto: boolean;
  hasta: string;
}
type ClaseDetalle = Omit<Clase, 'inscritos'> & { esHoy: boolean; inscritos: Inscrito[]; sugeridos: Sugerido[] };
interface Opciones {
  entrenadores: Array<{ id: string; nombre: string; apellido: string; especialidad: string | null }>;
  planes: Array<{ id: number; nombre: string; color: string; activo: boolean; duracion: string }>;
}

// ── Características ──────────────────────────────────────────────────
export const CARACTERISTICAS: Array<{ key: Car; label: string; icon: LucideIcon; color: string }> = [
  { key: 'movilidad', label: 'Movilidad', icon: PersonStanding, color: '#7DD3FC' },
  { key: 'fuerza', label: 'Fuerza', icon: Dumbbell, color: '#FF8A10' },
  { key: 'cardio', label: 'Cardio', icon: HeartPulse, color: '#F472B6' },
  { key: 'resistencia', label: 'Resistencia', icon: InfinityIcon, color: '#A3E635' },
  { key: 'potencia', label: 'Potencia', icon: Zap, color: '#FACC15' },
  { key: 'desplazamiento', label: 'Desplazamiento', icon: Footprints, color: '#A78BFA' },
];
const NIVELES: Array<{ value: Nivel; label: string }> = [
  { value: 'todos', label: 'Todos los niveles' },
  { value: 'principiante', label: 'Principiante' },
  { value: 'intermedio', label: 'Intermedio' },
  { value: 'avanzado', label: 'Avanzado' },
];
const nivelTexto = (n: Nivel | null) => NIVELES.find((x) => x.value === n)?.label ?? null;

/** Plantillas rápidas: nombre + características sugeridas. */
const PLANTILLAS: Array<{ nombre: string; nivel?: Nivel; car: Partial<Record<Car, number>> }> = [
  { nombre: 'CrossFit', car: { fuerza: 4, potencia: 4, cardio: 3, resistencia: 3, movilidad: 2 } },
  { nombre: 'Musculación', car: { fuerza: 5, potencia: 3, resistencia: 2 } },
  { nombre: 'Bailoterapia', car: { cardio: 4, desplazamiento: 4, resistencia: 3, movilidad: 3 } },
  { nombre: 'Clase Step', car: { cardio: 4, resistencia: 4, desplazamiento: 3, potencia: 2 } },
  { nombre: 'Funcional', car: { resistencia: 3, cardio: 3, fuerza: 3, desplazamiento: 3, movilidad: 2 } },
  { nombre: 'Funcional avanzada', nivel: 'avanzado', car: { fuerza: 4, potencia: 5, resistencia: 4, desplazamiento: 4, cardio: 4, movilidad: 2 } },
  { nombre: 'Movilidad', car: { movilidad: 5, resistencia: 1 } },
  { nombre: 'HIIT', car: { cardio: 5, resistencia: 4, potencia: 3, desplazamiento: 3 } },
];
const COLORES = ['#FF8A10', '#7DD3FC', '#A3E635', '#F472B6', '#FACC15', '#A78BFA', '#34D399', '#BABFC8'];
const HORAS = ['06:00', '07:00', '08:00', '09:00', '10:00', '17:00', '18:00', '19:00', '20:00'];

const nombreDe = (x: { nombre: string; apellido: string }) => `${x.nombre} ${x.apellido}`.trim();
const lunesDe = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(y!, m! - 1, d!).getDay(); // 0 domingo
  return sumarDias(iso, dow === 0 ? -6 : 1 - dow);
};
const diaLargo = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'short' });
};
const horaFin = (h: string, min: number) => {
  const [a, b] = h.split(':').map(Number);
  const t = a! * 60 + b! + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
const hora12 = (h: string) => {
  const [a, b] = h.split(':').map(Number);
  return `${((a! + 11) % 12) + 1}:${String(b).padStart(2, '0')} ${a! < 12 ? 'am' : 'pm'}`;
};

/** Barras de características (0–5). */
export function BarrasCaracteristicas({ car, compacto }: { car: Partial<Record<Car, number>>; compacto?: boolean }) {
  const activas = CARACTERISTICAS.filter((c) => (car[c.key] ?? 0) > 0);
  if (!activas.length) return null;
  if (compacto)
    return (
      <div className="flex flex-wrap gap-1">
        {activas.map((c) => (
          <span key={c.key} title={`${c.label}: ${car[c.key]}/5`} className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-steel-300">
            <c.icon className="h-3 w-3" style={{ color: c.color }} />
            {car[c.key]}
          </span>
        ))}
      </div>
    );
  return (
    <div className="space-y-2">
      {activas.map((c) => (
        <div key={c.key} className="flex items-center gap-3">
          <span className="flex w-36 items-center gap-2 text-sm text-steel-200">
            <c.icon className="h-4 w-4" style={{ color: c.color }} /> {c.label}
          </span>
          <div className="flex flex-1 gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className="h-2.5 flex-1 rounded-full" style={{ background: n <= (car[c.key] ?? 0) ? c.color : 'rgba(255,255,255,0.06)' }} />
            ))}
          </div>
          <span className="tnum w-8 text-right text-xs text-steel-500">{car[c.key]}/5</span>
        </div>
      ))}
    </div>
  );
}

// ── Crear / editar ───────────────────────────────────────────────────
function ClaseEditor({ clase, fechaInicial, onClose, onGuardada }: { clase?: Clase | ClaseDetalle | null; fechaInicial?: string; onClose: () => void; onGuardada?: (id: number) => void }) {
  const qc = useQueryClient();
  const { data: op } = useQuery({ queryKey: ['clases-opciones'], queryFn: () => api<Opciones>('/clases/opciones') });
  const [f, setF] = useState({
    nombre: clase?.nombre ?? '',
    descripcion: clase?.descripcion ?? '',
    planId: clase?.planId ?? (null as number | null),
    entrenadorId: clase?.entrenadorId ?? (null as string | null),
    fecha: clase?.dia ?? fechaInicial ?? hoyISO(),
    hora: clase?.hora ?? '18:00',
    duracionMin: clase?.duracionMin ?? 60,
    cupo: clase?.cupo ?? 0,
    nivel: (clase?.nivel ?? 'todos') as Nivel,
    caracteristicas: { ...(clase?.caracteristicas ?? {}) } as Partial<Record<Car, number>>,
    color: clase?.color ?? '#FF8A10',
    repetirSemanas: 0,
    precio: Number(clase?.precio ?? 0) > 0 ? String(Number(clase!.precio)).replace('.', ',') : '',
    moneda: (clase?.moneda ?? 'COP') as Moneda,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const m = useMutation({
    mutationFn: () => {
      const body = { ...f, descripcion: f.descripcion || null, cupo: f.cupo || null, precio: f.precio.trim() ? leerMonto(f.precio) : null };
      if (clase) {
        const { repetirSemanas: _r, ...resto } = body;
        return api<Clase & { creadas?: number }>(`/clases/${clase.id}`, { method: 'PUT', body: resto });
      }
      return api<Clase & { creadas: number }>('/clases', { body });
    },
    onSuccess: (c) => {
      toast.success(clase ? 'Clase actualizada' : c.creadas && c.creadas > 1 ? `${c.creadas} clases creadas (una por semana)` : 'Clase creada', { description: `${c.nombre} · ${diaLargo(c.dia)} ${hora12(c.hora)}` });
      void qc.invalidateQueries({ queryKey: ['clases'] });
      void qc.invalidateQueries({ queryKey: ['clase'] });
      onGuardada?.(c.id);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const planes = (op?.planes ?? []).filter((p) => p.activo || p.id === f.planId);
  const ok = f.nombre.trim().length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(f.fecha) && /^\d{2}:\d{2}$/.test(f.hora);

  return (
    <Modal
      title={clase ? `Editar ${clase.nombre}` : 'Nueva clase'}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={!ok || m.isPending} onClick={() => m.mutate()}>
            <Check className="h-4 w-4" /> {m.isPending ? 'Guardando…' : clase ? 'Guardar cambios' : f.repetirSemanas ? `Crear ${f.repetirSemanas + 1} clases` : 'Crear clase'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Nombre */}
        <div>
          <Field label="Clase *">
            <input className="input text-lg" autoFocus={!clase} value={f.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Funcional avanzada, CrossFit, Movilidad…" />
          </Field>
          {!clase && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PLANTILLAS.map((p) => (
                <button
                  key={p.nombre}
                  type="button"
                  className={cx('chip transition', f.nombre === p.nombre ? 'border-flame-500/60 text-flame-300' : 'border-white/10 text-steel-400 hover:text-white')}
                  onClick={() => setF((x) => ({ ...x, nombre: p.nombre, nivel: p.nivel ?? x.nivel, caracteristicas: { ...p.car } }))}
                >
                  {p.nombre}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cuándo */}
        <div className="rounded-2xl border border-white/[0.06] p-4">
          <span className="label">Cuándo</span>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Día">
              <input type="date" className="input" value={f.fecha} onChange={(e) => set('fecha', e.target.value)} />
              <p className="mt-1 text-xs capitalize text-steel-500">{/^\d{4}-\d{2}-\d{2}$/.test(f.fecha) ? diaLargo(f.fecha) : ''}</p>
            </Field>
            <Field label="Hora">
              <input type="time" className="input" value={f.hora} onChange={(e) => set('hora', e.target.value)} />
            </Field>
            <Field label="Duración">
              <select className="input" value={f.duracionMin} onChange={(e) => set('duracionMin', Number(e.target.value))}>
                {[30, 45, 60, 75, 90, 120].map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {HORAS.map((h) => (
              <button key={h} type="button" className={cx('chip', f.hora === h ? 'border-flame-500/60 text-flame-300' : 'border-white/10 text-steel-400 hover:text-white')} onClick={() => set('hora', h)}>
                {hora12(h)}
              </button>
            ))}
          </div>
          {!clase && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-steel-300">
              <span>Repetir la misma clase</span>
              <NumInput className="w-20" value={f.repetirSemanas} min={0} max={26} onChange={(n) => set('repetirSemanas', n)} />
              <span className="text-steel-500">semana(s) más {f.repetirSemanas > 0 && `(hasta el ${fecha(sumarDias(f.fecha, f.repetirSemanas * 7))})`}</span>
            </div>
          )}
        </div>

        {/* Quién y para quién */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Entrenador que la da">
            <select className="input" value={f.entrenadorId ?? ''} onChange={(e) => set('entrenadorId', e.target.value || null)}>
              <option value="">Sin asignar</option>
              {op?.entrenadores.map((e) => (
                <option key={e.id} value={e.id}>
                  {nombreDe(e)}
                  {e.especialidad ? ` · ${e.especialidad}` : ''}
                </option>
              ))}
            </select>
            {op && !op.entrenadores.length && <p className="mt-1 text-xs text-warn">No hay entrenadores registrados todavía.</p>}
          </Field>
          <Field label="Plan al que pertenece" hint="Quien tenga ese plan vigente entra incluido; los demás pagan su pase o pasan como cortesía">
            <select
              className="input"
              value={f.planId ?? ''}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                const p = planes.find((x) => x.id === id);
                setF((x) => ({ ...x, planId: id, color: p?.color ?? x.color }));
              }}
            >
              <option value="">Abierta (cualquier mensualidad)</option>
              {planes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} · {p.duracion}
                </option>
              ))}
            </select>
          </Field>
          <div className="rounded-2xl border border-flame-500/20 bg-flame-500/[0.04] p-3 sm:col-span-2">
            <span className="label">Precio de la clase (para quien no tiene mensualidad)</span>
            <div className="flex flex-wrap items-center gap-2">
              <input className="input tnum w-40 text-lg" inputMode="decimal" value={f.precio} onChange={(e) => set('precio', e.target.value)} placeholder="Sin precio" />
              <Tabs value={f.moneda} onChange={(m) => set('moneda', m)} items={MONEDAS.map((m) => ({ value: m, label: INFO[m].simbolo }))} />
            </div>
            <p className="mt-1.5 text-xs text-steel-500">
              {f.precio.trim() && leerMonto(f.precio) > 0
                ? `Quien llegue sin mensualidad (ej. a bailoterapia) la paga en caja: ${fmt(leerMonto(f.precio), f.moneda)} y queda inscrito. Los que tienen ${f.planId ? 'el plan' : 'mensualidad'} entran incluidos.`
                : 'Vacío = sin precio: quien no tenga mensualidad entra como cortesía o pagando un pase.'}
            </p>
          </div>
          <Field label="Cupo" hint="0 = sin límite">
            <NumInput value={f.cupo} min={0} max={500} onChange={(n) => set('cupo', n)} />
          </Field>
          <Field label="Nivel">
            <select className="input" value={f.nivel} onChange={(e) => set('nivel', e.target.value as Nivel)}>
              {NIVELES.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Características */}
        <div className="rounded-2xl border border-white/[0.06] p-4">
          <span className="label">Características de la clase</span>
          <p className="mb-3 text-xs text-steel-500">Toca para marcar qué trabaja y cuánto (1 a 5). Toca el mismo punto otra vez para quitarlo.</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {CARACTERISTICAS.map((c) => {
              const v = f.caracteristicas[c.key] ?? 0;
              return (
                <div key={c.key} className={cx('flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition', v ? 'border-white/15 bg-white/[0.03]' : 'border-white/[0.05]')}>
                  <button type="button" className="flex items-center gap-2 text-sm font-bold" style={{ color: v ? c.color : undefined }} onClick={() => set('caracteristicas', { ...f.caracteristicas, [c.key]: v ? 0 : 3 })}>
                    <c.icon className="h-4 w-4" style={{ color: c.color }} />
                    <span className={v ? '' : 'text-steel-400'}>{c.label}</span>
                  </button>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        title={`${n}/5`}
                        className="h-6 w-6 rounded-full border transition"
                        style={{ background: n <= v ? c.color : 'transparent', borderColor: n <= v ? c.color : 'rgba(255,255,255,0.12)' }}
                        onClick={() => set('caracteristicas', { ...f.caracteristicas, [c.key]: v === n ? 0 : n })}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Field label="Descripción (opcional)">
          <textarea className="input" rows={2} value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} placeholder="Circuito de 5 estaciones, traer toalla…" />
        </Field>
        <Field label="Color">
          <div className="flex gap-2">
            {COLORES.map((c) => (
              <button key={c} type="button" onClick={() => set('color', c)} className={cx('h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-ink-900', f.color === c ? 'ring-white' : 'ring-transparent')} style={{ background: c }} />
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

// ── Inscritos ────────────────────────────────────────────────────────
function CoberturaChip({ i, planClase }: { i: Inscrito; planClase: string | null }) {
  if (i.asistioEn) {
    const t = { plan: 'Con su plan', mensualidad: 'Con su mensualidad', pase: 'Pagó su pase', cortesia: 'Cortesía' }[i.cobertura ?? 'plan'];
    return <span className="chip border-ok/30 bg-ok/10 text-ok">✓ Entró {hora(i.asistioEn)} · {t}</span>;
  }
  if (i.acceso === 'plan') return <span className="chip border-ok/30 text-ok">{planClase ?? i.plan} · quedan {i.diasRestantes} días</span>;
  if (i.acceso === 'mensualidad') return <span className="chip border-sky-400/30 text-sky-300">Mensualidad {i.plan} · {i.diasRestantes} días</span>;
  return <span className="chip border-warn/40 bg-warn/10 text-warn">{i.congelada ? 'Membresía congelada' : 'Sin mensualidad'}</span>;
}

function ClaseDrawer({ id, onClose, onEditar }: { id: number; onClose: () => void; onEditar: (c: ClaseDetalle) => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { user } = useAuth();
  const gestion = user?.rol === 'dueno' || user?.rol === 'admin_caja';
  const [nuevoCliente, setNuevoCliente] = useState<string | null>(null);
  const [verSug, setVerSug] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [cancelar, setCancelar] = useState(false);
  const [motivo, setMotivo] = useState('');
  const { data: c, isLoading } = useQuery({ queryKey: ['clase', id], queryFn: () => api<ClaseDetalle>(`/clases/${id}`), refetchInterval: 20_000 });
  const refrescar = () => ['clase', 'clases', 'membresias', 'asistencia'].forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
  const err = (e: Error) => toast.error(e.message);

  const inscribir = useMutation({
    mutationFn: (socioIds: string[]) => api<{ agregados: number; yaEstaban: number }>(`/clases/${id}/inscritos`, { body: { socioIds } }),
    onSuccess: (r) => {
      toast.success(r.agregados ? `${r.agregados} inscrito(s)` : 'Ya estaba inscrito');
      setMarcados(new Set());
      refrescar();
    },
    onError: err,
  });
  const quitar = useMutation({ mutationFn: (sid: string) => api(`/clases/${id}/inscritos/${sid}`, { method: 'DELETE' }), onSuccess: refrescar, onError: err });
  const pasar = useMutation({
    mutationFn: (v: { sid: string; cobertura?: 'pase' | 'cortesia' }) => api<{ texto: string }>(`/clases/${id}/inscritos/${v.sid}/pasar`, { body: { cobertura: v.cobertura } }),
    onSuccess: (r) => (toast.success(`Entrada registrada · ${r.texto}`), refrescar()),
    onError: err,
  });
  const deshacer = useMutation({ mutationFn: (sid: string) => api(`/clases/${id}/inscritos/${sid}/deshacer`, { method: 'POST' }), onSuccess: () => (toast('Entrada deshecha'), refrescar()), onError: err });
  const estado = useMutation({
    mutationFn: (reactivar: boolean) => api(`/clases/${id}/cancelar`, { body: { motivo: motivo || null, reactivar } }),
    onSuccess: () => (setCancelar(false), refrescar()),
    onError: err,
  });
  const { data: rec } = useQuery({ queryKey: ['clase-recordatorio', id], queryFn: () => api<{ conectado: boolean; automatico: boolean; cuando: string; enviados: number; ejemplo: string }>(`/clases/${id}/recordatorio`) });
  const [verMsg, setVerMsg] = useState(false);
  const recordar = useMutation({
    mutationFn: (forzar: boolean) => api<{ enviados: number; yaEnviados: number; sinTelefono: number; errores: number }>(`/clases/${id}/recordar`, { body: { forzar } }),
    onSuccess: (r) => {
      toast.success(`Recordatorio enviado a ${r.enviados} persona(s)`, { description: [r.yaEnviados && `${r.yaEnviados} ya lo tenían`, r.sinTelefono && `${r.sinTelefono} sin teléfono`, r.errores && `${r.errores} con error`].filter(Boolean).join(' · ') || undefined });
      void qc.invalidateQueries({ queryKey: ['clase-recordatorio', id] });
    },
    onError: err,
  });
  const borrar = useMutation({ mutationFn: () => api(`/clases/${id}`, { method: 'DELETE' }), onSuccess: () => (toast.success('Clase borrada'), refrescar(), onClose()), onError: err });
  const repetir = useMutation({
    mutationFn: () =>
      api<Clase>('/clases', {
        body: { nombre: c!.nombre, descripcion: c!.descripcion, planId: c!.planId, entrenadorId: c!.entrenadorId, fecha: sumarDias(c!.dia, 7), hora: c!.hora, duracionMin: c!.duracionMin, cupo: c!.cupo, nivel: c!.nivel, caracteristicas: c!.caracteristicas, color: c!.color, precio: Number(c!.precio ?? 0) > 0 ? Number(c!.precio) : null, moneda: c!.moneda },
      }),
    onSuccess: (n) => (toast.success(`Repetida el ${diaLargo(n.dia)}`), refrescar()),
    onError: err,
  });

  if (isLoading || !c)
    return (
      <Drawer title="Clase" onClose={onClose}>
        <Loading />
      </Drawer>
    );

  const cancelada = c.estado === 'cancelada';
  const lleno = !!c.cupo && c.inscritos.length >= c.cupo;
  const conPrecio = Number(c.precio ?? 0) > 0;
  const pendientesCubiertos = c.inscritos.filter((i) => !i.asistioEn && i.acceso !== 'sin_mensualidad');
  const asistieron = c.inscritos.filter((i) => i.asistioEn).length;

  return (
    <>
      <Drawer
        title={
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: c.color }} /> {c.nombre}
          </span>
        }
        subtitle={<span className="capitalize">{`${diaLargo(c.dia)} · ${hora12(c.hora)} – ${hora12(horaFin(c.hora, c.duracionMin))}`}</span>}
        onClose={onClose}
        footer={
          <div className="flex w-full flex-wrap gap-2">
            <button className="btn-ghost btn-sm" onClick={() => onEditar(c)}>
              <Pencil className="h-4 w-4" /> Editar
            </button>
            <button className="btn-ghost btn-sm" disabled={repetir.isPending} onClick={() => repetir.mutate()}>
              <Copy className="h-4 w-4" /> Repetir la próxima semana
            </button>
            {cancelada ? (
              <button className="btn-ghost btn-sm" onClick={() => estado.mutate(true)}>
                <RotateCcw className="h-4 w-4" /> Reactivar
              </button>
            ) : (
              <button className="btn-ghost btn-sm text-bad" onClick={() => setCancelar(true)}>
                <Ban className="h-4 w-4" /> Cancelar clase
              </button>
            )}
            {gestion && asistieron === 0 && (
              <button className="btn-ghost btn-sm ml-auto text-bad" onClick={() => confirm('¿Borrar esta clase?') && borrar.mutate()}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        }
      >
        {cancelada && (
          <div className="mb-4 rounded-2xl border border-bad/30 bg-bad/[0.08] p-3 text-sm text-bad">
            Clase cancelada{c.motivoCancelacion ? `: ${c.motivoCancelacion}` : ''}
          </div>
        )}

        {/* Ficha */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.06] p-4">
            <p className="label">Entrenador</p>
            <p className="font-bold text-white">{c.entrenador ?? 'Sin asignar'}</p>
            {c.entrenadorEspecialidad && <p className="text-xs text-steel-500">{c.entrenadorEspecialidad}</p>}
          </div>
          <div className="rounded-2xl border border-white/[0.06] p-4">
            <p className="label">Plan</p>
            <p className="font-bold text-white">{c.plan ?? 'Abierta'}</p>
            <p className="text-xs text-steel-500">{c.plan ? 'Entran incluidos quienes lo tengan' : 'Cualquier mensualidad vigente'}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] p-4">
            <p className="label">Cupo</p>
            <p className="tnum font-bold text-white">
              {c.inscritos.length}
              {c.cupo ? ` / ${c.cupo}` : ''} <span className="text-xs font-normal text-steel-500">inscritos · {asistieron} entraron</span>
            </p>
            {!!c.cupo && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div className={cx('h-full rounded-full', lleno ? 'bg-bad' : 'bg-flame-500')} style={{ width: `${Math.min(100, (c.inscritos.length / c.cupo) * 100)}%` }} />
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {c.nivel && <span className="chip border-white/15 text-steel-200">{nivelTexto(c.nivel)}</span>}
          <span className="chip border-white/15 text-steel-300">
            <Clock className="h-3 w-3" /> {c.duracionMin} min
          </span>
        </div>
        {Object.keys(c.caracteristicas).length > 0 && (
          <div className="mt-4 rounded-2xl border border-white/[0.06] p-4">
            <BarrasCaracteristicas car={c.caracteristicas} />
          </div>
        )}
        {c.descripcion && <p className="mt-3 text-sm text-steel-300">{c.descripcion}</p>}

        {/* Recordatorio por WhatsApp */}
        {!cancelada && rec && (
          <div className="mt-4 rounded-2xl border border-ok/20 bg-ok/[0.04] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-bold text-white">
                <MessageCircle className="h-4 w-4 text-ok" /> Recordatorio por WhatsApp
              </p>
              <span className={cx('chip', rec.conectado ? 'border-ok/30 text-ok' : 'border-warn/30 text-warn')}>{rec.conectado ? 'WhatsApp conectado' : 'WhatsApp desconectado'}</span>
            </div>
            <p className="mt-1 text-xs text-steel-400">
              {rec.automatico ? `Se envía solo ${rec.cuando} a los inscritos` : 'El envío automático está apagado (Panel → WhatsApp)'} · enviado a <b className="text-steel-200">{rec.enviados}</b> de {c.inscritos.length}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-ok btn-sm" disabled={!rec.conectado || !c.inscritos.length || recordar.isPending} onClick={() => recordar.mutate(false)}>
                <MessageCircle className="h-4 w-4" /> {recordar.isPending ? 'Enviando…' : 'Enviar recordatorio ahora'}
              </button>
              {rec.enviados > 0 && (
                <button className="btn-ghost btn-sm" disabled={!rec.conectado || recordar.isPending} onClick={() => confirm('¿Reenviar el recordatorio a todos los inscritos?') && recordar.mutate(true)}>
                  Reenviar a todos
                </button>
              )}
              <button className="btn-ghost btn-sm" onClick={() => setVerMsg((v) => !v)}>
                {verMsg ? 'Ocultar mensaje' : 'Ver mensaje'}
              </button>
            </div>
            {verMsg && <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-ink-950/60 p-3 font-sans text-xs text-steel-200">{rec.ejemplo}</pre>}
          </div>
        )}

        {/* Inscribir */}
        {!cancelada && (
          <div className="mt-6">
            <p className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
              <UserPlus className="h-4 w-4 text-flame-400" /> Inscribir personas {lleno && <span className="text-xs font-normal text-bad">· cupo lleno</span>}
            </p>
            {!lleno && <SocioPicker placeholder="Buscar por cédula, nombre o teléfono…" onPick={(s) => inscribir.mutate([s.id])} onNuevo={(t) => setNuevoCliente(t)} />}
            {!lleno && (
              <button className="mt-2 text-xs font-bold text-flame-300 hover:text-flame-200" onClick={() => setNuevoCliente('')}>
                + Registrar cliente nuevo e inscribirlo
              </button>
            )}
            {c.sugeridos.length > 0 && !lleno && (
              <div className="mt-3 rounded-2xl border border-white/[0.06]">
                <button className="flex w-full items-center justify-between px-4 py-3 text-left text-sm" onClick={() => setVerSug((v) => !v)}>
                  <span>
                    <b className="text-white">{c.sugeridos.length}</b> <span className="text-steel-400">con el plan {c.plan} vigente sin inscribir</span>
                  </span>
                  <span className="text-xs font-bold text-flame-300">{verSug ? 'Ocultar' : 'Ver y elegir'}</span>
                </button>
                {verSug && (
                  <div className="border-t border-white/[0.06]">
                    <div className="max-h-64 overflow-y-auto">
                      {c.sugeridos.map((s) => (
                        <label key={s.socioId} className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-white/[0.03]">
                          <input
                            type="checkbox"
                            className="accent-[#FF8A10]"
                            checked={marcados.has(s.socioId)}
                            onChange={(e) =>
                              setMarcados((m) => {
                                const n = new Set(m);
                                if (e.target.checked) n.add(s.socioId);
                                else n.delete(s.socioId);
                                return n;
                              })
                            }
                          />
                          <Avatar socioId={s.socioId} nombre={nombreDe(s)} tieneFoto={s.tieneFoto} size={28} />
                          <span className="flex-1 text-sm text-steel-100">{nombreDe(s)}</span>
                          <span className="text-xs text-steel-500">hasta {fecha(s.hasta)}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2 border-t border-white/[0.06] p-3">
                      <button className="btn-primary btn-sm" disabled={!marcados.size || inscribir.isPending} onClick={() => inscribir.mutate([...marcados])}>
                        Inscribir {marcados.size || ''}
                      </button>
                      <button className="btn-ghost btn-sm" disabled={inscribir.isPending} onClick={() => inscribir.mutate(c.sugeridos.map((s) => s.socioId))}>
                        Inscribir a todos ({c.sugeridos.length})
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Lista */}
        <div className="mt-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-bold text-white">
              <Users className="h-4 w-4 text-flame-400" /> Lista de la clase ({c.inscritos.length})
            </p>
            {c.esHoy && !cancelada && pendientesCubiertos.length > 1 && (
              <button
                className="btn-ok btn-sm"
                disabled={pasar.isPending}
                onClick={async () => {
                  for (const i of pendientesCubiertos) await pasar.mutateAsync({ sid: i.socioId }).catch(() => undefined);
                }}
              >
                <DoorOpen className="h-4 w-4" /> Dar entrada a los {pendientesCubiertos.length} con plan
              </button>
            )}
          </div>
          {!c.esHoy && !cancelada && <p className="mb-2 text-xs text-steel-500">La entrada se da el día de la clase. Hoy puedes ir armando la lista.</p>}
          {!c.inscritos.length ? (
            <p className="rounded-2xl border border-dashed border-white/10 py-8 text-center text-sm text-steel-500">Nadie inscrito todavía</p>
          ) : (
            <div className="divide-y divide-white/[0.05] rounded-2xl border border-white/[0.06]">
              {c.inscritos.map((i) => (
                <div key={i.socioId} className={cx('flex flex-wrap items-center gap-3 px-4 py-3', i.asistioEn && 'bg-ok/[0.03]')}>
                  <Avatar socioId={i.socioId} nombre={nombreDe(i)} tieneFoto={i.tieneFoto} size={40} ring={i.asistioEn ? 'ok' : undefined} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-steel-100">{nombreDe(i)}</p>
                    <p className="text-xs text-steel-500">
                      {i.cedula ? `C.I. ${i.cedula}` : `#${i.codigo}`} {i.telefono && `· ${i.telefono}`}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <CoberturaChip i={i} planClase={c.plan} />
                      {i.ventaId && (
                        <span className="chip border-ok/30 bg-ok/[0.08] text-ok">
                          <Wallet className="h-3 w-3" /> Pagó la clase{i.ticket ? ` · ticket #${i.ticket}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {!i.asistioEn && !cancelada && conPrecio && i.acceso === 'sin_mensualidad' && !i.ventaId && (
                      <button className="btn-primary btn-sm" title="Ir a caja: queda inscrito con su pago" onClick={() => nav(`/mostrador?cliente=${i.socioId}&clase=${c.id}`)}>
                        <Wallet className="h-4 w-4" /> Cobrar clase {fmt(Number(c.precio), c.moneda)}
                      </button>
                    )}
                    {i.asistioEn ? (
                      <button className="btn-ghost btn-sm" title="Deshacer entrada" onClick={() => deshacer.mutate(i.socioId)}>
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    ) : (
                      c.esHoy &&
                      !cancelada &&
                      (i.acceso !== 'sin_mensualidad' || i.ventaId ? (
                        <button className="btn-ok btn-sm" disabled={pasar.isPending} onClick={() => pasar.mutate({ sid: i.socioId })}>
                          <DoorOpen className="h-4 w-4" /> Dejar pasar
                        </button>
                      ) : (
                        <>
                          {!conPrecio && (
                            <>
                              <button className="btn-ghost btn-sm" title="Ir a caja a cobrarle su pase" onClick={() => nav(`/mostrador?cliente=${i.socioId}${c.planId ? `&plan=${c.planId}` : ''}`)}>
                                <Wallet className="h-4 w-4" /> Cobrar
                              </button>
                              <button className="btn-ok btn-sm" disabled={pasar.isPending} onClick={() => pasar.mutate({ sid: i.socioId, cobertura: 'pase' })}>
                                <Check className="h-4 w-4" /> Ya pagó: pasar
                              </button>
                            </>
                          )}
                          <button className="btn-ghost btn-sm" disabled={pasar.isPending} onClick={() => pasar.mutate({ sid: i.socioId, cobertura: 'cortesia' })}>
                            <Gift className="h-4 w-4" /> Cortesía
                          </button>
                        </>
                      ))
                    )}
                    {!i.asistioEn && (
                      <button className="rounded-lg p-1.5 text-steel-500 hover:text-bad" title="Quitar de la clase" onClick={() => quitar.mutate(i.socioId)}>
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Drawer>

      {nuevoCliente !== null && <SocioForm sinPlan nombreInicial={nuevoCliente} onClose={() => setNuevoCliente(null)} onSaved={(s) => inscribir.mutate([s.id])} />}
      {cancelar && (
        <Modal
          title="Cancelar clase"
          size="sm"
          onClose={() => setCancelar(false)}
          footer={
            <button className="btn-danger" disabled={estado.isPending} onClick={() => estado.mutate(false)}>
              <Ban className="h-4 w-4" /> Cancelar clase
            </button>
          }
        >
          <p className="mb-3 text-sm text-steel-400">La clase queda en el calendario como cancelada. Puedes reactivarla después.</p>
          <Field label="Motivo (opcional)">
            <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="El entrenador no puede, feriado…" />
          </Field>
        </Modal>
      )}
    </>
  );
}

// ── Página ───────────────────────────────────────────────────────────
function TarjetaClase({ c, onClick }: { c: Clase; onClick: () => void }) {
  const ahora = new Date();
  const ini = new Date(c.inicio);
  const fin = new Date(ini.getTime() + c.duracionMin * 60_000);
  const enCurso = ahora >= ini && ahora <= fin && c.estado !== 'cancelada';
  const pasada = ahora > fin;
  const lleno = !!c.cupo && c.inscritos >= c.cupo;
  return (
    <button onClick={onClick} className={cx('plate w-full p-3 pt-4 text-left transition hover:border-white/20', c.estado === 'cancelada' && 'opacity-50', pasada && c.estado !== 'cancelada' && 'opacity-75', enCurso && 'ring-2 ring-ok/50')}>
      <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl" style={{ background: c.color }} />
      <div className="flex items-start justify-between gap-2">
        <p className="tnum text-xs font-bold text-flame-300">
          {hora12(c.hora)} <span className="font-normal text-steel-500">· {c.duracionMin}′</span>
        </p>
        {enCurso && <span className="rounded-full bg-ok/15 px-2 py-0.5 text-[10px] font-bold uppercase text-ok">En curso</span>}
        {c.estado === 'cancelada' && <span className="rounded-full bg-bad/15 px-2 py-0.5 text-[10px] font-bold uppercase text-bad">Cancelada</span>}
      </div>
      <p className={cx('mt-1 font-display font-extrabold text-white', c.estado === 'cancelada' && 'line-through')}>{c.nombre}</p>
      <p className="truncate text-xs text-steel-400">
        {c.entrenador ?? 'Sin entrenador'}
        {c.nivel && c.nivel !== 'todos' && ` · ${nivelTexto(c.nivel)}`}
      </p>
      {c.plan && <p className="truncate text-[11px] text-steel-500">Plan {c.plan}</p>}
      {Number(c.precio ?? 0) > 0 && <p className="tnum mt-0.5 text-[11px] font-bold text-flame-300">{fmt(Number(c.precio), c.moneda)} sin mensualidad</p>}
      <div className="mt-2">
        <BarrasCaracteristicas car={c.caracteristicas} compacto />
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        <Users className="h-3.5 w-3.5 text-steel-500" />
        <span className={cx('tnum font-bold', lleno ? 'text-bad' : 'text-steel-200')}>
          {c.inscritos}
          {c.cupo ? `/${c.cupo}` : ''}
        </span>
        {c.asistieron > 0 && <span className="text-ok">· {c.asistieron} entraron</span>}
      </div>
    </button>
  );
}

export default function Clases() {
  const [semana, setSemana] = useState(lunesDe(hoyISO()));
  const [vista, setVista] = useState<'semana' | 'lista'>('semana');
  const [abierta, setAbierta] = useState<number | null>(null);
  const [editor, setEditor] = useState<{ clase?: Clase | ClaseDetalle; fecha?: string } | null>(null);
  const hasta = sumarDias(semana, 6);
  const { data, isLoading } = useQuery({ queryKey: ['clases', semana], queryFn: () => api<Clase[]>('/clases', { query: { desde: semana, hasta } }), refetchInterval: 30_000 });
  const t = useTabla(
    data,
    {
      dia: { label: 'Día y hora', valor: (c) => `${c.dia} ${c.hora}` },
      nombre: { label: 'Clase', valor: (c) => c.nombre },
      entrenador: { label: 'Entrenador', valor: (c) => c.entrenador },
      plan: { label: 'Plan', valor: (c) => c.plan },
      inscritos: { label: 'Inscritos', valor: (c) => c.inscritos },
    },
    { id: 'clases', orden: { col: 'dia', dir: 'asc' } },
  );
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDias(semana, i)), [semana]);
  const hoy = hoyISO();
  const activas = (data ?? []).filter((c) => c.estado !== 'cancelada');
  const deHoy = activas.filter((c) => c.dia === hoy);

  return (
    <div>
      <PageHeader
        title="Clases"
        kicker="CrossFit · Funcional · y más"
        actions={
          <button className="btn-primary" onClick={() => setEditor({ fecha: hoy >= semana && hoy <= hasta ? hoy : semana })}>
            <CalendarPlus className="h-4 w-4" /> Nueva clase
          </button>
        }
      >
        Crea la clase, elige al entrenador, inscribe a la gente y dales entrada. Quien no tenga mensualidad paga su pase o pasa como cortesía.
      </PageHeader>

      {/* Navegación */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button className="btn-ghost btn-sm" onClick={() => setSemana(sumarDias(semana, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button className="btn-ghost btn-sm" onClick={() => setSemana(lunesDe(hoy))}>
            Esta semana
          </button>
          <button className="btn-ghost btn-sm" onClick={() => setSemana(sumarDias(semana, 7))}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <p className="font-bold capitalize text-white">
          {fecha(semana)} – {fecha(hasta)}
        </p>
        <div className="ml-auto flex items-center gap-4">
          <p className="text-sm text-steel-400">
            <b className="text-white">{activas.length}</b> clases · <b className="text-white">{activas.reduce((s, c) => s + c.inscritos, 0)}</b> inscritos
            {deHoy.length > 0 && (
              <>
                {' '}
                · <b className="text-ok">{deHoy.length}</b> hoy
              </>
            )}
          </p>
          <Tabs
            value={vista}
            onChange={setVista}
            items={[
              { value: 'semana', label: 'Semana' },
              { value: 'lista', label: 'Lista' },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <Loading />
      ) : vista === 'semana' ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {dias.map((d) => {
            const delDia = (data ?? []).filter((c) => c.dia === d);
            const esHoy = d === hoy;
            return (
              <div key={d} className={cx('rounded-2xl border p-2.5', esHoy ? 'border-flame-500/40 bg-flame-500/[0.04]' : 'border-white/[0.05]')}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className={cx('text-sm font-bold capitalize', esHoy ? 'text-flame-300' : 'text-steel-300')}>
                    {diaLargo(d).split(',')[0]} <span className="tnum text-steel-500">{Number(d.slice(8))}</span>
                  </p>
                  <button className="rounded-lg p-1 text-steel-500 hover:bg-white/5 hover:text-white" title="Nueva clase este día" onClick={() => setEditor({ fecha: d })}>
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {delDia.map((c) => (
                    <TarjetaClase key={c.id} c={c} onClick={() => setAbierta(c.id)} />
                  ))}
                  {!delDia.length && <p className="px-1 py-4 text-center text-xs text-steel-600">Sin clases</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : !data?.length ? (
        <Empty icon={<CalendarDays className="h-7 w-7" />} title="Sin clases esta semana" action={<button className="btn-primary" onClick={() => setEditor({ fecha: semana })}>Crear clase</button>} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>
                  <Th t={t} col="dia" />
                </th>
                <th>
                  <Th t={t} col="nombre" />
                </th>
                <th>
                  <Th t={t} col="entrenador" />
                </th>
                <th>
                  <Th t={t} col="plan" />
                </th>
                <th>Trabaja</th>
                <th className="text-right">
                  <Th t={t} col="inscritos" />
                </th>
              </tr>
            </thead>
            <tbody>
              {t.visibles.map((c) => (
                <tr key={c.id} className={cx('cursor-pointer', c.estado === 'cancelada' && 'opacity-50')} onClick={() => setAbierta(c.id)}>
                  <td className="whitespace-nowrap capitalize text-steel-300">
                    {diaLargo(c.dia)} · {hora12(c.hora)}
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-2 font-bold text-steel-100">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                      <span className={c.estado === 'cancelada' ? 'line-through' : ''}>{c.nombre}</span>
                    </span>
                    {c.nivel && c.nivel !== 'todos' && <span className="ml-2 text-xs text-steel-500">{nivelTexto(c.nivel)}</span>}
                  </td>
                  <td className="text-steel-300">{c.entrenador ?? '—'}</td>
                  <td className="text-steel-400">{c.plan ?? 'Abierta'}</td>
                  <td>
                    <BarrasCaracteristicas car={c.caracteristicas} compacto />
                  </td>
                  <td className="tnum text-right font-bold text-steel-100">
                    {c.inscritos}
                    {c.cupo ? `/${c.cupo}` : ''}
                    {c.asistieron > 0 && <span className="block text-xs font-normal text-ok">{c.asistieron} entraron</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Paginacion t={t} />
        </div>
      )}

      {abierta !== null && <ClaseDrawer id={abierta} onClose={() => setAbierta(null)} onEditar={(c) => setEditor({ clase: c })} />}
      {editor && <ClaseEditor clase={editor.clase} fechaInicial={editor.fecha} onClose={() => setEditor(null)} onGuardada={(id) => !editor.clase && setAbierta(id)} />}
    </div>
  );
}
