import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, CalendarPlus, Gift, HandCoins, Pencil, RefreshCw, Search, Snowflake, UserPlus, UserX, UserCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fecha, fechaHora, hace, hoyISO, money } from '../lib/format';
import { useCatalogo } from '../lib/hooks';
import { fmt } from '../lib/monedas';
import type { MembresiaCliente, PersonalizadoSocio, SocioDetalle, SocioLista } from '../lib/types';
import { AsignarPersonalizadoModal, EditarMembresiaModal, EditarPersonalizadoModal } from './AjustesAdmin';
import { DatosRapidos, datosOk, EstadoLector } from './ClienteNuevo';
import { EstadoPz } from '../pages/cajero/Personalizados';
import { FotoCaptura } from './FotoCaptura';
import { ProgresoSocio } from './Progreso';
import { Avatar, BioBadge, cx, Drawer, Field, Loading, Modal, NumInput, VigenciaBadge } from './ui';

// ── Formulario alta/edición ──────────────────────────────────────────
interface FormState {
  nombre: string;
  apellido: string;
  cedula: string;
  telefono: string;
  email: string;
  fechaNacimiento: string;
  genero: '' | 'M' | 'F' | 'O';
  notas: string;
  foto: string | null;
}

export interface SocioGuardado {
  id: string;
  nombre: string;
  apellido: string;
  codigo: number;
  tieneFoto: boolean;
}

