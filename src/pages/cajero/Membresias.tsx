/**
 * Membresías: por plan, cuántos días le quedan a cada quien y cómo entra
 * (lector / recepción / bloqueado). La cajera la usa para responder
 * "¿cuántos días me quedan?" y actualizar el teléfono en el momento.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CalendarX2, Check, DoorOpen, Pencil, Phone, RefreshCw, ScanFace, Search, ShieldAlert, ShieldCheck, Snowflake, UserRound, Wallet, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { telefonoOk } from '../../components/ClienteNuevo';
import { SocioDrawer, useBuscarSocios } from '../../components/socios';
import { Avatar, cx, Empty, Loading, Modal, PageHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { fecha, hace } from '../../lib/format';

type Estado = 'vigente' | 'por_vencer' | 'vence_hoy' | 'por_empezar' | 'congelada' | 'vencida';
interface FilaMembresia {
  socioId: string;
  codigo: number;
  nombre: string;
  apellido: string;
  cedula: string | null;
  telefono: string | null;
  tieneFoto: boolean;
  bioEstado: string;
  planId: number;
  plan: string;
  color: string;
  estado: Estado;
  desde: string | null;
  hasta: string | null;
  diasRestantes: number;
  diasVencida: number | null;
  proximoPago: string | null;
  congeladaDesde: string | null;
  diasCongelada: number | null;
  acceso: { tipo: 'lector' | 'recepcion' | 'pendiente' | 'bloqueado'; texto: string };
  ultimaVisita: string | null;
}
interface Conteo {
  vigentes: number;
  porVencer: number;
  venceHoy: number;
  porEmpezar: number;
  congeladas: number;
  vencidas: number;
  sinLector: number;
}
interface Tablero {
  hoy: string;
  diasVencidas: number;
  porVencerDias: number;
  resumen: Conteo;
  planes: Array<Conteo & { id: number; nombre: string; color: string; accesoLector: boolean; activo: boolean }>;
  filas: FilaMembresia[];
}

type Filtro = 'vigentes' | 'vence_hoy' | 'por_vencer' | 'congeladas' | 'vencidas' | 'sin_lector' | 'todas';

const nombreDe = (f: { nombre: string; apellido: string }) => `${f.nombre} ${f.apellido}`.trim();
const dentro = (e: Estado) => e === 'vigente' || e === 'por_vencer' || e === 'vence_hoy';
const pasaFiltro = (f: FilaMembresia, filtro: Filtro) =>
  filtro === 'todas' ||
  (filtro === 'vigentes' && dentro(f.estado)) ||
  (filtro === 'vence_hoy' && f.estado === 'vence_hoy') ||
  (filtro === 'por_vencer' && (f.estado === 'por_vencer' || f.estado === 'vence_hoy')) ||
  (filtro === 'congeladas' && f.estado === 'congelada') ||
  (filtro === 'vencidas' && f.estado === 'vencida') ||
  (filtro === 'sin_lector' && dentro(f.estado) && f.acceso.tipo !== 'lector');

const tono: Record<Estado, { texto: string; borde: string; fondo: string }> = {
  vigente: { texto: 'text-ok', borde: 'border-ok/30', fondo: 'bg-ok' },
  por_vencer: { texto: 'text-warn', borde: 'border-warn/40', fondo: 'bg-warn' },
  vence_hoy: { texto: 'text-bad', borde: 'border-bad/40', fondo: 'bg-bad' },
  por_empezar: { texto: 'text-steel-300', borde: 'border-white/15', fondo: 'bg-steel-400' },
  congelada: { texto: 'text-sky-300', borde: 'border-sky-400/40', fondo: 'bg-sky-400' },
  vencida: { texto: 'text-bad', borde: 'border-bad/30', fondo: 'bg-bad' },
};

/** "23 días", "Vence hoy", "Vencida hace 4 días"… */
function textoDias(f: FilaMembresia) {
  if (f.estado === 'congelada') return { grande: 'Congelada', chico: f.diasCongelada ? `hace ${f.diasCongelada} día(s)` : '' };
  if (f.estado === 'vencida') return { grande: 'Vencida', chico: f.diasVencida ? `hace ${f.diasVencida} día(s)` : 'hoy' };
  if (f.estado === 'por_empezar') return { grande: 'Por empezar', chico: f.desde ? `el ${fecha(f.desde)}` : '' };
  if (f.estado === 'vence_hoy') return { grande: 'Último día', chico: 'vence hoy' };
  return { grande: `${f.diasRestantes}`, chico: f.diasRestantes === 1 ? 'día' : 'días' };
}

