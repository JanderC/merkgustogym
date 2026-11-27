/**
 * Ajustes que NO pasan por caja:
 *  • Asignar un personalizado: buscar al cliente, elegir entrenador y cobrarlo en caja
 *    (o, solo administración, registrarlo sin cobro con sus fechas).
 *  • Editar una membresía o un personalizado (fechas / plan): solo dueño y administración.
 * Nada de esto crea ventas ni cambia los totales de la caja; todo queda en la auditoría.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, CalendarRange, Check, Lock, ShoppingCart, UserCheck, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fecha, finPlan, hoyISO } from '../lib/format';
import { useCatalogo } from '../lib/hooks';
import { fmt } from '../lib/monedas';
import type { MembresiaCliente, PersonalizadoSocio, Plan, SocioLista } from '../lib/types';
import { EntrenadorAvatar } from './entrenadores';
import { SocioPicker } from './socios';
import { Avatar, cx, Field, Modal } from './ui';

export const useEsGestion = () => {
  const { user } = useAuth();
  return user?.rol === 'dueno' || user?.rol === 'admin_caja';
};

const diasEntre = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000) + 1;

function AvisoSinCaja({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex gap-2.5 rounded-xl border border-sky-400/25 bg-sky-400/[0.06] p-3 text-sm text-sky-100">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
      <p>{children ?? 'Esto no pasa por caja: no se cobra nada ni cambia el cierre. Queda registrado en la auditoría con tu nombre.'}</p>
    </div>
  );
}

function Fechas({ inicio, fin, setInicio, setFin }: { inicio: string; fin: string; setInicio: (s: string) => void; setFin: (s: string) => void }) {
  const ok = !!inicio && !!fin && fin >= inicio;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Desde">
          <input type="date" className="input" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </Field>
        <Field label="Vence el">
          <input type="date" className="input" value={fin} min={inicio} onChange={(e) => setFin(e.target.value)} />
        </Field>
      </div>
      <p className={cx('mt-2 text-xs', ok ? 'text-steel-400' : 'text-bad')}>
        {ok ? `${diasEntre(inicio, fin)} día(s): del ${fecha(inicio)} al ${fecha(fin)}` : 'El vencimiento no puede ser antes del inicio'}
      </p>
    </>
  );
}

// ═════════════ Editar membresía ═════════════

export function EditarMembresiaModal({ socioId, m, onClose, onDone }: { socioId: string; m: MembresiaCliente; onClose: () => void; onDone: () => void }) {
  const [inicio, setInicio] = useState(m.fechaInicio.slice(0, 10));
  const [fin, setFin] = useState(m.fechaFin.slice(0, 10));
  const [planId, setPlanId] = useState(m.planId);
  const [motivo, setMotivo] = useState('');
  const planes = useQuery({ queryKey: ['planes'], queryFn: () => api<Plan[]>('/planes') });
  const actual = planes.data?.find((p) => p.id === m.planId);
  const opciones = (planes.data ?? []).filter((p) => p.id === m.planId || (p.activo !== false && (!actual || p.personas === actual.personas)));
  const elegido = planes.data?.find((p) => p.id === planId);
  const cambio = inicio !== m.fechaInicio.slice(0, 10) || fin !== m.fechaFin.slice(0, 10) || planId !== m.planId;
  const g = useMutation({
    mutationFn: () => api(`/socios/${socioId}/membresias/${m.id}`, { method: 'PUT', body: { fechaInicio: inicio, fechaFin: fin, planId, motivo } }),
    onSuccess: () => (toast.success('Membresía actualizada. El lector ya recibe la nueva fecha.'), onDone(), onClose()),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal
      title="Editar membresía"
      size="sm"
      onClose={onClose}
      footer={
        <button className="btn-primary" disabled={!cambio || fin < inicio || motivo.trim().length < 3 || g.isPending} onClick={() => g.mutate()}>
          <Check className="h-4 w-4" /> {g.isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      }
    >
      <AvisoSinCaja />
      <div className="grid gap-4">
        <Field label="Plan" hint={planId !== m.planId ? 'Solo cambia el nombre del plan: el precio que pagó queda igual.' : undefined}>
          <select className="input" value={planId} onChange={(e) => setPlanId(Number(e.target.value))}>
            {opciones.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
                {p.id === m.planId ? ' (actual)' : ''}
              </option>
            ))}
            {!opciones.length && <option value={m.planId}>{m.plan}</option>}
          </select>
        </Field>
        <div>
          <Fechas inicio={inicio} fin={fin} setInicio={setInicio} setFin={setFin} />
          {elegido && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button type="button" className="chip border-white/10 text-steel-300 hover:border-flame-500/40" onClick={() => setFin(finPlan(elegido, inicio))}>
                Calcular vencimiento ({elegido.duracion ?? elegido.nombre})
              </button>
              <button type="button" className="chip border-white/10 text-steel-300 hover:border-flame-500/40" onClick={() => setInicio(hoyISO())}>
                Empezar hoy
              </button>
            </div>
          )}
        </div>
        <Field label="Motivo del cambio">
          <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. se inscribió el lunes, pagó antes del sistema…" />
        </Field>
      </div>
    </Modal>
  );
}

// ═════════════ Editar fechas de un personalizado ═════════════

export function EditarPersonalizadoModal({ p, onClose, onDone }: { p: PersonalizadoSocio; onClose: () => void; onDone: () => void }) {
  const u = p.ultimo!;
  const [inicio, setInicio] = useState(u.fechaInicio.slice(0, 10));
  const [fin, setFin] = useState(u.fechaFin.slice(0, 10));
  const [motivo, setMotivo] = useState('');
  const g = useMutation({
    mutationFn: () => api(`/personalizados/${u.id}`, { method: 'PUT', body: { fechaInicio: inicio, fechaFin: fin, motivo } }),
    onSuccess: () => (toast.success('Fechas del personalizado actualizadas'), onDone(), onClose()),
    onError: (e: Error) => toast.error(e.message),
  });
  const cambio = inicio !== u.fechaInicio.slice(0, 10) || fin !== u.fechaFin.slice(0, 10);
  return (
    <Modal
      title={`Personalizado con ${p.entrenador}`}
      size="sm"
      onClose={onClose}
      footer={
        <button className="btn-primary" disabled={!cambio || fin < inicio || motivo.trim().length < 3 || g.isPending} onClick={() => g.mutate()}>
          <Check className="h-4 w-4" /> Guardar fechas
        </button>
      }
    >
      <AvisoSinCaja>Solo cambian las fechas del último periodo. Lo cobrado y lo que le toca al entrenador quedan igual. Queda en la auditoría.</AvisoSinCaja>
      <div className="grid gap-4">
        <Fechas inicio={inicio} fin={fin} setInicio={setInicio} setFin={setFin} />
        <Field label="Motivo del cambio">
          <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. empezó una semana después" />
        </Field>
      </div>
    </Modal>
  );
}

// ═════════════ Asignar personalizado ═════════════

type Modo = 'cobrar' | 'sin_cobro';

export function AsignarPersonalizadoModal({ socioInicial, onClose }: { socioInicial?: { id: string; nombre: string; tieneFoto: boolean; codigo?: number }; onClose: () => void }) {
  const gestion = useEsGestion();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: cat } = useCatalogo();
  const [socio, setSocio] = useState(socioInicial ?? null);
  const [ent, setEnt] = useState<string | null>(null);
  const [modo, setModo] = useState<Modo>('cobrar');
  const [inicio, setInicio] = useState(hoyISO());
  const [fin, setFin] = useState(finPlan({ tipoDuracion: 'meses', cantidad: 1 }, hoyISO()));
  const [motivo, setMotivo] = useState('');
  const entrenadores = cat?.entrenadores ?? [];
  const e = entrenadores.find((x) => x.id === ent);

  const refrescar = () => {
    void qc.invalidateQueries({ queryKey: ['personalizados'] });
    if (socio) void qc.invalidateQueries({ queryKey: ['socio', socio.id] });
  };
  const soloAsignar = useMutation({
    mutationFn: () => api(`/socios/${socio!.id}/entrenador`, { method: 'PUT', body: { entrenadorId: ent } }),
    onSuccess: () => (toast.success(`${socio!.nombre} quedó con ${e?.nombre}. Ya aparece en su app y en "Sin pagar".`), refrescar(), onClose()),
    onError: (er: Error) => toast.error(er.message),
  });
  const sinCobro = useMutation({
    mutationFn: () => api('/personalizados/sin-cobro', { body: { socioId: socio!.id, entrenadorId: ent, fechaInicio: inicio, fechaFin: fin, motivo } }),
    onSuccess: () => (toast.success(`Personalizado registrado sin cobro hasta el ${fecha(fin)}`), refrescar(), onClose()),
    onError: (er: Error) => toast.error(er.message),
  });

  const listo = !!socio && !!ent;
  const footer =
    modo === 'cobrar' ? (
      <>
        <button className="btn-ghost" disabled={!listo || soloAsignar.isPending} onClick={() => soloAsignar.mutate()} title="Queda como su cliente; se cobra después">
          <UserCheck className="h-4 w-4" /> Solo asignar
        </button>
        <button className="btn-primary" disabled={!listo} onClick={() => (onClose(), nav(`/mostrador?cliente=${socio!.id}&personalizado=${ent}`))}>
          <ShoppingCart className="h-4 w-4" /> Ir a cobrar
        </button>
      </>
    ) : (
      <button className="btn-primary" disabled={!listo || fin < inicio || motivo.trim().length < 3 || sinCobro.isPending} onClick={() => sinCobro.mutate()}>
        <Check className="h-4 w-4" /> Registrar sin cobro
      </button>
    );

  return (
    <Modal title="Asignar personalizado" onClose={onClose} footer={footer}>
      <div className="grid gap-5">
        <div>
          <span className="label">1 · Cliente</span>
          {socio ? (
            <div className="flex items-center gap-3 rounded-2xl border border-flame-500/30 bg-flame-500/[0.05] p-3">
              <Avatar socioId={socio.id} nombre={socio.nombre} tieneFoto={socio.tieneFoto} size={40} />
              <p className="flex-1 font-bold text-steel-100">
                {socio.nombre} {socio.codigo !== undefined && <span className="text-xs font-normal text-steel-500">#{socio.codigo}</span>}
              </p>
              {!socioInicial && (
                <button className="btn-ghost btn-sm" onClick={() => setSocio(null)} title="Cambiar de cliente">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : (
            <SocioPicker autoFocus placeholder="Buscar por nombre, cédula, teléfono o código…" onPick={(s: SocioLista) => setSocio({ id: s.id, nombre: `${s.nombre} ${s.apellido}`.trim(), tieneFoto: s.tieneFoto, codigo: s.codigo })} />
          )}
        </div>

        <div>
          <span className="label">2 · Entrenador</span>
          {entrenadores.length === 0 ? (
            <p className="rounded-xl border border-warn/25 bg-warn/[0.06] p-3 text-sm text-warn">
              Ningún entrenador tiene precio de personalizado. El dueño lo pone en Panel › Entrenadores › editar (lápiz) › “Da entrenamiento personalizado”.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {entrenadores.map((x) => (
                <button
                  key={x.id}
                  onClick={() => setEnt(x.id)}
                  className={cx('flex items-center gap-3 rounded-2xl border p-3 text-left transition', ent === x.id ? 'border-flame-500/60 bg-flame-500/[0.08] ring-2 ring-flame-500/25' : 'border-white/[0.07] hover:border-white/15')}
                >
                  <EntrenadorAvatar e={x} size={38} />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-steel-100">{x.nombre}</p>
                    <p className="truncate text-xs text-steel-500">
                      {fmt(x.mensual, x.moneda)} al mes{x.semanal ? ` · ${fmt(x.semanal, x.moneda)} sem.` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {gestion && (
          <div>
            <span className="label">3 · ¿Cómo?</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  { v: 'cobrar', t: 'Cobrar en caja', d: 'Lo normal: se cobra y suma a la caja', icon: ShoppingCart },
                  { v: 'sin_cobro', t: 'Sin cobro', d: 'Ya pagó antes, cortesía o corrección', icon: CalendarRange },
                ] as const
              ).map((o) => (
                <button
                  key={o.v}
                  onClick={() => setModo(o.v)}
                  className={cx('flex items-start gap-2.5 rounded-2xl border p-3 text-left transition', modo === o.v ? 'border-flame-500/60 bg-flame-500/[0.08]' : 'border-white/[0.07] hover:border-white/15')}
                >
                  <o.icon className={cx('mt-0.5 h-4 w-4', modo === o.v ? 'text-flame-400' : 'text-steel-500')} />
                  <div>
                    <p className="text-sm font-bold text-steel-100">{o.t}</p>
                    <p className="text-xs text-steel-500">{o.d}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {modo === 'sin_cobro' && gestion && (
          <div>
            <AvisoSinCaja>No suma a la caja ni le genera pago al entrenador. Queda registrado en la auditoría con tu nombre.</AvisoSinCaja>
            <Fechas inicio={inicio} fin={fin} setInicio={setInicio} setFin={setFin} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                ['1 semana', { tipoDuracion: 'semanas', cantidad: 1 }],
                ['1 mes', { tipoDuracion: 'meses', cantidad: 1 }],
                ['3 meses', { tipoDuracion: 'meses', cantidad: 3 }],
              ].map(([l, d]) => (
                <button key={l as string} type="button" className="chip border-white/10 text-steel-300 hover:border-flame-500/40" onClick={() => setFin(finPlan(d as Parameters<typeof finPlan>[0], inicio))}>
                  {l as string}
                </button>
              ))}
            </div>
            <Field label="Motivo" className="mt-4">
              <input className="input" value={motivo} onChange={(ev) => setMotivo(ev.target.value)} placeholder="Ej. pagó en efectivo al entrenador antes del sistema" />
            </Field>
          </div>
        )}

        {modo === 'cobrar' && listo && (
          <p className="flex items-center gap-2 text-sm text-steel-400">
            <Award className="h-4 w-4 text-flame-400" />
            <span>
              <b className="text-steel-200">Ir a cobrar</b> abre la caja con el personalizado ya puesto. <b className="text-steel-200">Solo asignar</b> lo deja como su cliente (aparece en “Sin pagar”).
            </span>
          </p>
        )}
      </div>
    </Modal>
  );
}
