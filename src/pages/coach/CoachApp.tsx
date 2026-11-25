/**
 * App de entrenadores (web y móvil): sus clases, sus clientes, sus rutinas y su perfil.
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Award, CalendarDays, ChevronRight, ClipboardCopy, Dumbbell, Home, KeyRound, LayoutTemplate, LogOut, UserRound, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AppShell, ChipAlerta, Seccion, Titulo, useManifiesto, type ItemNav } from '../../components/app/AppUI';
import { Avatar, cx, Field, Loading } from '../../components/ui';
import { apiCoach, sesionCoach } from '../../lib/api';
import { ClasesCoach, ClaseDrawer, Plantillas } from './CoachClases';
import { ClienteDetalle, ClientesCoach } from './CoachClientes';
import { PersonalizadosCoach } from './CoachPersonalizados';
import { diaCorto, type Alerta, type ClaseCoach } from './tipos';

const NAV: ItemNav[] = [
  { to: '/coach', label: 'Inicio', icon: Home, end: true },
  { to: '/coach/clientes', label: 'Clientes', icon: Users },
  { to: '/coach/clases', label: 'Clases', icon: CalendarDays },
  { to: '/coach/rutinas', label: 'Rutinas', icon: LayoutTemplate },
  { to: '/coach/perfil', label: 'Perfil', icon: UserRound },
];

export default function CoachApp() {
  useManifiesto('/coach.webmanifest');
  const s = sesionCoach.datos;
  if (!sesionCoach.token || !s) return <Navigate to="/login" replace />;
  return (
    <AppShell
      nav={NAV}
      marca={
        <Link to="/coach" className="flex items-center gap-2.5">
          <img src="/logo-full.png" alt="Merkgusto" className="h-9 w-auto" />
          <span className="rounded-md bg-flame-500/15 px-2 py-1 font-display text-[10px] font-extrabold uppercase tracking-[0.2em] text-flame-400">Coach</span>
        </Link>
      }
      cuenta={
        <Link to="/coach/perfil" className="flex items-center gap-2.5 rounded-xl lg:border lg:border-white/[0.06] lg:p-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-flame-500/15 font-display text-sm font-extrabold text-flame-300">{s.nombre[0]}</span>
          <span className="hidden min-w-0 lg:block">
            <span className="block truncate text-sm font-bold text-steel-100">{s.nombre}</span>
            <span className="text-[11px] uppercase tracking-wider text-steel-500">Entrenador</span>
          </span>
        </Link>
      }
    >
      <Routes>
        <Route index element={<Inicio />} />
        <Route path="clientes" element={<ClientesCoach />} />
        <Route path="clientes/:id" element={<ClienteDetalle />} />
        <Route path="personalizados" element={<PersonalizadosCoach />} />
        <Route path="clases" element={<ClasesCoach />} />
        <Route path="rutinas" element={<Plantillas />} />
        <Route path="perfil" element={<Perfil />} />
        <Route path="*" element={<Navigate to="/coach" replace />} />
      </Routes>
    </AppShell>
  );
}

interface InicioCoach {
  hoy: ClaseCoach[];
  semana: ClaseCoach[];
  clientes: { total: number; alDia: number; vencen: number; ausentes: number; sinRutina: number; entrenaronSemana: number };
  personalizados?: { alDia: number; vencen: number; vencidos: number; deben: number; sinPago: number };
  alertas: Array<{ id: string; nombre: string; tieneFoto: boolean; alertas: Alerta[] }>;
}

function Inicio() {
  const s = sesionCoach.datos!;
  const { data, isLoading } = useQuery({ queryKey: ['coach-inicio'], queryFn: () => apiCoach<InicioCoach>('/inicio'), refetchInterval: 60_000 });
  const [clase, setClase] = useState<number | null>(null);
  if (isLoading || !data) return <Loading />;
  const c = data.clientes;
  const h = new Date().getHours();
  return (
    <div className="animate-rise">
      <p className="text-sm text-steel-400">{h < 12 ? 'Buenos días,' : h < 19 ? 'Buenas tardes,' : 'Buenas noches,'}</p>
      <h1 className="mb-5 font-wide text-3xl text-white">{s.nombre.split(' ')[0]} 🔥</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cifra valor={c.total} etiqueta="clientes" to="/coach/clientes" />
        <Cifra valor={c.alDia} etiqueta="al día" color="text-ok" />
        <Cifra valor={c.entrenaronSemana} etiqueta="entrenaron esta semana" color="text-flame-400" />
        <Cifra valor={c.vencen + c.ausentes} etiqueta="necesitan atención" color={c.vencen + c.ausentes ? 'text-warn' : 'text-steel-300'} to="/coach/clientes?filtro=alertas" />
      </div>

      {data.personalizados && data.personalizados.alDia + data.personalizados.vencen + data.personalizados.vencidos + data.personalizados.deben > 0 && (
        <Link to="/coach/personalizados" className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-flame-500/25 bg-flame-500/[0.05] p-4 transition hover:bg-flame-500/[0.09]">
          <Award className="h-6 w-6 text-flame-400" />
          <span className="min-w-0 flex-1">
            <span className="block font-display font-extrabold text-white">Tus personalizados</span>
            <span className="text-sm text-steel-300">
              <b className="text-ok">{data.personalizados.alDia} pagaron</b>
              {data.personalizados.vencen > 0 && <> · <b className="text-warn">{data.personalizados.vencen} vencen pronto</b></>}
              {data.personalizados.vencidos + data.personalizados.deben > 0 && <> · <b className="text-bad">{data.personalizados.vencidos + data.personalizados.deben} por cobrar</b></>}
            </span>
          </span>
          <span className="text-xs font-bold text-flame-400">Ver quién pagó y lo que te toca →</span>
        </Link>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Seccion titulo="Tus clases de hoy" icono={<CalendarDays className="h-5 w-5 text-flame-500" />} accion={<Link to="/coach/clases" className="text-xs font-bold text-flame-400">Semana →</Link>}>
          {data.hoy.length === 0 ? (
            <p className="text-sm text-steel-400">Hoy no tienes clases. {data.semana[0] && `La próxima: ${data.semana[0].nombre}, ${diaCorto(data.semana[0].dia)} a las ${data.semana[0].hora}.`}</p>
          ) : (
            <div className="space-y-2">
              {data.hoy.map((k) => (
                <button key={k.id} onClick={() => setClase(k.id)} className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.03] p-3 text-left transition hover:bg-white/[0.06]">
                  <span className="grid h-12 w-14 shrink-0 place-items-center rounded-xl font-wide text-sm text-white" style={{ background: `${k.color}33` }}>
                    {k.hora}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-steel-100">{k.nombre}</span>
                    <span className="text-xs text-steel-500">
                      {k.inscritos}
                      {k.cupo ? `/${k.cupo}` : ''} inscritos · {k.asistieron} llegaron
                    </span>
                  </span>
                  <span className="chip border-flame-500/30 text-flame-300">Pasar lista</span>
                </button>
              ))}
            </div>
          )}
          {data.semana.length > 0 && (
            <div className="mt-4 border-t border-white/[0.05] pt-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-steel-500">Esta semana</p>
              <div className="space-y-1.5">
                {data.semana.slice(0, 5).map((k) => (
                  <button key={k.id} onClick={() => setClase(k.id)} className="flex w-full items-center gap-3 text-left text-sm">
                    <span className="h-5 w-1 rounded-full" style={{ background: k.color }} />
                    <span className="w-24 shrink-0 text-steel-500">
                      {diaCorto(k.dia)} {k.hora}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-bold text-steel-200">{k.nombre}</span>
                    <span className="text-xs text-steel-500">
                      {k.inscritos}
                      {k.cupo ? `/${k.cupo}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Seccion>

        <Seccion titulo="Clientes que necesitan atención" icono={<AlertTriangle className="h-5 w-5 text-warn" />}>
          {data.alertas.length === 0 ? (
            <p className="text-sm text-steel-400">{c.total ? '¡Todo en orden! Tus clientes están al día y entrenando.' : 'Aún no tienes clientes. Agrégalos desde Clientes.'}</p>
          ) : (
            <div className="space-y-1">
              {data.alertas.map((a) => (
                <Link key={a.id} to={`/coach/clientes/${a.id}`} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/[0.04]">
                  <Avatar socioId={a.id} nombre={a.nombre} tieneFoto={a.tieneFoto} size={38} token={sesionCoach.token} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-steel-100">{a.nombre}</span>
                    <span className="mt-0.5 flex flex-wrap gap-1">
                      {a.alertas.slice(0, 2).map((x) => (
                        <ChipAlerta key={x.tipo} {...x} />
                      ))}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-steel-600" />
                </Link>
              ))}
            </div>
          )}
        </Seccion>
      </div>

      {c.sinRutina > 0 && (
        <Link to="/coach/clientes?filtro=sin_rutina" className="mt-4 flex items-center gap-3 rounded-2xl border border-flame-500/25 bg-flame-500/[0.05] p-4">
          <Dumbbell className="h-5 w-5 text-flame-400" />
          <span className="flex-1 text-sm text-steel-200">
            <b>{c.sinRutina}</b> cliente(s) sin rutina. Asígnales una con tus plantillas en un toque.
          </span>
          <ChevronRight className="h-4 w-4 text-steel-500" />
        </Link>
      )}
      {clase && <ClaseDrawer id={clase} onClose={() => setClase(null)} />}
    </div>
  );
}

function Cifra({ valor, etiqueta, color = 'text-white', to }: { valor: number; etiqueta: string; color?: string; to?: string }) {
  const contenido = (
    <>
      <p className={cx('tnum font-wide text-3xl', color)}>{valor}</p>
      <p className="text-xs leading-tight text-steel-500">{etiqueta}</p>
    </>
  );
  return to ? (
    <Link to={to} className="card card-hover p-4">
      {contenido}
    </Link>
  ) : (
    <div className="card p-4">{contenido}</div>
  );
}

function Perfil() {
  const nav = useNavigate();
  const { data: yo } = useQuery({ queryKey: ['coach-yo'], queryFn: () => apiCoach<{ nombre: string; apellido: string; especialidad: string | null; usuario: string; codigo: number }>('/yo') });
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const cambiar = useMutation({
    mutationFn: () => apiCoach<{ token: string }>('/password', { body: { actual, nueva } }),
    onSuccess: (r) => {
      sesionCoach.save(r.token, sesionCoach.datos!);
      toast.success('Contraseña cambiada');
      setActual('');
      setNueva('');
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const salir = () => {
    sesionCoach.clear();
    nav('/login', { replace: true });
  };
  const enlaceClientes = `${window.location.origin}/cliente`;
  return (
    <div className="animate-rise">
      <Titulo kicker="Tu cuenta">Perfil</Titulo>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <p className="font-display text-xl font-extrabold text-white">
            {yo?.nombre} {yo?.apellido}
          </p>
          <p className="text-sm text-steel-500">
            {yo?.especialidad ?? 'Entrenador'} · usuario <b className="text-steel-300">{yo?.usuario}</b>
          </p>
          <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-sm font-bold text-steel-100">La app de tus clientes</p>
            <p className="mt-1 text-xs text-steel-500">Compárteles esta dirección: entran con su cédula y ven sus días, su progreso y la rutina que les asignes.</p>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-ink-950/60 px-3 py-2">
              <code className="min-w-0 flex-1 truncate text-xs text-steel-300">{enlaceClientes}</code>
              <button className="text-steel-400 hover:text-flame-400" onClick={() => void navigator.clipboard?.writeText(enlaceClientes).then(() => toast.success('Copiado'))}>
                <ClipboardCopy className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
        <section className="card p-5">
          <p className="flex items-center gap-2 font-display font-extrabold text-white">
            <KeyRound className="h-5 w-5 text-flame-500" /> Cambiar contraseña
          </p>
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              cambiar.mutate();
            }}
          >
            <Field label="Contraseña actual">
              <input className="input" type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} />
            </Field>
            <Field label="Nueva (mínimo 6)">
              <input className="input" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
            </Field>
            <button className="btn-primary w-full" disabled={!actual || nueva.length < 6 || cambiar.isPending}>
              Guardar
            </button>
          </form>
        </section>
      </div>
      <button className="btn-ghost mt-4 w-full lg:w-auto" onClick={salir}>
        <LogOut className="h-4 w-4" /> Salir
      </button>
    </div>
  );
}
