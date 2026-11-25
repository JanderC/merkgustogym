/**
 * Alta guiada de cliente en un solo flujo:
 *   1. Datos  →  2. Rostro (para el lector)  →  3. Plan  →  4. Cobro  →  ✓ Listo
 * El cliente se crea al confirmar el rostro; la membresía nace al registrar el
 * pago (queda en el turno de la cajera). La pantalla final muestra en vivo
 * cuándo el lector ya tiene su rostro y su vigencia.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, Loader2, Power, ScanFace, TriangleAlert, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { fecha, fechaDia, finPlan, hoyISO, sumarDias } from '../lib/format';
import type { Moneda } from '../lib/monedas';
import { useCatalogo, useTurno } from '../lib/hooks';
import type { Plan, SocioDetalle } from '../lib/types';
import { FotoCaptura } from './FotoCaptura';
import { PanelPago, Precio, type PagoPayload } from './PanelPago';
import { SocioPicker } from './socios';
import { Avatar, cx, Field, Modal } from './ui';

const PASOS = ['Datos', 'Plan', 'Rostro', 'Cobro'] as const;

interface Datos {
  nombre: string;
  apellido: string;
  cedula: string;
  telefono: string;
  fechaNacimiento: string;
  genero: '' | 'M' | 'F' | 'O';
  notas: string;
}

export interface VentaHecha {
  numero: number;
  totales: Record<Moneda, number>;
  vuelto: { texto: string } | null;
  deuda: { id: number; saldo: number; texto: string } | null;
  items: Array<{ descripcion: string; cantidad: number; precio: string }>;
  membresias: Array<{ plan: string; fechaInicio: string; fechaFin: string; personas: number }>;
  personalizados?: Array<{ entrenador: string; fechaInicio: string; fechaFin: string }>;
}

// ── Registro rápido: cédula, nombre y teléfono obligatorios ──────────
const digitos = (s: string) => s.replace(/\D/g, '').length;
export const cedulaOk = (s: string) => digitos(s) >= 5;
export const telefonoOk = (s: string) => digitos(s) >= 7 && digitos(s) <= 15;
export const datosOk = (d: { cedula: string; nombre: string; telefono: string }) => cedulaOk(d.cedula) && d.nombre.trim().length >= 2 && telefonoOk(d.telefono);

type DatosBase = Datos & { email?: string };

/** Campos del cliente: arriba lo obligatorio, lo opcional plegado. */
export function DatosRapidos<T extends DatosBase>({ d, set, conEmail, autoFocus = true }: { d: T; set: <K extends keyof T>(k: K, v: T[K]) => void; conEmail?: boolean; autoFocus?: boolean }) {
  const [mas, setMas] = useState(!!(d.apellido || d.fechaNacimiento || d.genero || d.notas || d.email));
  const [tocado, setTocado] = useState<Record<string, boolean>>({});
  const t = (k: string) => () => setTocado((p) => ({ ...p, [k]: true }));
  const err = (k: string, ok: boolean, msg: string) => (tocado[k] && !ok ? <p className="mt-1 text-xs text-bad">{msg}</p> : null);
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Cédula *">
          <input className={cx('input tnum text-lg', tocado.cedula && !cedulaOk(d.cedula) && 'border-bad/60')} autoFocus={autoFocus} value={d.cedula} onBlur={t('cedula')} onChange={(e) => set('cedula', e.target.value as T['cedula'])} placeholder="V-12345678" inputMode="text" />
          {err('cedula', cedulaOk(d.cedula), 'Escribe la cédula')}
        </Field>
        <Field label="Nombre *">
          <input className={cx('input text-lg', tocado.nombre && d.nombre.trim().length < 2 && 'border-bad/60')} value={d.nombre} onBlur={t('nombre')} onChange={(e) => set('nombre', e.target.value as T['nombre'])} placeholder="Nombre y apellido" />
          {err('nombre', d.nombre.trim().length >= 2, 'Escribe el nombre')}
        </Field>
        <Field label="Teléfono / WhatsApp *">
          <input className={cx('input tnum text-lg', tocado.telefono && !telefonoOk(d.telefono) && 'border-bad/60')} value={d.telefono} onBlur={t('telefono')} onChange={(e) => set('telefono', e.target.value as T['telefono'])} placeholder="0414-1234567" inputMode="tel" />
          {err('telefono', telefonoOk(d.telefono), 'Escribe un teléfono válido')}
        </Field>
      </div>
      <button type="button" className="mt-4 text-sm font-bold text-steel-400 hover:text-white" onClick={() => setMas((v) => !v)}>
        {mas ? '− Ocultar datos opcionales' : '+ Más datos (opcional): apellido, nacimiento, género, notas'}
      </button>
      {mas && (
        <div className="mt-3 grid grid-cols-2 gap-4 rounded-2xl border border-white/[0.06] p-4">
          <Field label="Apellido">
            <input className="input" value={d.apellido} onChange={(e) => set('apellido', e.target.value as T['apellido'])} />
          </Field>
          <Field label="Nacimiento">
            <input className="input" type="date" value={d.fechaNacimiento} onChange={(e) => set('fechaNacimiento', e.target.value as T['fechaNacimiento'])} />
          </Field>
          <Field label="Género">
            <select className="input" value={d.genero} onChange={(e) => set('genero', e.target.value as T['genero'])}>
              <option value="">—</option>
              <option value="F">Femenino</option>
              <option value="M">Masculino</option>
              <option value="O">Otro</option>
            </select>
          </Field>
          {conEmail && (
            <Field label="Correo">
              <input className="input" type="email" value={d.email ?? ''} onChange={(e) => set('email', e.target.value as T['email'])} />
            </Field>
          )}
          <Field label="Notas (lesiones, objetivos…)" className="col-span-2">
            <input className="input" value={d.notas} onChange={(e) => set('notas', e.target.value as T['notas'])} />
          </Field>
        </div>
      )}
    </div>
  );
}