function ChipDias({ f }: { f: FilaMembresia }) {
  const t = textoDias(f);
  const c = tono[f.estado];
  return (
    <span className={cx('inline-flex items-baseline gap-1 rounded-full border px-3 py-1 font-bold', c.borde, c.texto)}>
      {f.estado === 'congelada' && <Snowflake className="h-3.5 w-3.5 self-center" />}
      <span className="tnum">{t.grande}</span>
      <span className="text-xs font-normal opacity-80">{t.chico}</span>
    </span>
  );
}

function Acceso({ a }: { a: FilaMembresia['acceso'] }) {
  const Icon = a.tipo === 'lector' ? ShieldCheck : a.tipo === 'recepcion' ? DoorOpen : a.tipo === 'pendiente' ? RefreshCw : ShieldAlert;
  const cls = a.tipo === 'lector' ? 'text-ok' : a.tipo === 'recepcion' ? 'text-steel-300' : a.tipo === 'pendiente' ? 'text-warn' : 'text-bad';
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-sm', cls)}>
      <Icon className="h-4 w-4 shrink-0" /> {a.texto}
    </span>
  );
}

/** Teléfono con botón para actualizarlo en el momento. */
function TelefonoEditable({ socioId, telefono }: { socioId: string; telefono: string | null }) {
  const qc = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState(telefono ?? '');
  useEffect(() => setV(telefono ?? ''), [telefono]);
  const m = useMutation({
    mutationFn: () => api(`/socios/${socioId}`, { method: 'PUT', body: { telefono: v } }),
    onSuccess: () => {
      toast.success('Teléfono actualizado');
      setEditando(false);
      for (const k of ['membresias', 'socios', 'socio']) void qc.invalidateQueries({ queryKey: [k] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!editando)
    return (
      <button type="button" className="group inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-left hover:border-flame-500/50" onClick={() => setEditando(true)}>
        <Phone className="h-4 w-4 text-steel-500" />
        <span className="tnum text-steel-100">{telefono || 'Sin teléfono'}</span>
        <span className="inline-flex items-center gap-1 text-xs font-bold text-flame-300">
          <Pencil className="h-3 w-3" /> Actualizar número
        </span>
      </button>
    );
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (telefonoOk(v)) m.mutate();
      }}
    >
      <input className="input tnum w-48" autoFocus inputMode="tel" value={v} onChange={(e) => setV(e.target.value)} placeholder="0414-1234567" />
      <button type="submit" className="btn-primary btn-sm" disabled={!telefonoOk(v) || m.isPending}>
        <Check className="h-4 w-4" /> Guardar
      </button>
      <button type="button" className="btn-ghost btn-sm" onClick={() => (setEditando(false), setV(telefono ?? ''))}>
        <X className="h-4 w-4" />
      </button>
    </form>
  );
}

/** Tarjeta grande: lo que la cajera le dice al cliente. */
function TarjetaDias({ f, onFicha, onCobrar }: { f: FilaMembresia; onFicha: () => void; onCobrar: () => void }) {
  const qc = useQueryClient();
  const t = textoDias(f);
  const c = tono[f.estado];
  const total = f.desde && f.hasta ? Math.max(1, Math.round((Date.parse(f.hasta) - Date.parse(f.desde)) / 86_400_000) + 1) : 1;
  const pct = dentro(f.estado) ? Math.min(100, Math.max(4, (f.diasRestantes / total) * 100)) : 0;
  const entrada = useMutation({
    mutationFn: () => api<{ resultado: string; motivo: string }>('/asistencia/manual', { body: { socioId: f.socioId } }),
    onSuccess: (r) => {
      if (r.resultado === 'permitido') toast.success(`Entrada registrada: ${f.nombre}`, { description: r.motivo });
      else toast.error(`No puede entrar: ${r.motivo}`);
      for (const k of ['membresias', 'asistencia']) void qc.invalidateQueries({ queryKey: [k] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const lector = useMutation({
    mutationFn: () => api(`/membresias/${f.socioId}/lector`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Enviado al lector');
      void qc.invalidateQueries({ queryKey: ['membresias'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className={cx('plate overflow-hidden p-0', c.borde)}>
      <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: f.color }} />
      <div className="grid gap-6 p-6 pt-7 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex items-center gap-4">
            <Avatar socioId={f.socioId} nombre={nombreDe(f)} tieneFoto={f.tieneFoto} size={64} ring={dentro(f.estado) ? 'ok' : 'bad'} />
            <div className="min-w-0">
              <p className="truncate font-display text-2xl font-extrabold text-white">{nombreDe(f)}</p>
              <p className="text-sm text-steel-400">
                #{f.codigo}
                {f.cedula && ` · C.I. ${f.cedula}`}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="chip border-white/15 text-steel-100">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: f.color }} /> {f.plan}
            </span>
            <Acceso a={f.acceso} />
          </div>
          <div className="mt-4">
            <TelefonoEditable socioId={f.socioId} telefono={f.telefono} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wider text-steel-500">Pagó desde</dt>
              <dd className="tnum text-steel-100">{fecha(f.desde)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-steel-500">{f.estado === 'vencida' ? 'Venció el' : 'Vence el'}</dt>
              <dd className="tnum font-bold text-white">{fecha(f.hasta)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-steel-500">Próxima mensualidad</dt>
              <dd className="tnum font-bold text-flame-300">{f.estado === 'congelada' ? 'Al reanudar' : fecha(f.proximoPago)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-steel-500">Última visita</dt>
              <dd className="text-steel-300">{hace(f.ultimaVisita)}</dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-col items-center justify-center rounded-3xl border border-white/[0.06] bg-white/[0.02] px-8 py-5 text-center md:min-w-[220px]">
          <p className="text-xs uppercase tracking-wider text-steel-500">{dentro(f.estado) ? 'Le quedan' : 'Membresía'}</p>
          <p className={cx('tnum font-display font-extrabold leading-none', c.texto, /^\d+$/.test(t.grande) ? 'text-7xl' : 'mt-2 text-3xl')}>{t.grande}</p>
          <p className={cx('mt-1 text-lg', c.texto)}>{t.chico}</p>
          {dentro(f.estado) && (
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div className={cx('h-full rounded-full', c.fondo)} style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-white/[0.06] bg-white/[0.02] px-6 py-3">
        <button className="btn-primary" onClick={onCobrar}>
          <Wallet className="h-4 w-4" /> {dentro(f.estado) ? 'Renovar / adelantar pago' : 'Cobrar renovación'}
        </button>
        {dentro(f.estado) && (
          <button className="btn-ok" disabled={entrada.isPending} onClick={() => entrada.mutate()}>
            <DoorOpen className="h-4 w-4" /> Dar entrada
          </button>
        )}
        {f.tieneFoto && f.acceso.tipo !== 'lector' && dentro(f.estado) && (
          <button className="btn-ghost" disabled={lector.isPending} onClick={() => lector.mutate()}>
            <ScanFace className="h-4 w-4" /> Reenviar al lector
          </button>
        )}
        <button className="btn-ghost ml-auto" onClick={onFicha}>
          <UserRound className="h-4 w-4" /> Ver ficha (congelar, rostro, historial)
        </button>
      </div>
    </div>
  );
}

export default function Membresias() {
  const nav = useNavigate();
  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('vigentes');
  const [planId, setPlanId] = useState<number | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [ficha, setFicha] = useState<string | null>(null);
  const buscador = useRef<HTMLInputElement>(null);
  const { data, isLoading } = useQuery({ queryKey: ['membresias'], queryFn: () => api<Tablero>('/membresias'), refetchInterval: 30_000 });

  const q = texto.trim().toLowerCase();
  const qDig = q.replace(/\D/g, '');
  const coincide = (f: FilaMembresia) =>
    !q || nombreDe(f).toLowerCase().includes(q) || (f.cedula ?? '').toLowerCase().includes(q.replace(/[^0-9a-z]/g, '')) || (qDig.length >= 3 && (f.telefono ?? '').replace(/\D/g, '').includes(qDig)) || String(f.codigo) === q;

  const encontrados = useMemo(() => (q ? (data?.filas ?? []).filter(coincide) : []), [data, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const lista = useMemo(
    () => (data?.filas ?? []).filter((f) => (q ? coincide(f) : pasaFiltro(f, filtro)) && (planId === null || f.planId === planId)),
    [data, q, filtro, planId], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Si la búsqueda no está en membresías (cliente sin plan), lo buscamos en clientes
  const sinPlan = useBuscarSocios(q.length >= 3 && !encontrados.length ? texto : '', 'todos', 5);
  const unico = encontrados.length === 1 ? encontrados[0]! : null;
  const seleccionado = sel ? data?.filas.find((f) => f.socioId === sel) : null;
  const cobrar = (socioId: string) => nav(`/mostrador?cliente=${socioId}`);

  useEffect(() => buscador.current?.focus(), []);

  const r = data?.resumen;
  const tiles: Array<{ value: Filtro; label: string; n: number | undefined; cls: string; hint?: string }> = [
    { value: 'vigentes', label: 'Al día', n: r?.vigentes, cls: 'text-ok' },
    { value: 'vence_hoy', label: 'Vencen hoy', n: r?.venceHoy, cls: 'text-bad' },
    { value: 'por_vencer', label: `Vencen en ${data?.porVencerDias ?? 5} días`, n: (r?.porVencer ?? 0) + (r?.venceHoy ?? 0), cls: 'text-warn' },
    { value: 'congeladas', label: 'Congeladas', n: r?.congeladas, cls: 'text-sky-300' },
    { value: 'vencidas', label: 'Vencidas', n: r?.vencidas, cls: 'text-bad', hint: `últimos ${data?.diasVencidas ?? 90} días` },
    { value: 'sin_lector', label: 'Al día sin lector', n: r?.sinLector, cls: 'text-warn', hint: 'sin rostro o pase diario' },
  ];

  return (
    <div>
      <PageHeader title="Membresías" kicker="Días y acceso">
        Cuántos días le quedan a cada cliente, por plan, y cómo entra hoy. Escribe la cédula, el nombre o el teléfono para responder al momento.
      </PageHeader>

      {/* Consulta rápida */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-steel-500" />
        <input
          ref={buscador}
          className="input h-14 pl-14 text-lg"
          placeholder="¿Cuántos días me quedan? Cédula, nombre o teléfono…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setTexto('')}
        />
        {texto && (
          <button className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-steel-500 hover:text-white" onClick={() => setTexto('')}>
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      {unico && (
        <div className="mb-6">
          <TarjetaDias f={unico} onFicha={() => setFicha(unico.socioId)} onCobrar={() => cobrar(unico.socioId)} />
        </div>
      )}
      {q.length >= 3 && !encontrados.length && !isLoading && (
        <div className="card mb-6 p-5">
          {sinPlan.data?.length ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-bold text-white">
                <CalendarX2 className="h-4 w-4 text-bad" /> No tiene membresía vigente ni vencida reciente
              </p>
              {sinPlan.data.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar socioId={s.id} nombre={nombreDe(s)} tieneFoto={s.tieneFoto} size={38} />
                    <div>
                      <p className="font-bold text-steel-100">{nombreDe(s)}</p>
                      <p className="text-xs text-steel-500">
                        #{s.codigo} {s.cedula && `· C.I. ${s.cedula}`} {s.vence && `· venció el ${fecha(s.vence)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-ghost btn-sm" onClick={() => setFicha(s.id)}>
                      Ver ficha
                    </button>
                    <button className="btn-primary btn-sm" onClick={() => cobrar(s.id)}>
                      <Wallet className="h-4 w-4" /> Cobrar plan
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-steel-400">Nadie con «{texto}». Revisa la cédula o regístralo en Clientes.</p>
          )}
        </div>
      )}

      {/* Resumen */}
      {!q && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {tiles.map((t) => (
              <button
                key={t.value}
                onClick={() => setFiltro(t.value)}
                className={cx('rounded-2xl border p-4 text-left transition', filtro === t.value ? 'border-flame-500/60 bg-flame-500/[0.08]' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/20')}
              >
                <p className={cx('tnum font-display text-3xl font-extrabold', t.cls)}>{t.n ?? '—'}</p>
                <p className="text-sm font-bold text-steel-200">{t.label}</p>
                {t.hint && <p className="text-[11px] text-steel-500">{t.hint}</p>}
              </button>
            ))}
          </div>

          {/* Por plan */}
          {!!data?.planes.length && (
            <div className="mb-5 flex gap-3 overflow-x-auto pb-1">
              <button
                onClick={() => setPlanId(null)}
                className={cx('shrink-0 rounded-2xl border px-4 py-3 text-left text-sm transition', planId === null ? 'border-steel-300 bg-steel-200 text-ink-950' : 'border-white/[0.08] text-steel-300 hover:border-white/20')}
              >
                <p className="font-bold">Todos los planes</p>
                <p className="text-xs opacity-70">{r?.vigentes ?? 0} al día</p>
              </button>
              {data.planes.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlanId(planId === p.id ? null : p.id)}
                  className={cx('relative shrink-0 overflow-hidden rounded-2xl border px-4 py-3 pt-4 text-left text-sm transition', planId === p.id ? 'border-flame-500/70 bg-flame-500/[0.08]' : 'border-white/[0.08] hover:border-white/20')}
                >
                  <span className="absolute inset-x-0 top-0 h-1" style={{ background: p.color }} />
                  <p className="font-bold text-white">{p.nombre}</p>
                  <p className="text-xs text-steel-400">
                    <b className="text-ok">{p.vigentes}</b> al día
                    {p.porVencer + p.venceHoy > 0 && (
                      <>
                        {' '}
                        · <b className="text-warn">{p.porVencer + p.venceHoy}</b> por vencer
                      </>
                    )}
                    {p.vencidas > 0 && (
                      <>
                        {' '}
                        · <b className="text-bad">{p.vencidas}</b> vencidas
                      </>
                    )}
                  </p>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Lista */}
      {(!q || encontrados.length > 1) && (
        <div className="card overflow-hidden">
          {isLoading ? (
            <Loading />
          ) : !lista.length ? (
            <Empty icon={<CalendarClock className="h-7 w-7" />} title="Nadie en esta lista" hint="Cambia el filtro o el plan." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Plan</th>
                    <th>Días</th>
                    <th className="hidden md:table-cell">Vence · próximo pago</th>
                    <th className="hidden lg:table-cell">Acceso</th>
                    <th className="hidden xl:table-cell">Última visita</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((f) => (
                    <tr key={f.socioId} className="cursor-pointer" onClick={() => setSel(f.socioId)}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar socioId={f.socioId} nombre={nombreDe(f)} tieneFoto={f.tieneFoto} size={36} />
                          <div>
                            <p className="font-bold text-steel-100">{nombreDe(f)}</p>
                            <p className="text-xs text-steel-500">
                              {f.cedula ? `C.I. ${f.cedula}` : `#${f.codigo}`} {f.telefono && `· ${f.telefono}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-2 text-steel-200">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: f.color }} />
                          {f.plan}
                        </span>
                      </td>
                      <td>
                        <ChipDias f={f} />
                      </td>
                      <td className="hidden md:table-cell">
                        <p className="tnum text-steel-200">{fecha(f.hasta)}</p>
                        {f.estado !== 'congelada' && <p className="tnum text-xs text-flame-300">paga el {fecha(f.proximoPago)}</p>}
                      </td>
                      <td className="hidden lg:table-cell">
                        <Acceso a={f.acceso} />
                      </td>
                      <td className="hidden text-steel-400 xl:table-cell">{hace(f.ultimaVisita)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {seleccionado && (
        <Modal title="Membresía" size="lg" onClose={() => setSel(null)}>
          <TarjetaDias f={seleccionado} onFicha={() => setFicha(seleccionado.socioId)} onCobrar={() => cobrar(seleccionado.socioId)} />
        </Modal>
      )}
      {ficha && <SocioDrawer socioId={ficha} onClose={() => setFicha(null)} onCobrar={(s) => cobrar(s.id)} />}
    </div>
  );
}
