import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cable, CircleCheck, CircleX, FlaskConical, RefreshCw, RotateCcw, ScanFace, ShieldCheck, Unplug, UserX, Wifi, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { SocioPicker } from '../../components/socios';
import { cx, Loading, PageHeader, Tabs, Toggle } from '../../components/ui';
import { api } from '../../lib/api';
import { fechaHora, hace } from '../../lib/format';
import type { EntrenadorHoy, ResultadoAcceso, SocioLista } from '../../lib/types';

interface Estado {
  mode: 'mock' | 'isapi' | 'disabled';
  online: boolean;
  checkedAt: string;
  lastOkAt: string | null;
  lastError: string | null;
  breaker: 'closed' | 'open' | 'half_open';
  latencyMs: number | null;
  device: { model: string | null; serialNumber: string | null; firmware: string | null; macAddress: string | null; deviceName: string | null } | null;
  webhook: { path: string; publicUrlConfigurada: boolean; ipsPermitidas: string[]; macsPermitidas: string[]; rechazos: number; ultimoEvento: { at: string; ip: string; resultado: string } | null };
  cola: Array<{ estado: string; n: number }>;
  decision: 'servidor' | 'lector';
  simulador: { desconectado: boolean; usuarios: number; verificacionRemota: boolean } | null;
}
interface ItemCola {
  id: number;
  operacion: string;
  estado: string;
  intentos: number;
  proximoIntento: string;
  ultimoError: string | null;
  actualizadoEn: string;
  socio: string | null;
  codigo: number | null;
}
interface MockUser {
  employeeNo: string;
  name: string;
  validity: { beginTime: string; endTime: string };
  hasFace: boolean;
}

const opLabel: Record<string, string> = { sync_usuario: 'Vigencia', sync_rostro: 'Ficha + rostro', eliminar: 'Eliminar' };
const estadoCls: Record<string, string> = {
  ok: 'border-ok/30 text-ok',
  pendiente: 'border-warn/30 text-warn',
  procesando: 'border-flame-500/30 text-flame-400',
  error: 'border-bad/30 text-bad',
  descartado: 'border-steel-500/30 text-steel-500',
};

