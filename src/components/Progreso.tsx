/**
 * Progreso del cliente en su ficha: enlace personal (portal), medidas con su
 * evolución y la rutina asignada.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCopy, Dumbbell, Link2, Link2Off, MessageCircle, Plus, Ruler, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { fecha, fechaCorta, hace, hoyISO } from '../lib/format';
import { LineaSerie } from './charts';
import { cx, Field, Modal } from './ui';

export type Medicion = {
  id: number;
  fecha: string;
  peso: number | null;
  grasa: number | null;
  musculo: number | null;
  cintura: number | null;
  cadera: number | null;
  pecho: number | null;
  brazo: number | null;
  pierna: number | null;
  nota: string | null;
};
export interface Ejercicio {
  nombre: string;
  series: string;
  reps: string;
  nota: string;
}
export interface Rutina {
  id: number;
  titulo: string;
  objetivo: string | null;
  dias: Array<{ nombre: string; ejercicios: Ejercicio[] }>;
  activa: boolean;
  entrenadorId: string | null;
  entrenador: string | null;
  actualizadoEn: string;
}
interface Progreso {
  mediciones: Medicion[];
  rutinas: Rutina[];
  portal: { activo: boolean; creadoEn: string | null };
}

export const MEDIDAS: Array<{ k: keyof Medicion; label: string; unidad: string }> = [
  { k: 'peso', label: 'Peso', unidad: 'kg' },
  { k: 'grasa', label: 'Grasa', unidad: '%' },
  { k: 'musculo', label: 'Músculo', unidad: '%' },
  { k: 'cintura', label: 'Cintura', unidad: 'cm' },
  { k: 'cadera', label: 'Cadera', unidad: 'cm' },
  { k: 'pecho', label: 'Pecho', unidad: 'cm' },
  { k: 'brazo', label: 'Brazo', unidad: 'cm' },
  { k: 'pierna', label: 'Pierna', unidad: 'cm' },
];

const num = (v: number | null) => (v == null ? '—' : v.toLocaleString('es-VE', { maximumFractionDigits: 1 }));

/** Diferencia contra la primera medición: −2,4 kg */
export function Cambio({ actual, inicial, unidad, menosEsMejor = true }: { actual: number | null; inicial: number | null; unidad: string; menosEsMejor?: boolean }) {
  if (actual == null || inicial == null || actual === inicial) return null;
  const d = actual - inicial;
  const bueno = menosEsMejor ? d < 0 : d > 0;
  return (
    <span className={cx('text-[11px] font-bold', bueno ? 'text-ok' : 'text-warn')}>
      {d > 0 ? '+' : '−'}
      {Math.abs(d).toLocaleString('es-VE', { maximumFractionDigits: 1 })} {unidad}
    </span>
  );
}