export function SocioForm({
  socio,
  onClose,
  onSaved,
  nombreInicial,
  sinPlan,
}: {
  socio?: SocioDetalle | null;
  onClose: () => void;
  /** planId: plan elegido en el alta → se cobra en caja (ahí nace la membresía) */
  onSaved?: (s: SocioGuardado, planId: number | null) => void;
  nombreInicial?: string;
  /** No ofrecer elegir plan (ej. al inscribir en una clase) */
  sinPlan?: boolean;
}) {
  const qc = useQueryClient();
  const { data: cat } = useCatalogo();
  const [planId, setPlanId] = useState<number | null>(null);
  const [f, setF] = useState<FormState>({
    nombre: socio?.nombre ?? (nombreInicial && !/^[\d\s-]+$/.test(nombreInicial) ? nombreInicial : ''),
    apellido: socio?.apellido ?? '',
    cedula: socio?.cedula ?? '',
    telefono: socio?.telefono ?? '',
    email: socio?.email ?? '',
    fechaNacimiento: socio?.fechaNacimiento ?? '',
    genero: socio?.genero ?? '',
    notas: socio?.notas ?? '',
    foto: socio?.foto ?? null,
  });
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const m = useMutation({
    mutationFn: () => {
      const body = { ...f, genero: f.genero || null, cedula: f.cedula || null, email: f.email || null, fechaNacimiento: f.fechaNacimiento || null };
      return socio
        ? api<{ id: string; nombre: string; apellido: string; codigo: number }>(`/socios/${socio.id}`, { method: 'PUT', body })
        : api<{ id: string; nombre: string; apellido: string; codigo: number }>('/socios', { body });
    },
    onSuccess: (s) => {
      toast.success(socio ? 'Datos actualizados' : `Cliente #${s.codigo} registrado`, { description: f.foto ? 'Enviando rostro al lector…' : 'Sin foto: no podrá entrar con el rostro' });
      void qc.invalidateQueries({ queryKey: ['socios'] });
      void qc.invalidateQueries({ queryKey: ['socio'] });
      onSaved?.({ ...s, tieneFoto: !!f.foto }, socio ? null : planId);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal
      title={socio ? `Editar a ${socio.nombre}` : 'Nuevo cliente'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={m.isPending || !datosOk(f)} onClick={() => m.mutate()}>
            {m.isPending ? 'Guardando…' : socio ? 'Guardar cambios' : planId ? 'Registrar y cobrar plan' : 'Registrar cliente'}
          </button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <div>
          <span className="label text-center">Rostro para el lector</span>
          <FotoCaptura value={f.foto} onChange={(v) => set('foto', v)} />
        </div>
        <div>
          <DatosRapidos d={f} set={set} conEmail autoFocus={!socio} />
        </div>
      </div>
      {!socio && !sinPlan && (
        <div className="mt-6 border-t border-white/[0.06] pt-5">
          <span className="label">Membresía</span>
          <p className="mb-3 text-xs text-steel-500">Elige su plan y al guardar pasas directo a cobrarlo. La membresía se activa (y el lector le abre) en cuanto registras el pago.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPlanId(null)}
              className={cx('rounded-xl border px-4 py-2.5 text-sm font-bold transition', planId === null ? 'border-steel-300 bg-steel-200 text-ink-950' : 'border-white/10 text-steel-400 hover:text-steel-100')}
            >
              Sin plan por ahora
            </button>
            {cat?.planes.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlanId(p.id)}
                className={cx('rounded-xl border px-4 py-2.5 text-left text-sm transition', planId === p.id ? 'border-flame-500 bg-flame-500/15 text-white' : 'border-white/10 text-steel-300 hover:border-white/25')}
              >
                <span className="block font-bold">{p.nombre}</span>
                <span className="tnum text-xs text-flame-400">{money(p.precio)}</span>
                <span className="text-xs text-steel-500"> · {p.duracion}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Buscador de socios ───────────────────────────────────────────────
export function useBuscarSocios(texto: string, estado = 'todos', limite = 8) {
  const [q, setQ] = useState(texto);
  useEffect(() => {
    const t = setTimeout(() => setQ(texto.trim()), 220);
    return () => clearTimeout(t);
  }, [texto]);
  return useQuery({
    queryKey: ['socios', 'buscar', q, estado, limite],
    queryFn: () => api<SocioLista[]>('/socios', { query: { buscar: q || undefined, estado, limite } }),
    placeholderData: (p) => p,
  });
}

export function SocioPicker({ onPick, autoFocus, placeholder = 'Buscar cliente por nombre, cédula, teléfono o código…', onNuevo }: { onPick: (s: SocioLista) => void; autoFocus?: boolean; placeholder?: string; onNuevo?: (texto: string) => void }) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [idx, setIdx] = useState(0);
  const { data = [], isFetching } = useBuscarSocios(texto);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAbierto(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pick = (s: SocioLista) => {
    onPick(s);
    setTexto('');
    setAbierto(false);
  };

  return (
    <div ref={ref} className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-steel-500" />
      <input
        className="input h-14 rounded-2xl pl-12 text-base"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={texto}
        onFocus={() => setAbierto(true)}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
          setIdx(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setIdx((i) => Math.min(i + 1, data.length - 1));
          if (e.key === 'ArrowUp') setIdx((i) => Math.max(i - 1, 0));
          if (e.key === 'Enter' && data[idx]) pick(data[idx]);
        }}
      />
      {abierto && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-ink-850 shadow-2xl">
          {data.length === 0 && !isFetching && <p className="px-4 py-4 text-sm text-steel-500">Sin resultados</p>}
          {data.map((s, i) => (
            <button
              key={s.id}
              onMouseEnter={() => setIdx(i)}
              onClick={() => pick(s)}
              className={cx('flex w-full items-center gap-3 px-4 py-2.5 text-left transition', i === idx ? 'bg-flame-500/10' : 'hover:bg-white/[0.03]')}
            >
              <Avatar socioId={s.id} nombre={`${s.nombre} ${s.apellido}`} tieneFoto={s.tieneFoto} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-steel-100">
                  {s.nombre} {s.apellido}
                </p>
                <p className="truncate text-xs text-steel-500">
                  #{s.codigo} {s.cedula && `· ${s.cedula}`} {s.plan && `· ${s.plan}`}
                </p>
              </div>
              <VigenciaBadge vence={s.vence} activo={s.activo} />
            </button>
          ))}
          {onNuevo && (
            <button onClick={() => (setAbierto(false), onNuevo(texto))} className="flex w-full items-center gap-2 border-t border-white/[0.06] px-4 py-3 text-sm font-bold text-flame-400 hover:bg-flame-500/10">
              <UserPlus className="h-4 w-4" /> Registrar socio nuevo {texto && `“${texto}”`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Ficha del socio ──────────────────────────────────────────────────
export function SocioDrawer({ socioId, onClose, onCobrar }: { socioId: string; onClose: () => void; onCobrar?: (s: SocioDetalle) => void }) {
  const { user } = useAuth();
  const esDueno = user?.rol === 'dueno';
  const gestion = user?.rol === 'dueno' || user?.rol === 'admin_caja';
  const qc = useQueryClient();
  const [editar, setEditar] = useState(false);
  const [cortesia, setCortesia] = useState(false);
  const [editMem, setEditMem] = useState<MembresiaCliente | null>(null);
  const [editPz, setEditPz] = useState<PersonalizadoSocio | null>(null);
  const [asignarPz, setAsignarPz] = useState(false);
  const { data: s, isLoading } = useQuery({
    queryKey: ['socio', socioId],
    queryFn: () => api<SocioDetalle>(`/socios/${socioId}`),
    refetchInterval: (q) => (q.state.data?.bioEstado === 'pendiente' ? 2500 : false),
  });
  const refrescar = () => {
    void qc.invalidateQueries({ queryKey: ['socio', socioId] });
    void qc.invalidateQueries({ queryKey: ['socios'] });
    void qc.invalidateQueries({ queryKey: ['personalizados'] });
    void qc.invalidateQueries({ queryKey: ['membresias'] });
  };
  const estado = useMutation({
    mutationFn: (activo: boolean) => api(`/socios/${socioId}/estado`, { body: { activo } }),
    onSuccess: () => (toast.success('Listo'), refrescar()),
    onError: (e: Error) => toast.error(e.message),
  });
  const congelar = useMutation({
    mutationFn: (a: { mid: string; accion: 'congelar' | 'reanudar' }) => api<{ dias?: number }>(`/socios/${socioId}/membresias/${a.mid}/${a.accion}`, { body: a.accion === 'congelar' ? { motivo: null } : {} }),
    onSuccess: (r, a) => (toast.success(a.accion === 'congelar' ? 'Membresía congelada: no tendrá acceso hasta reanudarla' : `Reanudada: +${r.dias ?? 0} día(s) devueltos`), refrescar()),
    onError: (e: Error) => toast.error(e.message),
  });
  const resync = useMutation({
    mutationFn: () => api(`/biometric/socios/${socioId}/sync`, { body: {} }),
    onSuccess: () => (toast.success('Reenviando al lector…'), refrescar()),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !s) {
    return (
      <Drawer title="Cliente" onClose={onClose}>
        <Loading />
      </Drawer>
    );
  }
  const v = s.vigencia;
  const nombre = `${s.nombre} ${s.apellido}`.trim();

  return (
    <>
      <Drawer
        title={nombre}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            Código <b className="text-steel-200">#{s.codigo}</b> {s.cedula && <>· {s.cedula}</>} · desde {fecha(s.creadoEn)}
          </span>
        }
        onClose={onClose}
        footer={
          <>
            {esDueno && (
              <button className="btn-ghost btn-sm" onClick={() => estado.mutate(!s.activo)}>
                {s.activo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />} {s.activo ? 'Desactivar' : 'Reactivar'}
              </button>
            )}
            {esDueno && (
              <button className="btn-ghost btn-sm" onClick={() => setCortesia(true)}>
                <Gift className="h-4 w-4" /> Cortesía
              </button>
            )}
            <button className="btn-ghost btn-sm" onClick={() => setEditar(true)}>
              <Pencil className="h-4 w-4" /> Editar
            </button>
            {onCobrar && s.activo && (
              <button className="btn-primary btn-sm" onClick={() => onCobrar(s)}>
                <CalendarPlus className="h-4 w-4" /> {v.vigente ? 'Renovar' : 'Cobrar plan'}
              </button>
            )}
          </>
        }
      >
        <div className="flex items-center gap-5">
          <Avatar socioId={s.id} nombre={nombre} tieneFoto={!!s.foto} size={96} bust={s.actualizadoEn} ring={v.vigente ? 'ok' : 'bad'} />
          <div className="flex-1">
            <div className={cx('rounded-2xl border p-4', v.vigente ? 'border-ok/25 bg-ok/[0.06]' : 'border-bad/25 bg-bad/[0.06]')}>
              <p className={cx('font-wide text-lg', v.vigente ? 'text-ok' : 'text-bad')}>{v.vigente ? `${v.diasRestantes} día(s) restantes` : 'Sin membresía vigente'}</p>
              <p className="text-sm text-steel-400">
                {v.vigente ? `${v.plan} · hasta el ${fecha(v.hasta)}` : v.desde ? `Su plan empieza el ${fecha(v.desde)}` : v.ultimaFin ? `Venció el ${fecha(v.ultimaFin)}` : 'Nunca ha tenido plan'}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <BioBadge estado={s.bioEstado} />
              {s.telefono && <span className="chip border-white/10 text-steel-400">{s.telefono}</span>}
              {esDueno && s.activo && (
                <button className="chip border-white/10 text-steel-400 hover:text-flame-400" onClick={() => resync.mutate()} title="Reenviar ficha y rostro al lector">
                  <RefreshCw className="h-3 w-3" /> Reenviar al lector
                </button>
              )}
            </div>
            {s.activo && (
              <div className="mt-3">
                <EstadoLector socioId={s.id} />
              </div>
            )}
          </div>
        </div>
        {s.notas && <p className="mt-5 rounded-xl bg-white/[0.03] p-3 text-sm text-steel-300">📝 {s.notas}</p>}

        <h4 className="label mt-7">Membresías</h4>
        <div className="space-y-2">
          {s.membresias.length === 0 && <p className="text-sm text-steel-500">Todavía no tiene planes.</p>}
          {s.membresias.map((m) => {
            const hoy = hoyISO();
            const enCurso = m.estado === 'activa' && m.fechaInicio <= hoy && m.fechaFin >= hoy;
            return (
              <div
                key={m.id}
                className={cx(
                  'flex items-center gap-3 rounded-xl border px-4 py-3',
                  m.estado === 'congelada' ? 'border-sky-400/30 bg-sky-400/[0.06]' : 'border-white/[0.05] bg-white/[0.02]',
                  (m.estado === 'anulada' || m.estado === 'reemplazada') && 'opacity-40',
                )}
              >
                <span className="h-8 w-1.5 rounded-full" style={{ background: m.color }} />
                <div className="min-w-0 flex-1">
                  <p className={cx('font-bold text-steel-100', m.estado === 'anulada' && 'line-through')}>
                    {m.plan}
                    {m.grupoId && <span className="ml-2 text-xs font-normal text-flame-300">grupal</span>}
                  </p>
                  <p className="text-xs text-steel-500">
                    {fecha(m.fechaInicio)} → {fecha(m.fechaFin)}
                    {m.estado === 'congelada' && m.congeladaDesde && ` · congelada desde ${fecha(m.congeladaDesde)}`}
                    {m.estado === 'reemplazada' && ' · reemplazada'}
                    {m.diasCongelados > 0 && ` · ${m.diasCongelados} día(s) devueltos`}
                  </p>
                </div>
                {m.precio !== undefined && m.moneda && <span className="tnum text-sm text-steel-400">{fmt(Number(m.precio), m.moneda)}</span>}
                {gestion && m.estado === 'activa' && (
                  <button className="btn-ghost btn-sm" onClick={() => setEditMem(m)} title="Cambiar fechas o plan (no pasa por caja)">
                    <Pencil className="h-4 w-4" /> Editar
                  </button>
                )}
                {gestion && enCurso && m.congelable && (
                  <button className="btn-ghost btn-sm" disabled={congelar.isPending} onClick={() => congelar.mutate({ mid: m.id, accion: 'congelar' })}>
                    <Snowflake className="h-4 w-4 text-sky-300" /> Congelar
                  </button>
                )}
                {gestion && m.estado === 'congelada' && (
                  <button className="btn-primary btn-sm" disabled={congelar.isPending} onClick={() => congelar.mutate({ mid: m.id, accion: 'reanudar' })}>
                    Reanudar
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-7 flex items-center justify-between">
          <h4 className="label mb-0">Entrenamiento personalizado</h4>
          {s.activo && (
            <button className="btn-ghost btn-sm" onClick={() => setAsignarPz(true)}>
              <Award className="h-4 w-4 text-flame-400" /> Asignar personalizado
            </button>
          )}
        </div>
        {(s.personalizados ?? []).length === 0 && <p className="mt-2 text-sm text-steel-500">No tiene entrenamiento personalizado.</p>}
        {(s.personalizados ?? []).length > 0 && (
          <>
            <div className="mt-2 space-y-2">
              {s.personalizados!.map((p) => (
                <div key={p.entrenadorId} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <Award className="h-5 w-5 text-flame-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-steel-100">Con {p.entrenador}</p>
                    <p className="text-xs text-steel-500">
                      {p.estadoTexto}
                      {p.hasta && ` · pagado hasta ${fecha(p.hasta)}`}
                      {p.sinCobro && ' · registrado sin cobro'}
                    </p>
                  </div>
                  <EstadoPz estado={p.estado} />
                  {gestion && p.ultimo && (
                    <button className="btn-ghost btn-sm" onClick={() => setEditPz(p)} title="Cambiar fechas (no pasa por caja)">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {p.estado !== 'debe' && (
                    <Link to={`/mostrador?cliente=${s.id}&personalizado=${p.entrenadorId}`} className="btn-ghost btn-sm">
                      Renovar
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {s.deudas.length > 0 && (
          <>
            <h4 className="label mt-7">Deudas pendientes</h4>
            <div className="space-y-2">
              {s.deudas.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-xl border border-warn/25 bg-warn/[0.05] px-4 py-3">
                  <HandCoins className="h-5 w-5 text-warn" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-steel-100">{d.concepto}</p>
                    <p className="text-xs text-steel-500">desde {fecha(d.creadoEn)} · total {fmt(Number(d.montoTotal), d.moneda)}</p>
                  </div>
                  <span className="tnum font-bold text-warn">{fmt(Number(d.saldo), d.moneda)}</span>
                </div>
              ))}
              {onCobrar && <p className="text-xs text-steel-500">Se cobran en Cobrar: al elegir al cliente aparece el botón de abono.</p>}
            </div>
          </>
        )}

        <ProgresoSocio socioId={s.id} nombre={s.nombre} telefono={s.telefono} />

        <h4 className="label mt-7">Últimas entradas</h4>
        <div className="space-y-1.5">
          {s.asistencias.length === 0 && <p className="text-sm text-steel-500">Sin registros.</p>}
          {s.asistencias.map((a) => (
            <div key={a.id} className="flex items-center gap-3 text-sm">
              <span className={cx('h-2 w-2 rounded-full', a.resultado === 'permitido' ? 'bg-ok' : 'bg-bad')} />
              <span className="w-40 text-steel-400">{fechaHora(a.fechaHora)}</span>
              <span className="flex-1 truncate text-steel-300">{a.motivo}</span>
              <span className="text-xs text-steel-600">{a.origen}</span>
            </div>
          ))}
        </div>
        {s.asistencias[0] && <p className="mt-3 text-xs text-steel-500">Última visita {hace(s.asistencias.find((a) => a.resultado === 'permitido')?.fechaHora)}</p>}
      </Drawer>
      {editar && <SocioForm socio={s} onClose={() => setEditar(false)} />}
      {editMem && <EditarMembresiaModal socioId={s.id} m={editMem} onClose={() => setEditMem(null)} onDone={refrescar} />}
      {editPz && <EditarPersonalizadoModal p={editPz} onClose={() => setEditPz(null)} onDone={refrescar} />}
      {asignarPz && <AsignarPersonalizadoModal socioInicial={{ id: s.id, nombre, tieneFoto: !!s.foto, codigo: s.codigo }} onClose={() => setAsignarPz(false)} />}
      {cortesia && <CortesiaModal socioId={s.id} nombre={s.nombre} onClose={() => setCortesia(false)} onDone={refrescar} />}
    </>
  );
}

function CortesiaModal({ socioId, nombre, onClose, onDone }: { socioId: string; nombre: string; onClose: () => void; onDone: () => void }) {
  const [dias, setDias] = useState(7);
  const [motivo, setMotivo] = useState('');
  const m = useMutation({
    mutationFn: () => api(`/socios/${socioId}/cortesia`, { body: { dias, motivo } }),
    onSuccess: () => {
      toast.success(`${dias} día(s) regalados a ${nombre}`);
      onDone();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal
      title="Regalar días"
      size="sm"
      onClose={onClose}
      footer={
        <button className="btn-primary" disabled={motivo.trim().length < 3 || m.isPending} onClick={() => m.mutate()}>
          Regalar {dias} día(s)
        </button>
      }
    >
      <p className="mb-4 text-sm text-steel-400">No pasa por caja y queda registrado en la auditoría. Se suman al final de su plan actual.</p>
      <div className="grid gap-4">
        <Field label="Días">
          <NumInput value={dias} min={1} max={366} onChange={setDias} />
        </Field>
        <Field label="Motivo">
          <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. compensación por mantenimiento" />
        </Field>
      </div>
    </Modal>
  );
}