/**
 * Enter funciona como Tab: salta al siguiente campo del formulario. En el
 * último campo deja que Enter envíe (pasa al siguiente paso si está completo).
 */
function enterComoTab(e: React.KeyboardEvent<HTMLFormElement>) {
  const el = e.target as HTMLElement;
  if (e.key !== 'Enter' || e.shiftKey || !(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return;
  const campos = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('input:not([type=hidden]):not(:disabled), select:not(:disabled)'));
  const sig = campos[campos.indexOf(el) + 1];
  if (!sig) return; // último campo: Enter envía el formulario
  e.preventDefault();
  sig.focus();
  if (sig instanceof HTMLInputElement) sig.select();
}

export function ClienteNuevo({ onClose, nombreInicial = '' }: { onClose: () => void; nombreInicial?: string }) {
  const qc = useQueryClient();
  const { data: cat } = useCatalogo();
  const { data: turno } = useTurno();
  const [paso, setPaso] = useState(0);
  const [d, setD] = useState<Datos>({
    nombre: /^[\d\s-]+$/.test(nombreInicial) ? '' : nombreInicial,
    apellido: '',
    cedula: /^[\d\s-]+$/.test(nombreInicial) ? nombreInicial : '',
    telefono: '',
    fechaNacimiento: '',
    genero: '',
    notas: '',
  });
  const [foto, setFoto] = useState<string | null>(null);
  const [sinFoto, setSinFoto] = useState(false);
  const [cliente, setCliente] = useState<{ id: string; codigo: number } | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  // Si se inscribió días antes, la mensualidad cuenta desde ese día
  const [inicio, setInicio] = useState(hoyISO());
  const [acomp, setAcomp] = useState<Array<{ id: string; nombre: string }>>([]);
  const [venta, setVenta] = useState<VentaHecha | null>(null);
  const set = <K extends keyof Datos>(k: K, v: Datos[K]) => setD((p) => ({ ...p, [k]: v }));

  // Crea (o actualiza si vuelve atrás) al cliente con su foto
  const guardar = useMutation({
    mutationFn: () => {
      const body = { ...d, genero: d.genero || null, cedula: d.cedula || null, fechaNacimiento: d.fechaNacimiento || null, foto };
      return cliente ? api<{ id: string; codigo: number }>(`/socios/${cliente.id}`, { method: 'PUT', body }) : api<{ id: string; codigo: number }>('/socios', { body });
    },
    onSuccess: (s) => {
      setCliente({ id: s.id, codigo: s.codigo });
      void qc.invalidateQueries({ queryKey: ['socios'] });
      setPaso(3); // cobro (o "listo" si no eligió plan)
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setPaso(0);
    },
  });

  const abrirTurno = useMutation({
    mutationFn: () => api('/pos/turno/abrir', { body: {} }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['turno'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const cobrar = useMutation({
    mutationFn: (p: PagoPayload) => api<VentaHecha>('/pos/ventas', { body: { socioId: cliente!.id, items: [{ tipo: 'membresia', id: plan!.id, acompanantes: acomp.map((a) => a.id), ...(inicio !== hoyISO() && { inicio }) }], ...p } }),
    onSuccess: (v) => {
      setVenta(v);
      ['turno', 'socios', 'socio', 'catalogo'].forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nombreCompleto = `${d.nombre} ${d.apellido}`.trim();
  const terminado = venta || (paso === 3 && !plan);

  return (
    <Modal title={terminado ? 'Cliente listo' : cliente ? `Nuevo cliente · #${cliente.codigo}` : 'Nuevo cliente'} onClose={onClose} size="lg">
      {/* Pasos */}
      {!terminado && (
        <div className="mb-6 grid grid-cols-4 gap-2">
          {PASOS.map((p, i) => (
            <div key={p}>
              <div className={cx('h-1.5 rounded-full transition', i <= paso ? 'bg-flame-500' : 'bg-white/[0.07]')} />
              <p className={cx('mt-1.5 text-[11px] font-bold uppercase tracking-wider', i === paso ? 'text-flame-400' : i < paso ? 'text-steel-300' : 'text-steel-600')}>
                {i + 1}. {p}
              </p>
            </div>
          ))}
        </div>
      )}

      {paso === 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (datosOk(d)) setPaso(1);
          }}
          onKeyDown={enterComoTab}
        >
          <DatosRapidos d={d} set={set} />
          <div className="mt-6 flex items-center justify-between gap-3">
            <p className="text-xs text-steel-500">* Obligatorio. Lo demás puedes completarlo después.</p>
            <button type="submit" className="btn-primary" disabled={!datosOk(d)}>
              Siguiente: plan <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}

      {paso === 2 && (
        <div>
          <div className="grid items-center gap-6 md:grid-cols-[1fr_1fr]">
            <FotoCaptura value={foto} onChange={(v) => (setFoto(v), v && setSinFoto(false))} />
            <div className="space-y-3 text-sm text-steel-400">
              <p className="flex items-center gap-2 font-display text-lg font-extrabold text-white">
                <ScanFace className="h-5 w-5 text-flame-500" /> Rostro para el lector
              </p>
              <p>El lector toma la foto y con ella lo reconoce en la puerta. Su plan {plan?.nombre ?? ''} incluye acceso por el lector.</p>
              <ul className="space-y-1.5">
                <li>1. Que se pare frente al lector facial</li>
                <li>2. Toca “Tomar foto con el lector”</li>
                <li>3. Que mire directo a la pantalla, sin gorra ni lentes oscuros</li>
              </ul>
              {!foto && (
                <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-xl border border-warn/30 bg-warn/[0.06] p-3 text-xs text-warn">
                  <input type="checkbox" className="mt-0.5 accent-[#FFC542]" checked={sinFoto} onChange={(e) => setSinFoto(e.target.checked)} />
                  Registrar sin foto por ahora (no podrá entrar con el rostro hasta que se la tomen)
                </label>
              )}
            </div>
          </div>
          <div className="mt-6 flex justify-between">
            <button className="btn-ghost" onClick={() => setPaso(1)}>
              <ArrowLeft className="h-4 w-4" /> Plan
            </button>
            <button className="btn-primary" disabled={(!foto && !sinFoto) || guardar.isPending} onClick={() => guardar.mutate()}>
              {guardar.isPending ? 'Guardando…' : plan ? 'Registrar e ir a cobrar' : 'Registrar cliente'} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {paso === 1 && (
        <div>
          <p className="mb-4 text-sm text-steel-400">
            ¿Qué plan quiere <b className="text-steel-100">{d.nombre}</b>? Al pagarlo, el lector le abre la puerta hasta la fecha de vencimiento.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {cat?.planes.map((p) => (
              <button
                key={p.id}
                onClick={() => (setPlan(p), setAcomp([]))}
                className={cx('plate p-4 pt-6 text-left transition', plan?.id === p.id ? 'border-flame-500/70 ring-2 ring-flame-500/40' : 'hover:border-white/20')}
              >
                <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl" style={{ background: p.color }} />
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display text-lg font-extrabold text-white">{p.nombre}</p>
                    <p className="text-xs text-steel-500">
                      {p.duracion}
                      {p.personas > 1 && ` · ${p.personas} personas`}
                      {!p.accesoLector && ' · entra por recepción'}
                    </p>
                  </div>
                  <div className="text-right">
                    <Precio monto={p.precio} moneda={p.moneda} tasas={cat.tasas} />
                  </div>
                </div>
              </button>
            ))}
          </div>
          {plan && plan.personas > 1 && (
            <div className="mt-4 rounded-2xl border border-flame-500/25 bg-flame-500/[0.05] p-4">
              <p className="mb-2 text-sm font-bold text-flame-300">
                {plan.nombre} es para {plan.personas} personas: elige {plan.personas - 1} acompañante(s) ya registrado(s)
              </p>
              {acomp.length < plan.personas - 1 && (
                <SocioPicker
                  placeholder="Buscar acompañante"
                  onPick={(s) => {
                    if (s.id === cliente?.id || acomp.some((a) => a.id === s.id)) return;
                    setAcomp((a) => [...a, { id: s.id, nombre: `${s.nombre} ${s.apellido}`.trim() }]);
                  }}
                />
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {acomp.map((a) => (
                  <button key={a.id} className="chip border-white/15 py-1 text-steel-200" onClick={() => setAcomp((x) => x.filter((y) => y.id !== a.id))}>
                    {a.nombre} ✕
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="mt-6 flex items-center justify-between">
            <button className="btn-ghost" onClick={() => setPaso(0)}>
              <ArrowLeft className="h-4 w-4" /> Datos
            </button>
            <div className="flex gap-2">
              <button className="btn-ghost" disabled={guardar.isPending} onClick={() => (setPlan(null), setAcomp([]), setPaso(2))}>
                Sin plan por ahora
              </button>
              <button
                className="btn-primary"
                disabled={!plan || acomp.length !== plan.personas - 1 || guardar.isPending}
                onClick={() => (plan?.accesoLector ? setPaso(2) : guardar.mutate())}
              >
                {plan && !plan.accesoLector ? 'Registrar e ir a cobrar' : 'Siguiente: rostro'} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {paso === 3 && plan && !venta && (
        <div className="grid gap-6 md:grid-cols-[1fr_1.25fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-4">
              <Avatar nombre={nombreCompleto} socioId={cliente?.id} tieneFoto={!!foto} size={52} ring="flame" />
              <div>
                <p className="font-bold text-white">{nombreCompleto}</p>
                <p className="text-sm text-steel-400">
                  Plan {plan.nombre} · {plan.duracion}
                </p>
                {acomp.length > 0 && <p className="text-xs text-steel-500">+ {acomp.map((a) => a.nombre).join(', ')}</p>}
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.06] p-4">
              <Field label="La mensualidad empieza el" hint={inicio === hoyISO() ? 'Hoy. Si se inscribió días antes, pon ese día.' : `Cuenta desde el ${fecha(inicio)}, no desde hoy.`}>
                <input type="date" className="input" value={inicio} min={sumarDias(hoyISO(), -30)} max={hoyISO()} onChange={(e) => setInicio(e.target.value || hoyISO())} />
              </Field>
              <p className="mt-2 text-sm font-bold text-flame-300">Vence el {fechaDia(finPlan(plan, inicio))}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] p-4">
              <p className="label">Total</p>
              <Precio monto={plan.precio} moneda={plan.moneda} tasas={cat?.tasas} grande />
            </div>
            <button className="btn-ghost btn-sm" onClick={() => setPaso(1)}>
              <ArrowLeft className="h-4 w-4" /> Cambiar plan
            </button>
          </div>
          <div>
            {!turno ? (
              <div className="rounded-2xl border border-warn/30 bg-warn/[0.06] p-5 text-center">
                <p className="font-bold text-warn">Abre tu turno para poder cobrar</p>
                <button className="btn-primary mt-4" disabled={abrirTurno.isPending} onClick={() => abrirTurno.mutate()}>
                  <Power className="h-4 w-4" /> Abrir mi turno
                </button>
              </div>
            ) : (
              cat && (
                <PanelPago
                  lineas={[{ monto: plan.precio, moneda: plan.moneda }]}
                  metodos={cat.metodos}
                  tasas={cat.tasas}
                  permiteParcial
                  cobrando={cobrar.isPending}
                  etiqueta="Cobrar y activar acceso"
                  onCobrar={(p) => cobrar.mutate(p)}
                />
              )
            )}
          </div>
        </div>
      )}

      {terminado && cliente && (
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-ok" />
          <p className="mt-3 font-wide text-2xl text-white">{nombreCompleto}</p>
          <p className="text-steel-400">Cliente #{cliente.codigo}</p>
          {venta?.membresias[0] && (
            <p className="mx-auto mt-4 max-w-md rounded-xl border border-ok/25 bg-ok/[0.07] p-3 text-sm text-ok">
              Plan {plan?.nombre} activo del {fecha(venta.membresias[0].fechaInicio)} al {fechaDia(venta.membresias[0].fechaFin)}
            </p>
          )}
          {venta?.deuda && <p className="mx-auto mt-3 max-w-md rounded-xl border border-warn/30 bg-warn/[0.07] p-3 text-sm text-warn">Quedó debiendo {venta.deuda.texto}</p>}
          {venta?.vuelto && (
            <p className="mx-auto mt-3 max-w-md rounded-xl border border-sky-400/30 bg-sky-400/[0.07] p-3 text-lg font-bold text-sky-300">Entrega de vuelto: {venta.vuelto.texto}</p>
          )}
          {!venta && <p className="mx-auto mt-4 max-w-md rounded-xl bg-white/[0.03] p-3 text-sm text-steel-400">Quedó registrado sin plan. Cuando pague, búscalo en Cobrar.</p>}
          <div className="mx-auto mt-5 max-w-md text-left">
            <EstadoLector socioId={cliente.id} />
          </div>
          <div className="mt-6 flex justify-center gap-2">
            <button className="btn-primary" onClick={onClose}>
              Listo
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/**
 * Estado en vivo del cliente en el lector facial: si tiene rostro, si ya se
 * envió y si su vigencia ya está cargada. Permite tomar la foto si falta.
 */
export function EstadoLector({ socioId }: { socioId: string }) {
  const qc = useQueryClient();
  const [tomarFoto, setTomarFoto] = useState(false);
  const { data: s } = useQuery({
    queryKey: ['socio', socioId],
    queryFn: () => api<SocioDetalle>(`/socios/${socioId}`),
    refetchInterval: (q) => (q.state.data && !q.state.data.bioPendiente && q.state.data.bioEstado !== 'pendiente' ? false : 1500),
  });
  if (!s) return null;
  const v = s.vigencia;
  let icono = <Loader2 className="h-6 w-6 animate-spin text-flame-500" />;
  let titulo = 'Enviando al lector…';
  let detalle = 'Esto toma unos segundos.';
  let tono = 'border-flame-500/30 bg-flame-500/[0.06]';
  if (!s.foto) {
    icono = <Camera className="h-6 w-6 text-warn" />;
    titulo = 'Falta la foto del rostro';
    detalle = 'Sin foto no podrá entrar por el lector.';
    tono = 'border-warn/30 bg-warn/[0.06]';
  } else if (s.bioEstado === 'error') {
    icono = <TriangleAlert className="h-6 w-6 text-bad" />;
    titulo = 'El lector rechazó la foto';
    detalle = s.bioError ?? 'Toma otra foto con mejor luz.';
    tono = 'border-bad/30 bg-bad/[0.06]';
  } else if (s.bioPendiente || s.bioEstado === 'pendiente') {
    if (s.bioReintentando) {
      titulo = 'Lector sin conexión: se enviará solo al volver';
      detalle = 'La venta quedó registrada. No hay que hacer nada más.';
    }
  } else {
    icono = <ScanFace className="h-6 w-6 text-ok" />;
    titulo = v.vigente ? '¡Ya puede entrar con su rostro!' : 'Rostro registrado en el lector';
    detalle = v.vigente ? `El lector lo deja pasar hasta el ${fecha(v.hasta)}.` : 'Cuando pague un plan, el lector le abrirá la puerta.';
    tono = 'border-ok/30 bg-ok/[0.07]';
  }
  return (
    <>
      <div className={cx('flex items-center gap-4 rounded-2xl border p-4', tono)}>
        {icono}
        <div className="flex-1">
          <p className="font-bold text-white">{titulo}</p>
          <p className="text-xs text-steel-400">{detalle}</p>
        </div>
        {(!s.foto || s.bioEstado === 'error') && (
          <button className="btn-primary btn-sm" onClick={() => setTomarFoto(true)}>
            <Camera className="h-4 w-4" /> Tomar foto
          </button>
        )}
      </div>
      {tomarFoto && (
        <FotoRapida
          socioId={socioId}
          onClose={() => setTomarFoto(false)}
          onDone={() => {
            setTomarFoto(false);
            void qc.invalidateQueries({ queryKey: ['socio', socioId] });
          }}
        />
      )}
    </>
  );
}

export function FotoRapida({ socioId, onClose, onDone }: { socioId: string; onClose: () => void; onDone: () => void }) {
  const [foto, setFoto] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => api(`/socios/${socioId}`, { method: 'PUT', body: { foto } }),
    onSuccess: () => (toast.success('Foto enviada al lector'), onDone()),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal
      title="Foto del rostro"
      size="sm"
      onClose={onClose}
      footer={
        <button className="btn-primary" disabled={!foto || m.isPending} onClick={() => m.mutate()}>
          Guardar y enviar al lector
        </button>
      }
    >
      <FotoCaptura value={foto} onChange={setFoto} />
    </Modal>
  );
}

export function BotonNuevoCliente({ className, onClick }: { className?: string; onClick: () => void }) {
  return (
    <button className={cx('btn-primary', className)} onClick={onClick}>
      <UserPlus className="h-4 w-4" /> Nuevo cliente
    </button>
  );
}