export default function Biometrico() {
  const qc = useQueryClient();
  const { data: st, isLoading } = useQuery({ queryKey: ['bio-status'], queryFn: () => api<Estado>('/biometric/status'), refetchInterval: 5000 });
  const { data: cola } = useQuery({ queryKey: ['bio-cola'], queryFn: () => api<ItemCola[]>('/biometric/cola'), refetchInterval: 5000 });
  const esMock = st?.mode === 'mock';
  const { data: mockUsers } = useQuery({ queryKey: ['bio-mock'], enabled: esMock, queryFn: () => api<MockUser[]>('/biometric/simulador/usuarios'), refetchInterval: 5000 });
  const [socio, setSocio] = useState<SocioLista | null>(null);
  const [ultimo, setUltimo] = useState<(ResultadoAcceso & { puerta: string; pantalla: string | null }) | null>(null);
  const [quien, setQuien] = useState<'cliente' | 'entrenador'>('cliente');
  const [entrenadorId, setEntrenadorId] = useState('');
  const { data: entrenadores } = useQuery({ queryKey: ['entrenadores-hoy'], queryFn: () => api<EntrenadorHoy[]>('/entrenadores/hoy'), enabled: esMock });

  const refrescar = () => ['bio-status', 'bio-cola', 'bio-mock', 'asistencia'].forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
  const mut = <T,>(fn: () => Promise<T>, ok: (r: T) => string) =>
    ({
      mutationFn: fn,
      onSuccess: (r: T) => (toast.success(ok(r)), refrescar()),
      onError: (e: Error) => toast.error(e.message),
    }) as const;
  const reintentar = useMutation(mut(() => api<{ reencoladas: number }>('/biometric/cola/reintentar', { body: {} }), (r) => `${r.reencoladas} operación(es) reenviadas`));
  const syncTotal = useMutation(mut(() => api<{ encolados: number }>('/biometric/sync-total', { body: {} }), (r) => `${r.encolados} cliente(s) en cola de sincronización`));
  const listener = useMutation(mut(() => api<{ url: string }>('/biometric/listener', { body: {} }), (r) => `Lector configurado → ${r.url}`));
  const conexion = useMutation({
    mutationFn: (desconectado: boolean) => api('/biometric/simulador/conexion', { body: { desconectado } }),
    onSuccess: (_r, d) => (toast.success(d ? 'Lector simulado desconectado' : 'Lector simulado en línea'), refrescar()),
    onError: (e: Error) => toast.error(e.message),
  });
  const escanear = useMutation({
    mutationFn: (body: { socioId?: string; entrenadorId?: string; desconocido?: boolean }) =>
      api<{ resultado: ResultadoAcceso; puerta: string; pantallaLector: string | null }>('/biometric/simulador/escanear', { body }),
    onSuccess: (r) => (setUltimo({ ...r.resultado, puerta: r.puerta, pantalla: r.pantallaLector }), refrescar(), void qc.invalidateQueries({ queryKey: ['entrenadores-hoy'] })),
    onError: (e: Error) => toast.error(e.message),
  });
  const remota = useMutation({
    mutationFn: (activar: boolean) => api('/biometric/verificacion-remota', { body: { activar } }),
    onSuccess: (_r, a) => (toast.success(a ? 'El lector ahora consulta al sistema antes de abrir' : 'El lector decide solo con la vigencia'), refrescar()),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !st) return <Loading />;
  const cnt = (e: string) => st.cola.find((c) => c.estado === e)?.n ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Lector facial" kicker="Hikvision DS-K1T344 · MinMoe">
        Las fichas y vigencias se envían solas al lector. Si pierde conexión, todo queda en cola y se reenvía al volver.
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="plate p-6 pt-8 xl:col-span-2">
          <div className="flex flex-wrap items-start gap-5">
            <div className={cx('grid h-16 w-16 place-items-center rounded-2xl', st.online ? 'bg-ok/15 text-ok' : 'bg-bad/15 text-bad')}>{st.online ? <Wifi className="h-8 w-8" /> : <WifiOff className="h-8 w-8" />}</div>
            <div className="min-w-[220px] flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-wide text-xl text-white">{st.online ? 'En línea' : 'Sin conexión'}</p>
                <span className={cx('chip', esMock ? 'border-warn/30 text-warn' : st.mode === 'isapi' ? 'border-ok/30 text-ok' : 'border-steel-500/30 text-steel-500')}>{esMock ? 'Modo simulado' : st.mode === 'isapi' ? 'ISAPI real' : 'Desactivado'}</span>
                {st.breaker !== 'closed' && <span className="chip border-bad/30 text-bad">Circuito {st.breaker === 'open' ? 'abierto' : 'probando'}</span>}
              </div>
              <p className="mt-1 text-sm text-steel-400">{st.device?.model ?? 'Equipo sin identificar'} {st.device?.serialNumber && `· S/N ${st.device.serialNumber}`}</p>
              <p className="text-xs text-steel-500">
                {st.latencyMs !== null && `${st.latencyMs} ms · `}último OK {hace(st.lastOkAt)} {st.device?.macAddress && `· MAC ${st.device.macAddress}`}
              </p>
              {st.lastError && <p className="mt-2 text-xs text-bad">{st.lastError}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost btn-sm" onClick={() => syncTotal.mutate()} disabled={syncTotal.isPending}>
                <RefreshCw className="h-4 w-4" /> Sincronizar todos
              </button>
              <button className="btn-ghost btn-sm" onClick={() => remota.mutate(st.decision === 'servidor')} disabled={remota.isPending} title="Configura en el lector la verificación remota (ISAPI AcsCfg)">
                <ShieldCheck className="h-4 w-4" /> {st.decision === 'servidor' ? 'Activar verificación remota' : 'Lector decide solo'}
              </button>
              <button className="btn-ghost btn-sm" onClick={() => listener.mutate()} disabled={listener.isPending}>
                <Cable className="h-4 w-4" /> Configurar webhook
              </button>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['Pendientes', cnt('pendiente') + cnt('procesando'), 'text-warn'],
              ['Con error', cnt('error'), 'text-bad'],
              ['Descartadas', cnt('descartado'), 'text-steel-400'],
              ['Enviadas (7d)', cnt('ok'), 'text-ok'],
            ].map(([l, v, c]) => (
              <div key={l as string} className="rounded-xl bg-white/[0.03] p-3 text-center">
                <p className={cx('tnum font-wide text-2xl', c as string)}>{v}</p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-steel-500">{l}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <p className="flex items-center gap-2 font-display font-extrabold text-white">
            <ShieldCheck className="h-5 w-5 text-flame-500" /> Webhook seguro
          </p>
          <ul className="mt-4 space-y-2 text-sm text-steel-400">
            <li>
              Ruta <code className="rounded bg-white/5 px-1.5 text-steel-200">{st.webhook.path}</code>
            </li>
            <li>Token secreto en la URL (comparación en tiempo constante)</li>
            <li>Redes permitidas: {st.webhook.ipsPermitidas.join(', ')}</li>
            <li>MAC del lector: {st.webhook.macsPermitidas.length ? st.webhook.macsPermitidas.join(', ') : 'sin restringir (configura BIOMETRIC_DEVICE_MACS)'}</li>
            <li>Eventos repetidos se ignoran (idempotencia por serial)</li>
          </ul>
          <div className="mt-4 rounded-xl bg-white/[0.03] p-3 text-xs text-steel-500">
            Último evento: {st.webhook.ultimoEvento ? `${fechaHora(st.webhook.ultimoEvento.at)} desde ${st.webhook.ultimoEvento.ip}` : 'ninguno aún'}
            <br />
            Peticiones rechazadas: <b className={st.webhook.rechazos ? 'text-bad' : 'text-steel-300'}>{st.webhook.rechazos}</b>
          </div>
        </div>
      </div>

      {esMock && (
        <div className="plate border-warn/20 p-6 pt-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 font-wide text-lg text-white">
                <FlaskConical className="h-5 w-5 text-warn" /> Simulador del lector
              </p>
              <p className="text-sm text-steel-400">Prueba el flujo completo sin el equipo: genera el mismo evento que enviaría el DS-K1T344.</p>
              <p className="mt-1 text-xs text-steel-500">
                Modo: {st.simulador?.verificacionRemota ? 'el lector pregunta y el SISTEMA decide si abre' : 'el lector decide con la vigencia sincronizada'}
              </p>
            </div>
            <div className="w-72">
              <Toggle checked={!!st.simulador?.desconectado} onChange={(v) => conexion.mutate(v)} label="Simular lector desconectado" hint="Las ventas siguen; la cola guarda los envíos" />
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <div className="mb-3">
                <Tabs
                  value={quien}
                  onChange={setQuien}
                  items={[
                    { value: 'cliente', label: 'Cliente' },
                    { value: 'entrenador', label: 'Entrenador' },
                  ]}
                />
              </div>
              {quien === 'entrenador' ? (
                <select className="input" value={entrenadorId} onChange={(e) => setEntrenadorId(e.target.value)}>
                  <option value="">Elige un entrenador…</option>
                  {entrenadores?.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre} {e.apellido} · {e.estado}
                    </option>
                  ))}
                </select>
              ) : socio ? (
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <ScanFace className="h-6 w-6 text-flame-500" />
                  <p className="flex-1 font-bold text-white">
                    {socio.nombre} {socio.apellido} <span className="text-steel-500">#{socio.codigo}</span>
                  </p>
                  <button className="text-xs text-steel-500 hover:text-white" onClick={() => setSocio(null)}>
                    cambiar
                  </button>
                </div>
              ) : (
                <SocioPicker onPick={setSocio} placeholder="¿Quién se para frente al lector? (busca el cliente)" />
              )}
              <div className="mt-3 flex gap-2">
                <button
                  className="btn-primary flex-1"
                  disabled={(quien === 'cliente' ? !socio : !entrenadorId) || escanear.isPending}
                  onClick={() => (quien === 'cliente' ? socio && escanear.mutate({ socioId: socio.id }) : escanear.mutate({ entrenadorId }))}
                >
                  <ScanFace className="h-4 w-4" /> Mirar al lector
                </button>
                <button className="btn-ghost" disabled={escanear.isPending} onClick={() => escanear.mutate({ desconocido: true })}>
                  <UserX className="h-4 w-4" /> Desconocido
                </button>
              </div>
              {ultimo && (
                <div className={cx('mt-4 flex animate-pop items-center gap-3 rounded-2xl border p-4', ultimo.resultado === 'permitido' ? 'border-ok/30 bg-ok/[0.07]' : 'border-bad/30 bg-bad/[0.07]')}>
                  {ultimo.resultado === 'permitido' ? <CircleCheck className="h-8 w-8 text-ok" /> : <CircleX className="h-8 w-8 text-bad" />}
                  <div className="flex-1">
                    <p className="font-bold text-white">{ultimo.socio?.nombre ?? ultimo.entrenador?.nombre ?? 'Persona desconocida'}</p>
                    <p className="text-sm text-steel-400">{ultimo.motivo}</p>
                    {ultimo.alerta && <p className="text-xs text-warn">{ultimo.alerta}</p>}
                    {ultimo.pantalla && <p className="mt-1 text-xs text-steel-500">Pantalla del lector: “{ultimo.pantalla}”</p>}
                  </div>
                  <span className={cx('chip', ultimo.puerta === 'abierta' ? 'border-ok/40 text-ok' : 'border-bad/40 text-bad')}>Puerta {ultimo.puerta}</span>
                </div>
              )}
            </div>
            <div>
              <p className="label">Fichas dentro del lector simulado ({mockUsers?.length ?? 0})</p>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {mockUsers?.map((u) => {
                  const vigente = u.validity.endTime >= new Date().toISOString().slice(0, 19);
                  return (
                    <div key={u.employeeNo} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm odd:bg-white/[0.02]">
                      <span className="tnum w-12 text-steel-500">{u.employeeNo}</span>
                      <span className="flex-1 truncate text-steel-200">{u.name}</span>
                      <span className={cx('text-xs', u.hasFace ? 'text-ok' : 'text-steel-600')}>{u.hasFace ? 'rostro' : 'sin rostro'}</span>
                      <span className={cx('tnum text-xs', vigente ? 'text-steel-400' : 'text-bad')}>hasta {u.validity.endTime.slice(0, 10)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <p className="font-display font-extrabold text-white">Cola de sincronización</p>
          <button className="btn-ghost btn-sm" disabled={reintentar.isPending} onClick={() => reintentar.mutate()}>
            <RotateCcw className="h-4 w-4" /> Reintentar fallidas
          </button>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Operación</th>
                <th>Estado</th>
                <th>Intentos</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {!cola?.length && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-steel-500">
                    <Unplug className="mx-auto mb-2 h-6 w-6" /> Nada en cola
                  </td>
                </tr>
              )}
              {cola?.map((c) => (
                <tr key={c.id}>
                  <td className="font-bold text-steel-100">
                    {c.socio ?? '—'} {c.codigo && <span className="text-xs text-steel-500">#{c.codigo}</span>}
                  </td>
                  <td className="text-steel-400">{opLabel[c.operacion] ?? c.operacion}</td>
                  <td>
                    <span className={cx('chip', estadoCls[c.estado])}>{c.estado}</span>
                  </td>
                  <td className="tnum text-steel-400">{c.intentos}</td>
                  <td className="max-w-[340px] truncate text-xs text-steel-500" title={c.ultimoError ?? ''}>
                    {c.ultimoError ?? (c.estado === 'ok' ? `Enviado ${hace(c.actualizadoEn)}` : c.estado === 'error' ? `Próximo intento ${fechaHora(c.proximoIntento)}` : '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
