import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Delete, DoorClosed, DoorOpen, FileText, LogIn, LogOut, Undo2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { API, api, session } from '../lib/api';
import { hora } from '../lib/format';
import type { EntrenadorHoy, TipoMarcacion } from '../lib/types';
import { FotoCaptura } from './FotoCaptura';
import { cx, Field, Modal, Tabs } from './ui';

export const fotoEntrenadorUrl = (id: string) => `${API}/entrenadores/${id}/foto?t=${encodeURIComponent(session.token ?? '')}`;

export function EntrenadorAvatar({ e, size = 56 }: { e: { id: string; nombre: string; apellido?: string; tieneFoto: boolean }; size?: number }) {
  const [error, setError] = useState(false);
  const ini = `${e.nombre[0] ?? ''}${e.apellido?.[0] ?? ''}`.toUpperCase();
  return (
    <div className="shrink-0 overflow-hidden rounded-2xl bg-ink-700" style={{ width: size, height: size }}>
      {e.tieneFoto && !error ? (
        <img src={fotoEntrenadorUrl(e.id)} alt="" className="h-full w-full object-cover" onError={() => setError(true)} />
      ) : (
        <div className="grid h-full w-full place-items-center font-display font-extrabold text-steel-300" style={{ fontSize: size * 0.34 }}>
          {ini}
        </div>
      )}
    </div>
  );
}

export const ACCIONES: Record<TipoMarcacion, { label: string; icon: ReactNode; clase: string }> = {
  entrada: { label: 'Marcar entrada', icon: <LogIn className="h-6 w-6" />, clase: 'bg-ok text-ink-950' },
  salida: { label: 'Marcar salida', icon: <LogOut className="h-6 w-6" />, clase: 'bg-steel-200 text-ink-950' },
  retiro: { label: 'Retiro (salgo un momento)', icon: <DoorOpen className="h-6 w-6" />, clase: 'bg-warn text-ink-950' },
  regreso: { label: 'Regreso del retiro', icon: <Undo2 className="h-6 w-6" />, clase: 'bg-sky-300 text-ink-950' },
};

export function EstadoEntrenador({ e }: { e: EntrenadorHoy }) {
  if (e.permiso) return <span className="chip border-sky-400/30 bg-sky-400/10 text-sky-300">Permiso: {e.permiso.tipo}</span>;
  if (e.estado === 'presente') return <span className="chip border-ok/30 bg-ok/10 text-ok">En el gym{e.entrada ? ` · ${hora(e.entrada)}` : ''}</span>;
  if (e.estado === 'retirado') return <span className="chip border-warn/30 bg-warn/10 text-warn">En retiro</span>;
  if (e.estado === 'salio') return <span className="chip border-white/10 text-steel-400">Ya salió</span>;
  if (e.ausente) return <span className="chip border-bad/30 bg-bad/10 text-bad">No ha llegado</span>;
  return <span className="chip border-white/10 text-steel-500">Fuera</span>;
}

const horas = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);

export function TarjetaEntrenador({ e, onClick }: { e: EntrenadorHoy; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={!onClick} className={cx('plate p-4 pt-6 text-left transition', onClick && 'card-hover', e.estado === 'presente' && 'border-ok/25')}>
      <div className="flex items-center gap-4">
        <EntrenadorAvatar e={e} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-extrabold text-white">
            {e.nombre} {e.apellido}
          </p>
          <p className="truncate text-xs text-steel-500">{e.especialidad ?? 'Entrenador'}</p>
          <div className="mt-1.5">
            <EstadoEntrenador e={e} />
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-steel-400">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" /> {e.horarioHoy ? `${e.horarioHoy.entrada} – ${e.horarioHoy.salida}` : 'Libre hoy'}
        </span>
        {e.minutosHoy > 0 && <span>Hoy: {horas(e.minutosHoy)}</span>}
        {(e.minutosTarde ?? 0) > 5 && <span className="text-warn">Llegó {e.minutosTarde} min tarde</span>}
      </div>
    </button>
  );
}