export function ProgresoSocio({ socioId, nombre, telefono }: { socioId: string; nombre: string; telefono: string | null }) {
  const qc = useQueryClient();
  const [medir, setMedir] = useState(false);
  const [rutina, setRutina] = useState<Rutina | 'nueva' | null>(null);
  const [enlace, setEnlace] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ['progreso', socioId], queryFn: () => api<Progreso>(`/socios/${socioId}/progreso`) });
  const refrescar = () => void qc.invalidateQueries({ queryKey: ['progreso', socioId] });

  const portal = useMutation({
    mutationFn: (enviar: boolean) => api<{ url: string; enviado: boolean; error: string | null }>(`/socios/${socioId}/portal`, { body: { baseUrl: window.location.origin, enviar } }),
    onSuccess: (r, enviar) => {
      setEnlace(r.url);
      refrescar();
      if (enviar && r.enviado) toast.success(`Enlace enviado por WhatsApp a ${nombre}`);
      else if (enviar) toast.error(`No se pudo enviar por WhatsApp: ${r.error}. Cópialo y envíalo tú.`);
      else void navigator.clipboard?.writeText(r.url).then(() => toast.success('Enlace copiado'), () => undefined);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const quitar = useMutation({
    mutationFn: () => api(`/socios/${socioId}/portal`, { method: 'DELETE' }),
    onSuccess: () => (toast.success('Acceso desactivado: el enlace anterior ya no abre'), setEnlace(null), refrescar()),
    onError: (e: Error) => toast.error(e.message),
  });
  const borrar = useMutation({
    mutationFn: (mid: number) => api(`/socios/${socioId}/mediciones/${mid}`, { method: 'DELETE' }),
    onSuccess: refrescar,
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data) return null;
  const meds = data.mediciones;
  const ultima = meds[0];
  const primera = meds[meds.length - 1];
  const activa = data.rutinas.find((r) => r.activa);
  const serie = [...meds].reverse().filter((m) => m.peso != null);

  return (
    <>
      {/* ── Portal del cliente ── */}
      <h4 className="label mt-7">Su enlace personal</h4>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-sm text-steel-400">
          {data.portal.activo ? (
            <>
              <Link2 className="mr-1 inline h-4 w-4 text-ok" /> Tiene acceso desde {hace(data.portal.creadoEn)}. Ahí ve su plan, sus entradas, su progreso y su rutina.
            </>
          ) : (
            'Un enlace solo para el cliente (sin usuario ni clave) donde ve su plan, sus entradas, su progreso y su rutina.'
          )}
        </p>
        {enlace && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-ink-950/60 px-3 py-2">
            <code className="min-w-0 flex-1 truncate text-xs text-steel-300">{enlace}</code>
            <button className="text-steel-400 hover:text-flame-400" onClick={() => void navigator.clipboard?.writeText(enlace).then(() => toast.success('Copiado'))} title="Copiar">
              <ClipboardCopy className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {telefono && (
            <button className="btn-ghost btn-sm" disabled={portal.isPending} onClick={() => portal.mutate(true)}>
              <MessageCircle className="h-4 w-4 text-ok" /> {data.portal.activo ? 'Enviar uno nuevo' : 'Enviar'} por WhatsApp
            </button>
          )}
          <button className="btn-ghost btn-sm" disabled={portal.isPending} onClick={() => portal.mutate(false)}>
            <ClipboardCopy className="h-4 w-4" /> {data.portal.activo ? 'Generar nuevo y copiar' : 'Generar y copiar'}
          </button>
          {data.portal.activo && (
            <button className="btn-ghost btn-sm" disabled={quitar.isPending} onClick={() => quitar.mutate()}>
              <Link2Off className="h-4 w-4 text-bad" /> Quitar acceso
            </button>
          )}
        </div>
        {data.portal.activo && <p className="mt-2 text-[11px] text-steel-600">Generar uno nuevo desactiva el anterior (por si lo perdió o lo compartió).</p>}
      </div>

      {/* ── Medidas ── */}
      <div className="mt-7 flex items-center justify-between">
        <h4 className="label mb-0">Progreso</h4>
        <button className="btn-ghost btn-sm" onClick={() => setMedir(true)}>
          <Ruler className="h-4 w-4" /> Anotar medidas
        </button>
      </div>
      {meds.length === 0 ? (
        <p className="mt-2 text-sm text-steel-500">Sin medidas todavía. Anota peso y medidas el primer día para que vea su avance.</p>
      ) : (
        <div className="mt-2 space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {MEDIDAS.filter((m) => ultima[m.k] != null).map((m) => (
              <div key={m.k} className="rounded-xl bg-white/[0.03] px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-steel-500">{m.label}</p>
                <p className="tnum font-bold text-steel-100">
                  {num(ultima[m.k] as number | null)} <span className="text-xs font-normal text-steel-500">{m.unidad}</span>
                </p>
                {meds.length > 1 && <Cambio actual={ultima[m.k] as number | null} inicial={primera[m.k] as number | null} unidad={m.unidad} menosEsMejor={m.k !== 'musculo'} />}
              </div>
            ))}
          </div>
          {serie.length > 1 && (
            <div className="rounded-xl bg-white/[0.02] p-2">
              <LineaSerie data={serie} x="fecha" y="peso" nombre="Peso" formatX={fechaCorta} formatY={(v) => `${v} kg`} />
            </div>
          )}
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {meds.map((m) => (
              <div key={m.id} className="group flex items-center gap-3 text-xs text-steel-400">
                <span className="w-24 shrink-0 font-bold text-steel-300">{fecha(m.fecha)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {MEDIDAS.filter((x) => m[x.k] != null)
                    .map((x) => `${x.label} ${num(m[x.k] as number)}${x.unidad === '%' ? '%' : ` ${x.unidad}`}`)
                    .join(' · ')}
                  {m.nota && ` · ${m.nota}`}
                </span>
                <button className="opacity-0 transition group-hover:opacity-100" onClick={() => confirm('¿Borrar esta medición?') && borrar.mutate(m.id)} title="Borrar">
                  <Trash2 className="h-3.5 w-3.5 text-bad" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Rutina ── */}
      <div className="mt-7 flex items-center justify-between">
        <h4 className="label mb-0">Rutina</h4>
        <button className="btn-ghost btn-sm" onClick={() => setRutina(activa ?? 'nueva')}>
          <Dumbbell className="h-4 w-4" /> {activa ? 'Editar rutina' : 'Asignar rutina'}
        </button>
      </div>
      {activa ? (
        <div className="mt-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="font-bold text-steel-100">{activa.titulo}</p>
          <p className="text-xs text-steel-500">
            {activa.objetivo && `${activa.objetivo} · `}
            {activa.entrenador ? `con ${activa.entrenador} · ` : ''}actualizada {hace(activa.actualizadoEn)}
          </p>
          <div className="mt-3 space-y-2">
            {activa.dias.map((d, i) => (
              <div key={i}>
                <p className="text-xs font-bold text-flame-300">{d.nombre}</p>
                <p className="text-xs text-steel-400">{d.ejercicios.map((e) => `${e.nombre}${e.series ? ` ${e.series}×${e.reps}` : ''}`).join(' · ') || 'Sin ejercicios'}</p>
              </div>
            ))}
          </div>
          {data.rutinas.length > 1 && (
            <button className="mt-3 text-xs font-bold text-steel-500 hover:text-flame-400" onClick={() => setRutina('nueva')}>
              + Nueva rutina (la actual queda en el historial)
            </button>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-steel-500">Sin rutina asignada.</p>
      )}

      {medir && <MedicionModal socioId={socioId} anterior={ultima} onClose={() => setMedir(false)} onDone={refrescar} />}
      {rutina && <RutinaModal socioId={socioId} rutina={rutina === 'nueva' ? null : rutina} onClose={() => setRutina(null)} onDone={refrescar} />}
    </>
  );
}

function MedicionModal({ socioId, anterior, onClose, onDone }: { socioId: string; anterior?: Medicion; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<Record<string, string>>({ fecha: hoyISO(), nota: '' });
  const leer = (v: string | undefined) => (v && v.trim() ? Number(v.replace(',', '.')) : null);
  const m = useMutation({
    mutationFn: () => api(`/socios/${socioId}/mediciones`, { body: { fecha: f.fecha, nota: f.nota || null, ...Object.fromEntries(MEDIDAS.map((x) => [x.k, leer(f[x.k])])) } }),
    onSuccess: () => (toast.success('Medidas guardadas'), onDone(), onClose()),
    onError: (e: Error) => toast.error(e.message),
  });
  const alguna = MEDIDAS.some((x) => leer(f[x.k]) != null && !Number.isNaN(leer(f[x.k])));
  return (
    <Modal
      title="Anotar medidas"
      onClose={onClose}
      footer={
        <button className="btn-primary" disabled={!alguna || m.isPending} onClick={() => m.mutate()}>
          Guardar
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Fecha" className="col-span-2">
          <input type="date" className="input" max={hoyISO()} value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
        </Field>
        {MEDIDAS.map((x) => (
          <Field key={x.k} label={`${x.label} (${x.unidad})`} hint={anterior?.[x.k] != null ? `antes ${num(anterior[x.k] as number)}` : undefined}>
            <input className="input tnum" inputMode="decimal" value={f[x.k] ?? ''} onChange={(e) => setF({ ...f, [x.k]: e.target.value.replace(/[^0-9.,]/g, '') })} />
          </Field>
        ))}
        <Field label="Nota (opcional)" className="col-span-2 sm:col-span-4">
          <input className="input" maxLength={300} value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} placeholder="Ej. en ayunas, después de 1 mes de plan" />
        </Field>
      </div>
    </Modal>
  );
}

const ejercicioVacio = (): Ejercicio => ({ nombre: '', series: '', reps: '', nota: '' });

function RutinaModal({ socioId, rutina, onClose, onDone }: { socioId: string; rutina: Rutina | null; onClose: () => void; onDone: () => void }) {
  const { data: entrenadores } = useQuery({ queryKey: ['entrenadores-hoy'], queryFn: () => api<Array<{ id: string; nombre: string; apellido: string }>>('/entrenadores/hoy') });
  const [titulo, setTitulo] = useState(rutina?.titulo ?? '');
  const [objetivo, setObjetivo] = useState(rutina?.objetivo ?? '');
  const [entrenadorId, setEntrenadorId] = useState(rutina?.entrenadorId ?? '');
  const [dias, setDias] = useState(rutina?.dias.length ? rutina.dias : [{ nombre: 'Día 1', ejercicios: [ejercicioVacio()] }]);
  const limpios = dias.map((d) => ({ ...d, ejercicios: d.ejercicios.filter((e) => e.nombre.trim()) }));
  const m = useMutation({
    mutationFn: () => {
      const body = { titulo, objetivo: objetivo || null, entrenadorId: entrenadorId || null, dias: limpios };
      return rutina ? api(`/socios/${socioId}/rutinas/${rutina.id}`, { method: 'PUT', body }) : api(`/socios/${socioId}/rutinas`, { body });
    },
    onSuccess: () => (toast.success('Rutina guardada: ya la ve en su enlace'), onDone(), onClose()),
    onError: (e: Error) => toast.error(e.message),
  });
  const setDia = (i: number, d: (typeof dias)[number]) => setDias(dias.map((x, j) => (j === i ? d : x)));

  return (
    <Modal
      title={rutina ? 'Editar rutina' : 'Nueva rutina'}
      size="lg"
      onClose={onClose}
      footer={
        <button className="btn-primary" disabled={titulo.trim().length < 2 || !limpios.length || m.isPending} onClick={() => m.mutate()}>
          Guardar rutina
        </button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nombre">
          <input className="input" value={titulo} maxLength={100} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Tonificación 3 días" autoFocus />
        </Field>
        <Field label="Objetivo (opcional)">
          <input className="input" value={objetivo} maxLength={150} onChange={(e) => setObjetivo(e.target.value)} placeholder="Ej. bajar grasa" />
        </Field>
        <Field label="Entrenador (opcional)">
          <select className="input" value={entrenadorId} onChange={(e) => setEntrenadorId(e.target.value)}>
            <option value="">—</option>
            {(entrenadores ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {`${e.nombre} ${e.apellido}`.trim()}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-5 space-y-4">
        {dias.map((d, i) => (
          <div key={i} className="rounded-2xl border border-white/[0.06] p-4">
            <div className="flex items-center gap-2">
              <input className="input flex-1 font-bold" value={d.nombre} maxLength={80} onChange={(e) => setDia(i, { ...d, nombre: e.target.value })} />
              {dias.length > 1 && (
                <button className="btn-ghost btn-sm" onClick={() => setDias(dias.filter((_, j) => j !== i))} title="Quitar día">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-[1fr_64px_80px_1fr_32px] gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-steel-600">
                <span>Ejercicio</span>
                <span>Series</span>
                <span>Reps</span>
                <span>Nota</span>
                <span />
              </div>
              {d.ejercicios.map((e, k) => {
                const setE = (x: Partial<Ejercicio>) => setDia(i, { ...d, ejercicios: d.ejercicios.map((y, j) => (j === k ? { ...y, ...x } : y)) });
                return (
                  <div key={k} className="grid grid-cols-[1fr_64px_80px_1fr_32px] gap-2">
                    <input className="input py-2 text-sm" value={e.nombre} maxLength={80} onChange={(ev) => setE({ nombre: ev.target.value })} placeholder="Sentadilla" />
                    <input className="input py-2 text-center text-sm" value={e.series} maxLength={10} onChange={(ev) => setE({ series: ev.target.value })} placeholder="4" />
                    <input className="input py-2 text-center text-sm" value={e.reps} maxLength={20} onChange={(ev) => setE({ reps: ev.target.value })} placeholder="12" />
                    <input className="input py-2 text-sm" value={e.nota} maxLength={120} onChange={(ev) => setE({ nota: ev.target.value })} placeholder="descanso 60 s" />
                    <button className="text-steel-500 hover:text-bad" onClick={() => setDia(i, { ...d, ejercicios: d.ejercicios.filter((_, j) => j !== k) })} title="Quitar">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
              <button className="text-xs font-bold text-flame-400 hover:text-flame-300" onClick={() => setDia(i, { ...d, ejercicios: [...d.ejercicios, ejercicioVacio()] })}>
                + Ejercicio
              </button>
            </div>
          </div>
        ))}
        {dias.length < 7 && (
          <button className="btn-ghost btn-sm" onClick={() => setDias([...dias, { nombre: `Día ${dias.length + 1}`, ejercicios: [ejercicioVacio()] }])}>
            <Plus className="h-4 w-4" /> Agregar día
          </button>
        )}
      </div>
    </Modal>
  );
}
