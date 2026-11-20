/**
 * Gestión de entrenadores para el administrador (dueño y administrador de caja):
 * alta / edición en 3 pasos, ficha completa con todas sus acciones, marcación
 * manual y permisos registrados directamente. Se usa en Panel y en Mostrador.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  Clock,
  Dices,
  Eye,
  EyeOff,
  FileText,
  Hand,
  Pencil,
  Power,
  RefreshCw,
  ScanFace,
  UserPlus,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { fechaHora, hoyISO, hora, sumarDias } from '../lib/format';
import type { BioEstado, EntrenadorHoy, Horario, TipoMarcacion } from '../lib/types';
import { INFO, leerMonto, MONEDAS, type Moneda } from '../lib/monedas';
import { EntrenadorAvatar, EstadoEntrenador, fotoEntrenadorUrl } from './entrenadores';
import { FotoCaptura } from './FotoCaptura';
import { BioBadge, cx, Drawer, Field, Loading, Modal, Tabs, Toggle } from './ui';

export interface Entrenador {
  id: string;
  codigo: number;
  nombre: string;
  apellido: string;
  cedula: string | null;
  telefono: string | null;
  especialidad: string | null;
  horario: Horario;
  activo: boolean;
  bioEstado: BioEstado;
  bioError: string | null;
  tieneFoto: boolean;
  pagoTipo?: PagoTipo;
  pagoTarifa?: number;
  pagoMoneda?: Moneda;
}
export type PagoTipo = 'ninguno' | 'fijo' | 'por_hora' | 'por_clase';
export const TIPOS_PAGO: Array<{ value: PagoTipo; label: string; unidad: string }> = [
  { value: 'ninguno', label: 'Sin configurar', unidad: '' },
  { value: 'fijo', label: 'Fijo', unidad: 'por periodo' },
  { value: 'por_hora', label: 'Por hora', unidad: 'por hora marcada' },
  { value: 'por_clase', label: 'Por clase', unidad: 'por clase dictada' },
];
export interface Marcacion {
  id: number;
  tipo: TipoMarcacion;
  fechaHora: string;
  origen: 'kiosko' | 'lector' | 'manual';
  fotoId: number | null;
  nota: string | null;
  minutosTarde: number | null;
  anulada: boolean;
  entrenadorId: string;
  entrenador: string;
  registradoPor: string | null;
}
export interface Permiso {
  id: number;
  entrenadorId: string;
  tipo: string;
  desde: string;
  hasta: string;
  motivo: string;
  soporteId: number | null;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  resueltoEn: string | null;
  notaResolucion: string | null;
  creadoEn: string;
  entrenador: string;
  resueltoPor: string | null;
}
export interface FilaReporte {
  id: string;
  nombre: string;
  diasTrabajados: number;
  horas: number;
  tardanzas: number;
  minutosTarde: number;
  salidasTempranas: number;
  retiros: number;
  diasPermiso: number;
  ausencias: number;
  fechasAusencia: string[];
}

export const DIAS: Array<{ k: keyof Horario; n: string; largo: string }> = [
  { k: '1', n: 'Lun', largo: 'Lunes' },
  { k: '2', n: 'Mar', largo: 'Martes' },
  { k: '3', n: 'Mié', largo: 'Miércoles' },
  { k: '4', n: 'Jue', largo: 'Jueves' },
  { k: '5', n: 'Vie', largo: 'Viernes' },
  { k: '6', n: 'Sáb', largo: 'Sábado' },
  { k: '7', n: 'Dom', largo: 'Domingo' },
];
export const tipoCls: Record<TipoMarcacion, string> = { entrada: 'text-ok', salida: 'text-steel-300', retiro: 'text-warn', regreso: 'text-sky-300' };

/** Refresca todo lo de entrenadores en todas las pantallas. */
export const useRefrescarEntrenadores = () => {
  const qc = useQueryClient();
  return () => ['entrenadores', 'entrenadores-hoy', 'marcaciones', 'permisos', 'reporte-ent', 'ficha-ent'].forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
};

const minutos = (h: string) => {
  const [a, b] = h.split(':').map(Number);
  return (a ?? 0) * 60 + (b ?? 0);
};
export const horasSemana = (h: Horario) =>
  Object.values(h).reduce((s, d) => {
    if (!d) return s;
    let m = minutos(d.salida) - minutos(d.entrada);
    if (m < 0) m += 24 * 60;
    return s + m;
  }, 0) / 60;