/** Teclado de PIN táctil. */
function PinPad({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="mb-4 flex justify-center gap-3">
        {Array.from({ length: Math.max(4, valor.length) }).map((_, i) => (
          <span key={i} className={cx('h-4 w-4 rounded-full', i < valor.length ? 'bg-flame-500' : 'bg-white/10')} />
        ))}
      </div>
      <div className="mx-auto grid max-w-[280px] grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k) =>
          k === '' ? (
            <span key="v" />
          ) : (
            <button
              key={k}
              type="button"
              onClick={() => onChange(k === '⌫' ? valor.slice(0, -1) : valor.length < 6 ? valor + k : valor)}
              className="grid h-16 place-items-center rounded-2xl bg-white/[0.05] font-wide text-2xl text-white transition hover:bg-white/10 active:scale-95"
            >
              {k === '⌫' ? <Delete className="h-6 w-6" /> : k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

/** Marcación: acción → PIN → foto (obligatoria) → listo. */
export function MarcarModal({ e, onClose }: { e: EntrenadorHoy; onClose: () => void }) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<TipoMarcacion | null>(e.siguientes.length === 1 ? e.siguientes[0]! : null);
  const [paso, setPaso] = useState<'accion' | 'pin' | 'foto' | 'listo'>(e.siguientes.length === 1 ? 'pin' : 'accion');
  const [pin, setPin] = useState('');
  const [nota, setNota] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ minutosTarde: number | null; hora: string } | null>(null);
  const m = useMutation({
    mutationFn: () => api<{ minutosTarde: number | null; marcacion: { fechaHora: string } }>('/entrenadores/marcar', { body: { entrenadorId: e.id, pin, tipo, foto, nota: nota || null } }),
    onSuccess: (r) => {
      setResultado({ minutosTarde: r.minutosTarde, hora: r.marcacion.fechaHora });
      setPaso('listo');
      void qc.invalidateQueries({ queryKey: ['entrenadores-hoy'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
      if (/PIN/i.test(err.message)) {
        setPin('');
        setPaso('pin');
      }
    },
  });
  return (
    <Modal title={`${e.nombre} ${e.apellido}`} onClose={onClose}>
      {paso === 'accion' && (
        <div className="space-y-3">
          <p className="text-center text-sm text-steel-400">¿Qué vas a marcar?</p>
          {e.siguientes.map((t) => (
            <button key={t} onClick={() => (setTipo(t), setPaso('pin'))} className={cx('flex h-16 w-full items-center justify-center gap-3 rounded-2xl text-lg font-extrabold transition active:scale-[0.98]', ACCIONES[t].clase)}>
              {ACCIONES[t].icon} {ACCIONES[t].label}
            </button>
          ))}
        </div>
      )}
      {paso === 'pin' && tipo && (
        <div>
          <p className="mb-4 text-center font-display text-lg font-extrabold text-white">{ACCIONES[tipo].label}</p>
          <p className="mb-4 text-center text-sm text-steel-400">Escribe tu PIN</p>
          <PinPad valor={pin} onChange={setPin} />
          <button className="btn-primary btn-xl mt-6 w-full" disabled={pin.length < 4} onClick={() => setPaso('foto')}>
            Continuar
          </button>
        </div>
      )}
      {paso === 'foto' && tipo && (
        <div>
          <p className="mb-3 text-center text-sm text-steel-400">Foto obligatoria: párate frente al lector y deja que tome tu foto</p>
          <FotoCaptura value={foto} onChange={setFoto} />
          {tipo === 'retiro' && (
            <Field label="¿Por qué te retiras?" className="mt-4">
              <input className="input" value={nota} onChange={(ev) => setNota(ev.target.value)} placeholder="Cita médica, diligencia, almuerzo…" />
            </Field>
          )}
          <button className="btn-primary btn-xl mt-5 w-full" disabled={!foto || m.isPending || (tipo === 'retiro' && nota.trim().length < 3)} onClick={() => m.mutate()}>
            {m.isPending ? 'Registrando…' : `Confirmar ${tipo}`}
          </button>
        </div>
      )}
      {paso === 'listo' && tipo && resultado && (
        <div className="py-4 text-center">
          <div className={cx('mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl', ACCIONES[tipo].clase)}>{ACCIONES[tipo].icon}</div>
          <p className="font-wide text-2xl text-white">{tipo === 'entrada' ? '¡Buen turno!' : tipo === 'salida' ? '¡Hasta mañana!' : tipo === 'retiro' ? 'Retiro registrado' : '¡De vuelta!'}</p>
          <p className="mt-1 text-steel-400">
            {tipo} a las {hora(resultado.hora)}
          </p>
          {resultado.minutosTarde !== null && resultado.minutosTarde > 5 && <p className="mt-2 text-warn">Llegaste {resultado.minutosTarde} minutos tarde</p>}
          {resultado.minutosTarde !== null && resultado.minutosTarde < -5 && <p className="mt-2 text-warn">Saliste {-resultado.minutosTarde} minutos antes de tu hora</p>}
          <button className="btn-primary mt-6" onClick={onClose}>
            Listo
          </button>
        </div>
      )}
    </Modal>
  );
}

const ahoraLocal = (horas = 0) => {
  const d = new Date(Date.now() + horas * 3600_000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export function PermisoModal({ entrenadores, onClose }: { entrenadores: EntrenadorHoy[]; onClose: () => void }) {
  const [id, setId] = useState(entrenadores[0]?.id ?? '');
  const [tipo, setTipo] = useState<'permiso' | 'diligencia' | 'reposo' | 'vacaciones' | 'otro'>('permiso');
  const [desde, setDesde] = useState(ahoraLocal(1));
  const [hasta, setHasta] = useState(ahoraLocal(5));
  const [motivo, setMotivo] = useState('');
  const [pin, setPin] = useState('');
  const [soporte, setSoporte] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => api('/entrenadores/permisos/solicitar', { body: { entrenadorId: id, pin, tipo, desde, hasta, motivo, soporte } }),
    onSuccess: () => (toast.success('Permiso solicitado: queda pendiente de aprobación'), onClose()),
    onError: (e: Error) => toast.error(e.message),
  });
  const subir = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setSoporte(String(r.result));
    r.readAsDataURL(f);
  };
  return (
    <Modal
      title="Solicitar permiso"
      onClose={onClose}
      footer={
        <button className="btn-primary" disabled={!id || pin.length < 4 || motivo.trim().length < 5 || m.isPending} onClick={() => m.mutate()}>
          Enviar solicitud
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Entrenador" className="col-span-2">
          <select className="input" value={id} onChange={(e) => setId(e.target.value)}>
            {entrenadores.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre} {e.apellido}
              </option>
            ))}
          </select>
        </Field>
        <div className="col-span-2">
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
        <Field label="Desde">
          <input type="datetime-local" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </Field>
        <Field label="Hasta">
          <input type="datetime-local" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </Field>
        <Field label="Motivo" className="col-span-2">
          <textarea className="input" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Field>
        <Field label="Soporte (récipe, constancia…)">
          <label className="btn-ghost w-full cursor-pointer">
            <FileText className="h-4 w-4" /> {soporte ? 'Cambiar' : 'Adjuntar'}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => subir(e.target.files?.[0])} />
          </label>
        </Field>
        <Field label="PIN del entrenador">
          <input className="input tnum text-center text-lg tracking-[0.5em]" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        </Field>
      </div>
    </Modal>
  );
}

export { DoorClosed };