const PRESETS: Array<{ label: string; dias: Array<keyof Horario>; entrada: string; salida: string }> = [
  { label: 'Lun–Vie · mañana', dias: ['1', '2', '3', '4', '5'], entrada: '06:00', salida: '14:00' },
  { label: 'Lun–Vie · tarde', dias: ['1', '2', '3', '4', '5'], entrada: '14:00', salida: '22:00' },
  { label: 'Lun–Sáb · mañana', dias: ['1', '2', '3', '4', '5', '6'], entrada: '06:00', salida: '14:00' },
  { label: 'Lun–Sáb · tarde', dias: ['1', '2', '3', '4', '5', '6'], entrada: '14:00', salida: '22:00' },
];
const ESPECIALIDADES = ['Pesas', 'Funcional', 'Spinning', 'Crossfit', 'Personalizado', 'Bailoterapia', 'Recepción de sala'];

// ═════════════════════════ Alta / edición en 3 pasos ═════════════════════════

type Paso = 'datos' | 'horario' | 'rostro';
const PASOS: Array<{ k: Paso; n: string }> = [
  { k: 'datos', n: 'Datos y PIN' },
  { k: 'horario', n: 'Horario' },
  { k: 'rostro', n: 'Rostro' },
];

export function EntrenadorEditor({ e, onClose, onGuardado }: { e: Entrenador | null; onClose: () => void; onGuardado?: (id: string) => void }) {
  const refrescar = useRefrescarEntrenadores();
  const nuevo = !e;
  const [paso, setPaso] = useState<Paso>('datos');
  const [f, setF] = useState({
    nombre: e?.nombre ?? '',
    apellido: e?.apellido ?? '',
    cedula: e?.cedula ?? '',
    telefono: e?.telefono ?? '',
    especialidad: e?.especialidad ?? '',
    activo: e?.activo ?? true,
    pin: '',
    pagoTipo: (e?.pagoTipo ?? 'ninguno') as PagoTipo,
    pagoTarifa: e?.pagoTarifa ? String(Number(e.pagoTarifa)) : '',
    pagoMoneda: (e?.pagoMoneda ?? 'USD') as Moneda,
  });
  const [verPin, setVerPin] = useState(nuevo);
  const [horario, setHorario] = useState<Horario>(e?.horario ?? { '1': { entrada: '06:00', salida: '14:00' }, '2': { entrada: '06:00', salida: '14:00' }, '3': { entrada: '06:00', salida: '14:00' }, '4': { entrada: '06:00', salida: '14:00' }, '5': { entrada: '06:00', salida: '14:00' } });
  const [foto, setFoto] = useState<string | null | undefined>(undefined);

  const datosOk = f.nombre.trim().length >= 2 && (nuevo ? /^\d{4,6}$/.test(f.pin) : f.pin === '' || /^\d{4,6}$/.test(f.pin));
  const m = useMutation({
    mutationFn: () => {
      const body = {
        nombre: f.nombre.trim(),
        apellido: f.apellido.trim(),
        cedula: f.cedula.trim() || null,
        telefono: f.telefono.trim() || null,
        especialidad: f.especialidad.trim() || null,
        activo: f.activo,
        horario,
        pin: f.pin || undefined,
        pagoTipo: f.pagoTipo,
        pagoTarifa: f.pagoTipo === 'ninguno' ? 0 : leerMonto(f.pagoTarifa),
        pagoMoneda: f.pagoMoneda,
        ...(foto !== undefined && { foto }),
      };
      return e ? api<{ ok: true }>(`/entrenadores/${e.id}`, { method: 'PUT', body }).then(() => ({ id: e.id, codigo: e.codigo })) : api<{ id: string; codigo: number }>('/entrenadores', { body });
    },
    onSuccess: (r) => {
      toast.success(nuevo ? `${f.nombre} quedó registrado · código E${r.codigo}` : 'Cambios guardados', {
        description: foto ? 'Enviando su rostro al lector facial…' : nuevo ? `Ya puede marcar en recepción con su PIN ${f.pin}` : undefined,
      });
      refrescar();
      onGuardado?.(r.id);
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setDia = (k: keyof Horario, v: { entrada: string; salida: string } | null) =>
    setHorario((h) => {
      const n = { ...h };
      if (v) n[k] = v;
      else delete n[k];
      return n;
    });
  const idx = PASOS.findIndex((p) => p.k === paso);
  const puedeIr = (k: Paso) => !nuevo || k === 'datos' || datosOk;
  const ultimo = idx === PASOS.length - 1;

  return (
    <Modal
      title={nuevo ? 'Nuevo entrenador' : `Editar a ${e.nombre} ${e.apellido}`}
      size="lg"
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {idx > 0 ? (
            <button className="btn-ghost" onClick={() => setPaso(PASOS[idx - 1]!.k)}>
              <ArrowLeft className="h-4 w-4" /> {PASOS[idx - 1]!.n}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {!nuevo && (
              <button className="btn-ghost" disabled={!datosOk || m.isPending} onClick={() => m.mutate()}>
                Guardar cambios
              </button>
            )}
            {!ultimo ? (
              <button className="btn-primary" disabled={!puedeIr(PASOS[idx + 1]!.k)} onClick={() => setPaso(PASOS[idx + 1]!.k)}>
                Siguiente: {PASOS[idx + 1]!.n} <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button className="btn-primary" disabled={!datosOk || m.isPending} onClick={() => m.mutate()}>
                <Check className="h-4 w-4" /> {m.isPending ? 'Guardando…' : nuevo ? (foto ? 'Registrar entrenador' : 'Registrar sin rostro') : 'Guardar cambios'}
              </button>
            )}
          </div>
        </div>
      }
    >
      {/* Pasos */}
      <div className="mb-6 grid grid-cols-3 gap-2">
        {PASOS.map((p, i) => (
          <button
            key={p.k}
            type="button"
            disabled={!puedeIr(p.k)}
            onClick={() => setPaso(p.k)}
            className={cx(
              'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-bold transition disabled:opacity-40',
              paso === p.k ? 'border-flame-500/60 bg-flame-500/10 text-white' : 'border-white/[0.06] text-steel-400 hover:text-steel-100',
            )}
          >
            <span className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs', i < idx || (!nuevo && paso !== p.k) ? 'bg-white/10 text-steel-200' : paso === p.k ? 'bg-flame-500 text-ink-950' : 'bg-white/[0.06]')}>
              {i < idx ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            {p.n}
          </button>
        ))}
      </div>

      {paso === 'datos' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre *">
            <input className="input" autoFocus value={f.nombre} onChange={(ev) => setF({ ...f, nombre: ev.target.value })} placeholder="Ej.: Carlos" />
          </Field>
          <Field label="Apellido">
            <input className="input" value={f.apellido} onChange={(ev) => setF({ ...f, apellido: ev.target.value })} placeholder="Ej.: Pérez" />
          </Field>
          <Field label="Cédula">
            <input className="input" value={f.cedula} onChange={(ev) => setF({ ...f, cedula: ev.target.value })} placeholder="V-12345678" />
          </Field>
          <Field label="Teléfono / WhatsApp">
            <input className="input" inputMode="tel" value={f.telefono} onChange={(ev) => setF({ ...f, telefono: ev.target.value })} placeholder="0414…" />
          </Field>
          <Field label="Especialidad" className="sm:col-span-2">
            <input className="input" value={f.especialidad} onChange={(ev) => setF({ ...f, especialidad: ev.target.value })} placeholder="Escribe o elige abajo" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ESPECIALIDADES.map((x) => (
                <button key={x} type="button" onClick={() => setF({ ...f, especialidad: x })} className={cx('chip cursor-pointer', f.especialidad === x ? 'border-flame-500/50 bg-flame-500/10 text-flame-300' : 'border-white/10 text-steel-400 hover:text-steel-100')}>
                  {x}
                </button>
              ))}
            </div>
          </Field>
          <div className="rounded-2xl border border-flame-500/25 bg-flame-500/[0.04] p-4 sm:col-span-2">
            <p className="font-display font-extrabold text-white">{nuevo ? 'PIN para marcar *' : 'Cambiar PIN'}</p>
            <p className="mb-3 text-xs text-steel-400">{nuevo ? 'Con este PIN marca su entrada, salida, retiros y pide permisos en recepción. Díselo al entrenador.' : 'Déjalo vacío para conservar el PIN actual.'}</p>
            <div className="flex gap-2">
              <input
                className="input tnum flex-1 text-center font-wide text-2xl tracking-[0.5em]"
                type={verPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                placeholder="• • • •"
                value={f.pin}
                onChange={(ev) => setF({ ...f, pin: ev.target.value.replace(/\D/g, '') })}
              />
              <button type="button" className="btn-ghost" title={verPin ? 'Ocultar' : 'Ver'} onClick={() => setVerPin(!verPin)}>
                {verPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button type="button" className="btn-ghost" onClick={() => (setF({ ...f, pin: String(Math.floor(1000 + Math.random() * 9000)) }), setVerPin(true))}>
                <Dices className="h-4 w-4" /> Generar
              </button>
            </div>
            {f.pin && !/^\d{4,6}$/.test(f.pin) && <p className="mt-2 text-xs text-warn">El PIN debe tener de 4 a 6 números</p>}
          </div>
          <div className="rounded-2xl border border-white/[0.06] p-4 sm:col-span-2">
            <p className="font-display font-extrabold text-white">Cómo se le paga</p>
            <p className="mb-3 text-xs text-steel-400">El sistema calcula lo que le toca en Entrenadores › Pagos con sus horas marcadas o sus clases dictadas.</p>
            <Tabs value={f.pagoTipo} onChange={(v) => setF({ ...f, pagoTipo: v })} items={TIPOS_PAGO.map((t) => ({ value: t.value, label: t.label }))} />
            {f.pagoTipo !== 'ninguno' && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <input className="input tnum w-40" inputMode="decimal" placeholder="Monto" value={f.pagoTarifa} onChange={(ev) => setF({ ...f, pagoTarifa: ev.target.value })} />
                <Tabs value={f.pagoMoneda} onChange={(v) => setF({ ...f, pagoMoneda: v })} items={MONEDAS.map((x) => ({ value: x, label: INFO[x].simbolo }))} />
                <span className="text-sm text-steel-400">{TIPOS_PAGO.find((t) => t.value === f.pagoTipo)?.unidad}</span>
              </div>
            )}
          </div>
          {!nuevo && (
            <div className="sm:col-span-2">
              <Toggle checked={f.activo} onChange={(v) => setF({ ...f, activo: v })} label="Activo" hint={f.activo ? 'Puede marcar y el lector le abre la puerta' : 'No aparece en recepción y el lector no le abre'} />
            </div>
          )}
        </div>
      )}

      {paso === 'horario' && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-steel-500">Rápido:</span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="chip cursor-pointer border-white/10 text-steel-300 hover:border-flame-500/40 hover:text-white"
                onClick={() => setHorario(Object.fromEntries(p.dias.map((d) => [d, { entrada: p.entrada, salida: p.salida }])))}
              >
                {p.label}
              </button>
            ))}
            <button type="button" className="chip cursor-pointer border-white/10 text-steel-500 hover:text-bad" onClick={() => setHorario({})}>
              Limpiar
            </button>
          </div>
          <div className="space-y-2">
            {DIAS.map((d) => {
              const h = horario[d.k];
              return (
                <div key={d.k} className={cx('flex flex-wrap items-center gap-3 rounded-xl px-3 py-2', h ? 'bg-white/[0.03]' : '')}>
                  <button
                    type="button"
                    onClick={() => setDia(d.k, h ? null : { entrada: '06:00', salida: '14:00' })}
                    className={cx('w-28 rounded-lg py-2 text-sm font-bold transition', h ? 'bg-flame-500 text-ink-950' : 'bg-white/[0.04] text-steel-500 hover:text-steel-200')}
                  >
                    {d.largo}
                  </button>
                  {h ? (
                    <>
                      <input type="time" className="input h-10 w-32" value={h.entrada} onChange={(ev) => setDia(d.k, { ...h, entrada: ev.target.value })} />
                      <span className="text-steel-500">a</span>
                      <input type="time" className="input h-10 w-32" value={h.salida} onChange={(ev) => setDia(d.k, { ...h, salida: ev.target.value })} />
                      <button
                        type="button"
                        className="text-xs font-bold text-steel-500 hover:text-flame-300"
                        onClick={() => setHorario((x) => Object.fromEntries(Object.keys(x).map((k) => [k, { ...h }])))}
                        title="Poner esta hora en todos los días que trabaja"
                      >
                        Copiar a los demás días
                      </button>
                    </>
                  ) : (
                    <span className="text-sm text-steel-600">Libre · toca el día para que trabaje</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-steel-400">
            <Clock className="h-4 w-4 text-flame-500" /> {Object.keys(horario).length} día(s) · {Math.round(horasSemana(horario) * 10) / 10} horas por semana. Con este horario se calculan tardanzas, salidas antes de hora y ausencias.
          </p>
        </div>
      )}

      {paso === 'rostro' && (
        <div className="grid items-center gap-6 md:grid-cols-[260px_1fr]">
          <div>
            {foto === undefined && e?.tieneFoto ? (
              <div className="text-center">
                <img src={fotoEntrenadorUrl(e.id)} alt="" className="mx-auto aspect-square w-full rounded-3xl object-cover" />
                <button type="button" className="btn-ghost btn-sm mt-3" onClick={() => setFoto(null)}>
                  <RefreshCw className="h-4 w-4" /> Tomar otra
                </button>
              </div>
            ) : (
              <FotoCaptura value={foto ?? null} onChange={setFoto} />
            )}
          </div>
          <div className="space-y-3 text-sm text-steel-300">
            <p className="font-display text-lg font-extrabold text-white">Rostro para el lector facial</p>
            <p>Con esta foto el lector lo reconoce: le abre la puerta y marca su entrada y salida solo.</p>
            <ol className="space-y-1.5 text-steel-400">
              <li>1. Que se pare frente al lector facial</li>
              <li>2. Toca “Tomar foto con el lector”</li>
              <li>3. Que mire directo a la pantalla, sin gorra ni lentes oscuros</li>
            </ol>
            {nuevo && !foto && <p className="rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-steel-500">¿No está aquí? Regístralo sin rostro y tómale la foto después desde su ficha. Mientras tanto marca con su PIN.</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ═════════════════════════ Marcación manual ═════════════════════════

export function MarcacionManualModal({ entrenador, siguientes, onClose }: { entrenador: { id: string; nombre: string }; siguientes?: TipoMarcacion[]; onClose: () => void }) {
  const refrescar = useRefrescarEntrenadores();
  const opciones: TipoMarcacion[] = siguientes?.length ? siguientes : ['entrada', 'salida', 'retiro', 'regreso'];
  const [tipo, setTipo] = useState<TipoMarcacion>(opciones[0]!);
  const [nota, setNota] = useState('');
  const m = useMutation({
    mutationFn: () => api('/entrenadores/marcaciones', { body: { entrenadorId: entrenador.id, tipo, nota } }),
    onSuccess: () => (toast.success(`${tipo} de ${entrenador.nombre} registrada`), refrescar(), onClose()),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal
      title={`Marcación manual · ${entrenador.nombre}`}
      size="sm"
      onClose={onClose}
      footer={
        <button className="btn-primary" disabled={nota.trim().length < 3 || m.isPending} onClick={() => m.mutate()}>
          Registrar {tipo}
        </button>
      }
    >
      <p className="mb-4 text-sm text-steel-400">Para cuando olvidó marcar o el lector falló. Queda registrado quién la hizo y a qué hora.</p>
      <Tabs value={tipo} onChange={setTipo} items={opciones.map((s) => ({ value: s, label: <span className="capitalize">{s}</span> }))} />
      <Field label="Motivo" className="mt-4">
        <input className="input" autoFocus value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Olvidó marcar al llegar" />
      </Field>
    </Modal>
  );
}

// ═════════════════════════ Permiso registrado por administración ═════════════════════════

const ahoraLocal = (horas = 0) => {
  const d = new Date(Date.now() + horas * 3600_000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export function PermisoAdminModal({ entrenadores, inicial, onClose }: { entrenadores: Array<{ id: string; nombre: string; apellido: string }>; inicial?: string; onClose: () => void }) {
  const refrescar = useRefrescarEntrenadores();
  const [id, setId] = useState(inicial ?? entrenadores[0]?.id ?? '');
  const [tipo, setTipo] = useState<'permiso' | 'diligencia' | 'reposo' | 'vacaciones' | 'otro'>('permiso');
  const [desde, setDesde] = useState(ahoraLocal(0));
  const [hasta, setHasta] = useState(ahoraLocal(4));
  const [motivo, setMotivo] = useState('');
  const [soporte, setSoporte] = useState<string | null>(null);
  const [aprobado, setAprobado] = useState(true);
  const m = useMutation({
    mutationFn: () => api('/entrenadores/permisos', { body: { entrenadorId: id, tipo, desde, hasta, motivo, soporte, aprobado } }),
    onSuccess: () => (toast.success(aprobado ? 'Permiso registrado y aprobado' : 'Permiso registrado como pendiente'), refrescar(), onClose()),
    onError: (e: Error) => toast.error(e.message),
  });
  const subir = (file: File | undefined) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setSoporte(String(r.result));
    r.readAsDataURL(file);
  };
  const dia = (n: number) => (setDesde(`${sumarDias(hoyISO(), n)}T00:00`), setHasta(`${sumarDias(hoyISO(), n)}T23:59`));
  return (
    <Modal
      title="Registrar permiso"
      onClose={onClose}
      footer={
        <button className="btn-primary" disabled={!id || motivo.trim().length < 3 || m.isPending} onClick={() => m.mutate()}>
          Registrar permiso
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {!inicial && (
          <Field label="Entrenador" className="col-span-2">
            <select className="input" value={id} onChange={(e) => setId(e.target.value)}>
              {entrenadores.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre} {e.apellido}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="col-span-2 overflow-x-auto">
          <Tabs
            value={tipo}
            onChange={setTipo}
            items={[
              { value: 'permiso', label: 'Permiso' },
              { value: 'diligencia', label: 'Diligencia' },
              { value: 'reposo', label: 'Reposo médico' },
              { value: 'vacaciones', label: 'Vacaciones' },
              { value: 'otro', label: 'Otro' },
            ]}
          />
        </div>
        <div className="col-span-2 flex gap-2">
          <button type="button" className="chip cursor-pointer border-white/10 text-steel-300" onClick={() => dia(0)}>
            Todo hoy
          </button>
          <button type="button" className="chip cursor-pointer border-white/10 text-steel-300" onClick={() => dia(1)}>
            Todo mañana
          </button>
        </div>
        <Field label="Desde">
          <input type="datetime-local" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </Field>
        <Field label="Hasta">
          <input type="datetime-local" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </Field>
        <Field label="Motivo" className="col-span-2">
          <textarea className="input" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Cita médica, viaje, asunto familiar…" />
        </Field>
        <Field label="Soporte (opcional)">
          <label className="btn-ghost w-full cursor-pointer">
            <FileText className="h-4 w-4" /> {soporte ? 'Adjuntado ✓' : 'Adjuntar'}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => subir(e.target.files?.[0])} />
          </label>
        </Field>
        <div className="flex items-end">
          <Toggle checked={aprobado} onChange={setAprobado} label="Aprobarlo de una vez" />
        </div>
      </div>
    </Modal>
  );
}

// ═════════════════════════ Ficha del entrenador ═════════════════════════

export function FichaEntrenador({ e, hoy, onClose, onEditar }: { e: Entrenador; hoy: EntrenadorHoy | undefined; onClose: () => void; onEditar: () => void }) {
  const refrescar = useRefrescarEntrenadores();
  const [manual, setManual] = useState(false);
  const [permiso, setPermiso] = useState(false);
  const desdeMes = hoyISO().slice(0, 8) + '01';
  const { data: rep } = useQuery({ queryKey: ['reporte-ent', desdeMes, hoyISO()], queryFn: () => api<FilaReporte[]>('/entrenadores/reporte', { query: { desde: desdeMes, hasta: hoyISO() } }) });
  const { data: marcas, isLoading } = useQuery({
    queryKey: ['ficha-ent', 'marcas', e.id],
    queryFn: () => api<Marcacion[]>('/entrenadores/marcaciones', { query: { desde: sumarDias(hoyISO(), -30), hasta: hoyISO(), entrenadorId: e.id } }),
  });
  const { data: permisos } = useQuery({ queryKey: ['ficha-ent', 'permisos', e.id], queryFn: () => api<Permiso[]>('/entrenadores/permisos', { query: { estado: 'todos', entrenadorId: e.id } }) });
  const mes = rep?.find((r) => r.id === e.id);

  const activar = useMutation({
    mutationFn: () => api(`/entrenadores/${e.id}`, { method: 'PUT', body: { activo: !e.activo } }),
    onSuccess: () => (toast.success(e.activo ? `${e.nombre} quedó inactivo` : `${e.nombre} está activo otra vez`), refrescar(), onClose()),
    onError: (err: Error) => toast.error(err.message),
  });
  const sync = useMutation({
    mutationFn: () => api(`/entrenadores/${e.id}/sincronizar`, { body: {} }),
    onSuccess: () => (toast.success('Enviado al lector facial'), refrescar()),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Drawer
      title={`${e.nombre} ${e.apellido}`}
      subtitle={`E${e.codigo} · ${e.especialidad ?? 'Entrenador'}${e.cedula ? ` · ${e.cedula}` : ''}${e.telefono ? ` · ${e.telefono}` : ''}`}
      onClose={onClose}
      footer={
        <button className={cx('btn-ghost', e.activo && 'hover:text-bad')} disabled={activar.isPending} onClick={() => activar.mutate()}>
          <Power className="h-4 w-4" /> {e.activo ? 'Desactivar' : 'Activar'}
        </button>
      }
    >
      <div className="flex items-center gap-5">
        <EntrenadorAvatar e={e} size={96} />
        <div className="space-y-2">
          {hoy ? <EstadoEntrenador e={hoy} /> : <span className="chip border-white/10 text-steel-500">{e.activo ? 'Fuera' : 'Inactivo'}</span>}
          <div>
            <BioBadge estado={e.bioEstado} />
          </div>
          {e.bioError && <p className="text-xs text-bad">{e.bioError}</p>}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Accion icon={<Pencil className="h-5 w-5" />} label="Editar" onClick={onEditar} />
        <Accion icon={<Hand className="h-5 w-5" />} label="Marcar manual" onClick={() => setManual(true)} disabled={!e.activo} />
        <Accion icon={<CalendarClock className="h-5 w-5" />} label="Dar permiso" onClick={() => setPermiso(true)} />
        <Accion icon={<ScanFace className="h-5 w-5" />} label={e.tieneFoto ? 'Reenviar al lector' : 'Tomar rostro'} onClick={() => (e.tieneFoto ? sync.mutate() : onEditar())} disabled={sync.isPending} />
      </div>

      <p className="label mt-6">Este mes</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Dato n={mes?.diasTrabajados ?? '—'} t="Días" />
        <Dato n={mes?.horas ?? '—'} t="Horas" />
        <Dato n={mes?.tardanzas ?? '—'} t="Tardanzas" alerta={!!mes?.tardanzas} />
        <Dato n={mes?.salidasTempranas ?? '—'} t="Salió antes" alerta={!!mes?.salidasTempranas} />
        <Dato n={mes?.diasPermiso ?? '—'} t="Permisos" />
        <Dato n={mes?.ausencias ?? '—'} t="Ausencias" alerta={!!mes?.ausencias} />
      </div>

      <p className="label mt-6">Horario</p>
      <div className="flex flex-wrap gap-1.5">
        {DIAS.map((d) => {
          const h = e.horario[d.k];
          return (
            <span key={d.k} className={cx('rounded-lg px-2.5 py-1.5 text-xs', h ? 'bg-flame-500/10 text-flame-200' : 'bg-white/[0.03] text-steel-600')}>
              <b>{d.n}</b> {h ? `${h.entrada}–${h.salida}` : 'libre'}
            </span>
          );
        })}
      </div>

      <p className="label mt-6">Marcaciones (30 días)</p>
      {isLoading ? (
        <Loading />
      ) : !marcas?.length ? (
        <p className="text-sm text-steel-500">Todavía no ha marcado.</p>
      ) : (
        <div className="space-y-1">
          {marcas.slice(0, 40).map((m) => (
            <div key={m.id} className={cx('flex items-center gap-3 rounded-lg bg-white/[0.02] px-3 py-2 text-sm', m.anulada && 'opacity-40 line-through')}>
              <span className={cx('w-20 font-bold capitalize', tipoCls[m.tipo])}>{m.tipo}</span>
              <span className="tnum text-steel-300">{fechaHora(m.fechaHora)}</span>
              <span className="ml-auto text-xs text-steel-500">
                {m.origen === 'lector' ? 'Lector' : m.origen === 'manual' ? `Manual · ${m.registradoPor ?? ''}` : 'Kiosko'}
                {(m.minutosTarde ?? 0) > 5 && <span className="ml-2 text-warn">{m.minutosTarde} min tarde</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="label mt-6">Permisos</p>
      {!permisos?.length ? (
        <p className="text-sm text-steel-500">Sin permisos.</p>
      ) : (
        <div className="space-y-1">
          {permisos.map((p) => (
            <div key={p.id} className="rounded-lg bg-white/[0.02] px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold capitalize text-steel-100">{p.tipo}</span>
                <span className={cx('chip', p.estado === 'pendiente' ? 'border-warn/30 text-warn' : p.estado === 'aprobado' ? 'border-ok/30 text-ok' : 'border-bad/30 text-bad')}>{p.estado}</span>
              </div>
              <p className="text-xs text-steel-400">
                {fechaHora(p.desde)} → {fechaHora(p.hasta)} · “{p.motivo}”
              </p>
            </div>
          ))}
        </div>
      )}

      {manual && <MarcacionManualModal entrenador={e} siguientes={hoy?.siguientes} onClose={() => setManual(false)} />}
      {permiso && <PermisoAdminModal entrenadores={[e]} inicial={e.id} onClose={() => setPermiso(false)} />}
    </Drawer>
  );
}

function Accion({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-2 py-3 text-xs font-bold text-steel-300 transition hover:border-flame-500/40 hover:text-white disabled:opacity-40">
      <span className="text-flame-500">{icon}</span>
      {label}
    </button>
  );
}

function Dato({ n, t, alerta }: { n: number | string; t: string; alerta?: boolean }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-2 py-2.5 text-center">
      <p className={cx('tnum font-wide text-xl', alerta ? 'text-warn' : 'text-white')}>{n}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-steel-500">{t}</p>
    </div>
  );
}

// ═════════════════════════ Equipo: tarjetas con estado de hoy y acciones ═════════════════════════

export function EquipoEntrenadores({ compacto }: { compacto?: boolean }) {
  const { data: lista, isLoading } = useQuery({ queryKey: ['entrenadores'], queryFn: () => api<Entrenador[]>('/entrenadores') });
  const { data: hoy } = useQuery({ queryKey: ['entrenadores-hoy'], queryFn: () => api<EntrenadorHoy[]>('/entrenadores/hoy'), refetchInterval: 15_000 });
  const [editar, setEditar] = useState<Entrenador | null | undefined>(undefined);
  const [ficha, setFicha] = useState<string | null>(null);
  const [manual, setManual] = useState<EntrenadorHoy | null>(null);
  const [permiso, setPermiso] = useState(false);
  const [filtro, setFiltro] = useState<'activos' | 'inactivos'>('activos');
  const [q, setQ] = useState('');

  const porId = new Map((hoy ?? []).map((h) => [h.id, h]));
  const todos = lista ?? [];
  const visibles = todos.filter((e) => (filtro === 'activos' ? e.activo : !e.activo)).filter((e) => !q || `${e.nombre} ${e.apellido} ${e.especialidad ?? ''} E${e.codigo}`.toLowerCase().includes(q.toLowerCase()));
  const inactivos = todos.filter((e) => !e.activo).length;
  const presentes = (hoy ?? []).filter((h) => h.estado === 'presente').length;
  const tarde = (hoy ?? []).filter((h) => (h.minutosTarde ?? 0) > 5).length;
  const faltan = (hoy ?? []).filter((h) => h.ausente && !h.permiso).length;
  const fichaE = todos.find((e) => e.id === ficha);

  if (isLoading) return <Loading />;

  return (
    <div>
      {!compacto && todos.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Resumen n={todos.length - inactivos} t="Activos" />
          <Resumen n={presentes} t="En el gym ahora" cls="text-ok" />
          <Resumen n={tarde} t="Llegaron tarde hoy" cls={tarde ? 'text-warn' : undefined} />
          <Resumen n={faltan} t="No han llegado" cls={faltan ? 'text-bad' : undefined} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className="input h-11 max-w-xs flex-1" placeholder="Buscar entrenador…" value={q} onChange={(e) => setQ(e.target.value)} />
        {inactivos > 0 && (
          <Tabs
            value={filtro}
            onChange={setFiltro}
            items={[
              { value: 'activos', label: 'Activos' },
              { value: 'inactivos', label: `Inactivos (${inactivos})` },
            ]}
          />
        )}
        <div className="ml-auto flex gap-2">
          {todos.length > 0 && (
            <button className="btn-ghost" onClick={() => setPermiso(true)}>
              <CalendarClock className="h-4 w-4" /> Dar permiso
            </button>
          )}
          <button className="btn-primary" onClick={() => setEditar(null)}>
            <UserPlus className="h-4 w-4" /> Nuevo entrenador
          </button>
        </div>
      </div>

      {!todos.length ? (
        <div className="plate flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-flame-500/10 text-flame-500">
            <UserPlus className="h-8 w-8" />
          </div>
          <p className="font-wide text-xl text-white">Agrega a tu primer entrenador</p>
          <p className="mt-2 max-w-md text-sm text-steel-400">Datos, PIN para marcar, horario y su rostro para el lector. Toma menos de un minuto.</p>
          <button className="btn-primary btn-xl mt-6" onClick={() => setEditar(null)}>
            <UserPlus className="h-5 w-5" /> Nuevo entrenador
          </button>
        </div>
      ) : !visibles.length ? (
        <p className="py-10 text-center text-steel-500">Nadie coincide con la búsqueda.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibles.map((e) => {
            const h = porId.get(e.id);
            return (
              <div key={e.id} className={cx('plate flex flex-col p-5 pt-6 transition', h?.estado === 'presente' && 'border-ok/25', !e.activo && 'opacity-60')}>
                <button type="button" className="flex items-center gap-4 text-left" onClick={() => setFicha(e.id)}>
                  <EntrenadorAvatar e={e} size={60} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-extrabold text-white">
                      {e.nombre} {e.apellido}
                    </p>
                    <p className="truncate text-xs text-steel-500">
                      E{e.codigo} · {e.especialidad ?? 'Entrenador'}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {h ? <EstadoEntrenador e={h} /> : <span className="chip border-white/10 text-steel-500">Inactivo</span>}
                      {e.bioEstado !== 'sincronizado' && <BioBadge estado={e.bioEstado} />}
                    </div>
                  </div>
                </button>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-steel-400">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {h?.horarioHoy ? `Hoy ${h.horarioHoy.entrada} – ${h.horarioHoy.salida}` : 'Libre hoy'}
                  </span>
                  {(h?.minutosTarde ?? 0) > 5 && <span className="text-warn">Llegó {h!.minutosTarde} min tarde</span>}
                </div>
                {!!h?.marcaciones.length && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {h.marcaciones.map((m) => (
                      <span key={m.id} className={cx('chip border-white/10', tipoCls[m.tipo])}>
                        {m.tipo} {hora(m.fechaHora)}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex gap-2 pt-4">
                  <button className="btn-ghost btn-sm flex-1" onClick={() => setFicha(e.id)}>
                    Ver ficha
                  </button>
                  {h && (
                    <button className="btn-ghost btn-sm flex-1" onClick={() => setManual(h)}>
                      <Hand className="h-4 w-4" /> Marcar
                    </button>
                  )}
                  <button className="btn-ghost btn-sm" title="Editar" onClick={() => setEditar(e)}>
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editar !== undefined && <EntrenadorEditor e={editar} onClose={() => setEditar(undefined)} />}
      {fichaE && <FichaEntrenador e={fichaE} hoy={porId.get(fichaE.id)} onClose={() => setFicha(null)} onEditar={() => (setEditar(fichaE), setFicha(null))} />}
      {manual && <MarcacionManualModal entrenador={manual} siguientes={manual.siguientes} onClose={() => setManual(null)} />}
      {permiso && <PermisoAdminModal entrenadores={todos.filter((e) => e.activo)} onClose={() => setPermiso(false)} />}
    </div>
  );
}

function Resumen({ n, t, cls }: { n: number; t: string; cls?: string }) {
  return (
    <div className="card px-4 py-3">
      <p className={cx('tnum font-wide text-2xl', cls ?? 'text-white')}>{n}</p>
      <p className="text-xs text-steel-500">{t}</p>
    </div>
  );
}
