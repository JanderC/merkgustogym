/**
 * App del cliente (web y móvil): sus días, su progreso, su rutina, sus clases y su cuenta.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarCheck,
  CalendarDays,
  Check,
  Clock,
  Download,
  Dumbbell,
  Flame,
  HandCoins,
  Home,
  Instagram,
  KeyRound,
  LineChart,
  LogOut,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Ruler,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trophy,
  UserRound,
  Users,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AnilloDias, AppShell, MedicionModal, num, ProgresoResumen, RutinaEditor, RutinaVista, Seccion, Titulo, useManifiesto, type ItemNav, type RutinaBase } from '../../components/app/AppUI';
import { Cambio, type Medicion, type Rutina } from '../../components/Progreso';
import { cx, Field, Loading } from '../../components/ui';
import { apiCliente, sesionCliente } from '../../lib/api';
import { fecha, fechaCorta, hace, hora, hoyISO } from '../../lib/format';

type MedicionApp = Medicion & { autor: 'equipo' | 'entrenador' | 'cliente'; entrenador: string | null };
type RutinaApp = Rutina & { autor: 'equipo' | 'entrenador' | 'cliente' };
interface Yo {
  socio: { nombre: string; apellido: string; codigo: number; activo: boolean; cedula: string };
  privado: boolean;
  via: 'cedula' | 'clave' | 'enlace';
  entrenador: { nombre: string | null; especialidad: string | null; telefono: string | null } | null;
  gym: { nombre: string; slogan: string; horario: string; telefono: string; instagram: string; direccion: string };
  vigencia: { vigente: boolean; desde: string | null; hasta: string | null; ultimaFin: string | null; plan: string | null; diasRestantes: number; congelada: { desde: string; dias: number } | null };
  membresias: Array<{ id: string; plan: string; color: string; fechaInicio: string; fechaFin: string; estado: string }>;
  asistencias: { ultimas: string[]; esteMes: number; total: number };
  clases: Array<{ id: number; nombre: string; inicio: string; duracionMin: number; color: string; reservadoPorSocio: boolean; entrenador: string | null }>;
  mediciones: MedicionApp[];
  rutina: RutinaApp | null;
  entrenos: { lista: Array<{ id: number; fecha: string; dia: string; rutinaId: number | null }>; hoy: string[]; estaSemana: number; racha: number };
  deuda: string | null;
}
interface ClaseApp {
  id: number;
  nombre: string;
  descripcion: string | null;
  dia: string;
  hora: string;
  inicio: string;
  duracionMin: number;
  color: string;
  nivel: string | null;
  entrenador: string | null;
  cupo: number | null;
  inscritos: number;
  libres: number | null;
  inscrito: boolean;
  reservadoPorMi: boolean;
  asistio: boolean;
}

const useYo = () => useQuery({ queryKey: ['cliente-yo'], queryFn: () => apiCliente<Yo>('/yo'), refetchOnWindowFocus: true });
const diasEntre = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000) + 1;
const whatsapp = (tel: string) => `https://wa.me/${tel.replace(/\D/g, '').replace(/^0/, '58')}`;

// Instalar en el teléfono (Android/Chrome)
type EventoInstalar = Event & { prompt: () => Promise<void> };
let eventoInstalar: EventoInstalar | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    eventoInstalar = e as EventoInstalar;
  });
}

const NAV: ItemNav[] = [
  { to: '/cliente/app', label: 'Inicio', icon: Home, end: true },
  { to: '/cliente/app/progreso', label: 'Progreso', icon: LineChart },
  { to: '/cliente/app/rutina', label: 'Rutina', icon: Dumbbell },
  { to: '/cliente/app/clases', label: 'Clases', icon: CalendarDays },
  { to: '/cliente/app/cuenta', label: 'Cuenta', icon: UserRound },
];

export default function ClienteApp() {
  useManifiesto('/cliente.webmanifest');
  const { data: yo, isLoading, error } = useYo();
  if (!sesionCliente.token) return <Navigate to="/cliente" replace />;
  if (isLoading) return <Loading />;
  if (error || !yo) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <p className="font-wide text-xl text-white">No se pudo cargar</p>
          <p className="mt-2 text-steel-400">{(error as Error | null)?.message}</p>
          <button className="btn-primary mt-6" onClick={() => (sesionCliente.clear(), window.location.assign('/cliente'))}>
            Volver a entrar
          </button>
        </div>
      </div>
    );
  }
  return (
    <AppShell
      nav={NAV}
      marca={
        <Link to="/cliente/app" className="flex items-center gap-2.5">
          <img src="/logo-full.png" alt="Merkgusto" className="h-9 w-auto" />
        </Link>
      }
      cuenta={
        <Link to="/cliente/app/cuenta" className="flex items-center gap-2.5 rounded-xl lg:border lg:border-white/[0.06] lg:p-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-flame-500/15 font-display text-sm font-extrabold text-flame-300">{yo.socio.nombre[0]}</span>
          <span className="hidden min-w-0 lg:block">
            <span className="block truncate text-sm font-bold text-steel-100">
              {yo.socio.nombre} {yo.socio.apellido}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-steel-500">
              {yo.privado ? <ShieldCheck className="h-3 w-3 text-ok" /> : <ShieldAlert className="h-3 w-3 text-warn" />} {yo.privado ? 'Cuenta privada' : 'Sin clave'}
            </span>
          </span>
        </Link>
      }
    >
      <Routes>
        <Route index element={<Inicio yo={yo} />} />
        <Route path="progreso" element={<Progreso yo={yo} />} />
        <Route path="rutina" element={<MiRutina yo={yo} />} />
        <Route path="clases" element={<Clases />} />
        <Route path="cuenta" element={<Cuenta yo={yo} />} />
        <Route path="*" element={<Navigate to="/cliente/app" replace />} />
      </Routes>
    </AppShell>
  );
}

// ═════════════ Inicio ═════════════
function Inicio({ yo }: { yo: Yo }) {
  const v = yo.vigencia;
  const total = v.vigente && v.desde && v.hasta ? diasEntre(v.desde, v.hasta) : 30;
  const poco = v.vigente && v.diasRestantes <= 5;
  const color = !v.vigente ? '#F05252' : poco ? '#F5A524' : '#2ED47A';
  const meds = yo.mediciones;
  const conPeso = meds.filter((m) => m.peso != null);
  const ultimoPeso = conPeso[0];
  const primerPeso = conPeso[conPeso.length - 1];
  const r = yo.rutina;
  // Qué día de la rutina le toca: el siguiente al último que marcó
  const ultimoDia = r ? yo.entrenos.lista.find((e) => e.rutinaId === r.id) : null;
  const idx = r && ultimoDia ? (r.dias.findIndex((d) => d.nombre === ultimoDia.dia) + 1) % r.dias.length : 0;
  const tocaHoy = r?.dias[idx];
  const yaEntreno = yo.entrenos.hoy.length > 0;

  return (
    <div className="animate-rise">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-steel-400">{saludo()}</p>
          <h1 className="font-wide text-3xl text-white">{yo.socio.nombre} 💪</h1>
        </div>
        {yo.entrenador && (
          <div className="hidden items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 sm:flex">
            <Dumbbell className="h-4 w-4 text-flame-400" />
            <span className="text-xs text-steel-400">
              Tu entrenador
              <b className="block text-sm text-steel-100">{yo.entrenador.nombre}</b>
            </span>
          </div>
        )}
      </div>

      {!yo.privado && (
        <Link to="/cliente/app/cuenta" className="mb-4 flex items-center gap-3 rounded-2xl border border-warn/25 bg-warn/[0.06] p-3.5 text-sm">
          <ShieldAlert className="h-5 w-5 shrink-0 text-warn" />
          <span className="flex-1 text-steel-300">
            Cualquiera con tu cédula puede ver tu información. <b className="text-warn">Protégela con una clave →</b>
          </span>
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        {/* Plan */}
        <section className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-br from-ink-800 to-ink-900 p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-[70px]" style={{ background: `${color}22` }} />
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-steel-400">
            <CalendarCheck className="h-4 w-4" /> Tu plan
          </p>
          <div className="mt-4 flex items-center gap-5">
            {v.congelada ? (
              <div className="py-6">
                <p className="font-wide text-2xl text-sky-300">Congelado</p>
                <p className="text-steel-400">desde el {fecha(v.congelada.desde)}</p>
              </div>
            ) : (
              <AnilloDias restantes={v.vigente ? v.diasRestantes : 0} total={total} color={color} size={140} />
            )}
            <div className="min-w-0">
              {v.vigente ? (
                <>
                  <p className="font-display text-xl font-extrabold text-white">{v.plan}</p>
                  <p className="text-sm text-steel-400">Hasta el {fecha(v.hasta)}</p>
                  <p className={cx('mt-3 text-sm font-bold', poco ? 'text-warn' : 'text-ok')}>{poco ? 'Se acaba pronto: renueva en recepción para no perder tus días.' : '¡Estás al día!'}</p>
                </>
              ) : (
                <>
                  <p className="font-display text-xl font-extrabold text-bad">{v.desde ? `Empieza el ${fecha(v.desde)}` : 'Sin plan vigente'}</p>
                  {v.ultimaFin && <p className="text-sm text-steel-400">Tu último plan venció el {fecha(v.ultimaFin)}</p>}
                  <p className="mt-3 text-sm text-steel-300">Renueva en recepción para seguir entrenando.</p>
                </>
              )}
            </div>
          </div>
          {yo.deuda && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-warn/10 px-3 py-2 text-sm text-warn">
              <HandCoins className="h-4 w-4" /> Saldo pendiente: {yo.deuda}
            </p>
          )}
        </section>

        {/* Números */}
        <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
          <Numero icono={<Flame className="h-4 w-4" />} valor={yo.asistencias.esteMes} etiqueta={`entrada${yo.asistencias.esteMes === 1 ? '' : 's'} este mes`} />
          <Numero icono={<Trophy className="h-4 w-4" />} valor={yo.entrenos.racha} etiqueta={`semana${yo.entrenos.racha === 1 ? '' : 's'} seguidas`} />
          <Numero icono={<Clock className="h-4 w-4" />} valor={yo.asistencias.ultimas[0] ? fechaCorta(yo.asistencias.ultimas[0]) : '—'} etiqueta={yo.asistencias.ultimas[0] ? `última vez · ${hora(yo.asistencias.ultimas[0])}` : 'aún sin entradas'} chico />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Hoy toca */}
        <Seccion titulo="Hoy te toca" icono={<Dumbbell className="h-5 w-5 text-flame-500" />} accion={r && <Link to="/cliente/app/rutina" className="text-xs font-bold text-flame-400">Ver rutina →</Link>}>
          {!r ? (
            <p className="text-sm text-steel-400">
              Aún no tienes rutina. Pídela a tu entrenador o{' '}
              <Link to="/cliente/app/rutina" className="font-bold text-flame-400">
                crea la tuya
              </Link>
              .
            </p>
          ) : yaEntreno ? (
            <div className="flex items-center gap-3 rounded-2xl bg-ok/10 p-4">
              <Check className="h-6 w-6 text-ok" />
              <p className="text-sm text-steel-200">
                ¡Hoy ya entrenaste <b>{yo.entrenos.hoy.join(', ')}</b>! Llevas {yo.entrenos.estaSemana} día(s) esta semana.
              </p>
            </div>
          ) : (
            tocaHoy && (
              <Link to="/cliente/app/rutina" className="block rounded-2xl border border-flame-500/25 bg-flame-500/[0.06] p-4 transition hover:border-flame-500/50">
                <p className="text-xs font-bold uppercase tracking-wider text-flame-400">{r.titulo}</p>
                <p className="mt-1 font-display text-lg font-extrabold text-white">{tocaHoy.nombre}</p>
                <p className="mt-1 truncate text-sm text-steel-400">{tocaHoy.ejercicios.map((e) => e.nombre).join(' · ')}</p>
              </Link>
            )
          )}
        </Seccion>

        {/* Peso */}
        <Seccion titulo="Tu peso" icono={<LineChart className="h-5 w-5 text-flame-500" />} accion={<Link to="/cliente/app/progreso" className="text-xs font-bold text-flame-400">Ver progreso →</Link>}>
          {ultimoPeso ? (
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="tnum font-wide text-4xl text-white">
                  {num(ultimoPeso.peso)} <span className="text-lg text-steel-500">kg</span>
                </p>
                <p className="text-xs text-steel-500">
                  {fecha(ultimoPeso.fecha)} {conPeso.length > 1 && <Cambio actual={ultimoPeso.peso} inicial={primerPeso.peso} unidad="kg" />}
                  {conPeso.length > 1 && ` desde el ${fechaCorta(primerPeso.fecha)}`}
                </p>
              </div>
              <Link to="/cliente/app/progreso?anotar=1" className="btn-ghost btn-sm">
                <Plus className="h-4 w-4" /> Anotar
              </Link>
            </div>
          ) : (
            <Link to="/cliente/app/progreso?anotar=1" className="flex items-center gap-3 rounded-2xl border border-dashed border-white/15 p-4 text-sm text-steel-300 hover:border-flame-500/40">
              <Ruler className="h-5 w-5 text-flame-400" /> Anota tu peso de hoy para empezar a ver tu avance
            </Link>
          )}
        </Seccion>
      </div>

      {/* Clases */}
      <Seccion className="mt-4" titulo="Tus próximas clases" icono={<CalendarDays className="h-5 w-5 text-flame-500" />} accion={<Link to="/cliente/app/clases" className="text-xs font-bold text-flame-400">Reservar →</Link>}>
        {yo.clases.length === 0 ? (
          <p className="text-sm text-steel-400">No tienes clases reservadas esta semana.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {yo.clases.slice(0, 4).map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-3">
                <span className="h-10 w-1.5 rounded-full" style={{ background: c.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-steel-100">{c.nombre}</p>
                  <p className="text-xs text-steel-500">
                    {fechaCorta(c.inicio)} · {hora(c.inicio)}
                    {c.entrenador && ` · ${c.entrenador}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Seccion>

      {yo.entrenador?.telefono && (
        <a href={whatsapp(yo.entrenador.telefono)} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-3 rounded-2xl border border-ok/20 bg-ok/[0.05] p-4 sm:hidden">
          <MessageCircle className="h-5 w-5 text-ok" />
          <span className="flex-1 text-sm text-steel-200">
            Escríbele a tu entrenador <b>{yo.entrenador.nombre}</b>
          </span>
        </a>
      )}

      <Gym yo={yo} />
    </div>
  );
}

function saludo() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días,' : h < 19 ? 'Buenas tardes,' : 'Buenas noches,';
}

function Numero({ icono, valor, etiqueta, chico }: { icono: ReactNode; valor: ReactNode; etiqueta: string; chico?: boolean }) {
  return (
    <div className="card flex flex-col justify-center p-4">
      <span className="text-flame-400">{icono}</span>
      <p className={cx('tnum mt-1 font-wide text-white', chico ? 'text-lg' : 'text-3xl')}>{valor}</p>
      <p className="text-[11px] leading-tight text-steel-500">{etiqueta}</p>
    </div>
  );
}

function Gym({ yo }: { yo: Yo }) {
  const g = yo.gym;
  return (
    <footer className="mt-8 grid gap-2 text-sm text-steel-500 sm:grid-cols-2">
      {g.horario && (
        <p className="flex gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" /> {g.horario}
        </p>
      )}
      {g.direccion && (
        <p className="flex gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {g.direccion}
        </p>
      )}
      {g.telefono && (
        <p className="flex gap-2">
          <Phone className="mt-0.5 h-4 w-4 shrink-0" /> {g.telefono}
        </p>
      )}
      {g.instagram && (
        <p className="flex gap-2">
          <Instagram className="mt-0.5 h-4 w-4 shrink-0" /> {g.instagram}
        </p>
      )}
    </footer>
  );
}

// ═════════════ Progreso ═════════════
function Progreso({ yo }: { yo: Yo }) {
  const qc = useQueryClient();
  const [anotar, setAnotar] = useState(() => new URLSearchParams(window.location.search).has('anotar'));
  const refrescar = () => void qc.invalidateQueries({ queryKey: ['cliente-yo'] });
  const borrar = useMutation({ mutationFn: (id: number) => apiCliente(`/mediciones/${id}`, { method: 'DELETE' }), onSuccess: refrescar, onError: (e: Error) => toast.error(e.message) });
  return (
    <div className="animate-rise">
      <Titulo
        kicker="Tu avance"
        accion={
          <button className="btn-primary" onClick={() => setAnotar(true)}>
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Anotar mi</span> peso
          </button>
        }
      >
        Progreso
      </Titulo>
      {yo.mediciones.length === 0 ? (
        <div className="card p-8 text-center">
          <Ruler className="mx-auto h-10 w-10 text-flame-500" />
          <p className="mt-3 font-display text-lg font-extrabold text-white">Empieza hoy</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-steel-400">Anota tu peso (y si quieres tus medidas). Cada vez que lo hagas verás tu avance en una gráfica.</p>
          <button className="btn-primary mt-5" onClick={() => setAnotar(true)}>
            <Plus className="h-4 w-4" /> Anotar mi peso
          </button>
        </div>
      ) : (
        <div className="card p-5">
          <ProgresoResumen mediciones={yo.mediciones} onBorrar={(id) => borrar.mutate(id)} puedeBorrar={(m) => m.autor === 'cliente'} />
        </div>
      )}
      <p className="mt-3 text-xs text-steel-600">Tu entrenador ve tus medidas para ajustar tu rutina. Las que anota él no se pueden borrar desde aquí.</p>
      {anotar && (
        <MedicionModal
          titulo="Anotar mi peso"
          anterior={yo.mediciones[0]}
          onClose={() => {
            setAnotar(false);
            window.history.replaceState(null, '', '/cliente/app/progreso');
          }}
          guardar={async (b) => {
            await apiCliente('/mediciones', { body: b });
            toast.success('¡Anotado! Sigue así 💪');
            refrescar();
          }}
        />
      )}
    </div>
  );
}

// ═════════════ Rutina ═════════════
function MiRutina({ yo }: { yo: Yo }) {
  const qc = useQueryClient();
  const [editar, setEditar] = useState<RutinaBase | 'nueva' | null>(null);
  const [historial, setHistorial] = useState(false);
  const { data: todas } = useQuery({ queryKey: ['cliente-rutinas'], queryFn: () => apiCliente<RutinaApp[]>('/rutinas'), enabled: historial });
  const refrescar = () => {
    void qc.invalidateQueries({ queryKey: ['cliente-yo'] });
    void qc.invalidateQueries({ queryKey: ['cliente-rutinas'] });
  };
  const marcar = useMutation({
    mutationFn: ({ dia, hecho }: { dia: string; hecho: boolean }) =>
      hecho ? apiCliente('/entrenos', { body: { dia, rutinaId: yo.rutina?.id ?? null } }) : apiCliente(`/entrenos?dia=${encodeURIComponent(dia)}`, { method: 'DELETE' }),
    onSuccess: (_r, v) => {
      if (v.hecho) toast.success('¡Bien hecho! 🔥', { description: 'Día marcado. Tu entrenador lo verá.' });
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const activar = useMutation({ mutationFn: (id: number) => apiCliente(`/rutinas/${id}/activar`, { body: {} }), onSuccess: () => (toast.success('Rutina activada'), refrescar()), onError: (e: Error) => toast.error(e.message) });
  const r = yo.rutina;

  return (
    <div className="animate-rise">
      <Titulo
        kicker="Tu entrenamiento"
        accion={
          <button className="btn-ghost" onClick={() => setEditar('nueva')}>
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Crear mi rutina</span>
            <span className="sm:hidden">Nueva</span>
          </button>
        }
      >
        Rutina
      </Titulo>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="card flex items-center gap-3 p-4">
          <Trophy className="h-8 w-8 text-flame-500" />
          <div>
            <p className="tnum font-wide text-2xl text-white">{yo.entrenos.racha}</p>
            <p className="text-xs text-steel-500">semana{yo.entrenos.racha === 1 ? '' : 's'} seguidas entrenando</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <Flame className="h-8 w-8 text-flame-500" />
          <div>
            <p className="tnum font-wide text-2xl text-white">{yo.entrenos.estaSemana}</p>
            <p className="text-xs text-steel-500">día(s) hechos esta semana</p>
          </div>
        </div>
      </div>

      {!r ? (
        <div className="card p-8 text-center">
          <Dumbbell className="mx-auto h-10 w-10 text-flame-500" />
          <p className="mt-3 font-display text-lg font-extrabold text-white">Aún no tienes rutina</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-steel-400">Tu entrenador te la puede asignar desde su app, o puedes crear la tuya ahora.</p>
          <button className="btn-primary mt-5" onClick={() => setEditar('nueva')}>
            <Plus className="h-4 w-4" /> Crear mi rutina
          </button>
        </div>
      ) : (
        <section className="card p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-xl font-extrabold text-white">{r.titulo}</p>
              <p className="text-sm text-steel-500">
                {r.objetivo && `${r.objetivo} · `}
                {r.autor === 'cliente' ? 'Creada por ti' : r.entrenador ? `De ${r.entrenador}` : 'Del gimnasio'} · {hace(r.actualizadoEn)}
              </p>
            </div>
            {r.autor === 'cliente' && (
              <button className="btn-ghost btn-sm" onClick={() => setEditar(r)}>
                <Pencil className="h-4 w-4" /> Editar
              </button>
            )}
          </div>
          <p className="mb-3 text-xs text-steel-500">Abre el día que vas a hacer y, al terminar, tócalo como hecho.</p>
          <RutinaVista rutina={r} hechos={yo.entrenos.hoy} onMarcar={(dia, hecho) => marcar.mutate({ dia, hecho })} />
        </section>
      )}

      <button className="mt-4 text-sm font-bold text-steel-500 hover:text-flame-400" onClick={() => setHistorial(!historial)}>
        {historial ? 'Ocultar' : 'Ver'} rutinas anteriores
      </button>
      {historial && (
        <div className="mt-2 space-y-2">
          {(todas ?? [])
            .filter((x) => !x.activa)
            .map((x) => (
              <div key={x.id} className="card flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-steel-100">{x.titulo}</p>
                  <p className="text-xs text-steel-500">
                    {x.autor === 'cliente' ? 'Tuya' : x.entrenador ?? 'Del gimnasio'} · {fecha(x.actualizadoEn.slice(0, 10))}
                  </p>
                </div>
                <button className="btn-ghost btn-sm" disabled={activar.isPending} onClick={() => activar.mutate(x.id)}>
                  Usar esta
                </button>
              </div>
            ))}
          {todas && todas.filter((x) => !x.activa).length === 0 && <p className="text-sm text-steel-500">No hay rutinas anteriores.</p>}
        </div>
      )}

      {editar && (
        <RutinaEditor
          titulo={editar === 'nueva' ? 'Mi rutina' : 'Editar mi rutina'}
          inicial={editar === 'nueva' ? null : editar}
          onClose={() => setEditar(null)}
          guardar={async (b) => {
            if (editar !== 'nueva' && editar.id) await apiCliente(`/rutinas/${editar.id}`, { method: 'PUT', body: b });
            else await apiCliente('/rutinas', { body: b });
            toast.success('Rutina guardada');
            refrescar();
          }}
        />
      )}
    </div>
  );
}

// ═════════════ Clases ═════════════
function Clases() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['cliente-clases'], queryFn: () => apiCliente<ClaseApp[]>('/clases') });
  const refrescar = () => {
    void qc.invalidateQueries({ queryKey: ['cliente-clases'] });
    void qc.invalidateQueries({ queryKey: ['cliente-yo'] });
  };
  const reservar = useMutation({
    mutationFn: ({ id, si }: { id: number; si: boolean }) => apiCliente(`/clases/${id}/reservar`, { method: si ? 'POST' : 'DELETE', body: si ? {} : undefined }),
    onSuccess: (_r, v) => (toast.success(v.si ? '¡Cupo reservado!' : 'Reserva cancelada'), refrescar()),
    onError: (e: Error) => (toast.error(e.message), refrescar()),
  });
  const dias = [...new Set((data ?? []).map((c) => c.dia))];
  const nombreDia = (d: string) => (d === hoyISO() ? 'Hoy' : new Date(`${d}T12:00:00`).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'short' }));

  return (
    <div className="animate-rise">
      <Titulo kicker="Esta semana">Clases</Titulo>
      {isLoading ? (
        <Loading />
      ) : !dias.length ? (
        <div className="card p-8 text-center text-steel-400">No hay clases programadas esta semana.</div>
      ) : (
        <div className="space-y-6">
          {dias.map((d) => (
            <div key={d}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-steel-500">{nombreDia(d)}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {data!
                  .filter((c) => c.dia === d)
                  .map((c) => {
                    const lleno = c.libres === 0 && !c.inscrito;
                    return (
                      <div key={c.id} className={cx('card relative overflow-hidden p-4', c.inscrito && 'border-flame-500/40')}>
                        <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: c.color }} />
                        <div className="flex items-start justify-between gap-3 pl-2">
                          <div className="min-w-0">
                            <p className="font-display text-lg font-extrabold text-white">{c.nombre}</p>
                            <p className="text-sm text-steel-400">
                              {c.hora} · {c.duracionMin} min{c.entrenador && ` · ${c.entrenador}`}
                            </p>
                            <p className="mt-1 flex items-center gap-1 text-xs text-steel-500">
                              <Users className="h-3.5 w-3.5" /> {c.cupo ? (c.libres ? `${c.libres} cupo(s) libre(s) de ${c.cupo}` : 'Cupo lleno') : `${c.inscritos} inscrito(s)`}
                              {c.nivel && c.nivel !== 'todos' && ` · ${c.nivel}`}
                            </p>
                          </div>
                          {c.asistio ? (
                            <span className="chip border-ok/30 bg-ok/10 text-ok">Asististe</span>
                          ) : c.inscrito ? (
                            <span className="chip border-flame-500/40 bg-flame-500/10 text-flame-300">Inscrito</span>
                          ) : null}
                        </div>
                        <div className="mt-3 pl-2">
                          {c.asistio ? null : c.reservadoPorMi ? (
                            <button className="btn-ghost btn-sm w-full" disabled={reservar.isPending} onClick={() => reservar.mutate({ id: c.id, si: false })}>
                              Cancelar mi reserva
                            </button>
                          ) : c.inscrito ? (
                            <p className="text-xs text-steel-500">Te inscribió tu entrenador o la recepción.</p>
                          ) : (
                            <button className="btn-primary btn-sm w-full" disabled={lleno || reservar.isPending} onClick={() => reservar.mutate({ id: c.id, si: true })}>
                              {lleno ? 'Sin cupos' : 'Reservar mi cupo'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═════════════ Cuenta ═════════════
function Cuenta({ yo }: { yo: Yo }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [actual, setActual] = useState('');
  const [modo, setModo] = useState<'crear' | 'cambiar' | 'quitar' | null>(null);
  const [puedeInstalar, setPuedeInstalar] = useState(!!eventoInstalar);
  useEffect(() => {
    const h = () => setPuedeInstalar(true);
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  const conEnlace = yo.via === 'enlace';
  const pideActual = yo.privado && !conEnlace;

  const guardar = useMutation({
    mutationFn: () =>
      modo === 'quitar'
        ? apiCliente<{ token: string | null }>('/clave', { method: 'DELETE', body: { actual: actual || undefined } })
        : apiCliente<{ token: string }>('/clave', { body: { nueva, actual: actual || undefined } }),
    onSuccess: (r) => {
      if (r.token) sesionCliente.save(r.token, { nombre: yo.socio.nombre });
      toast.success(modo === 'quitar' ? 'Listo: ahora entras solo con tu cédula' : '¡Tu información ya es privada!', { description: modo === 'quitar' ? undefined : 'Desde ahora te pediremos tu cédula y tu clave.' });
      setModo(null);
      setNueva('');
      setRepetir('');
      setActual('');
      void qc.invalidateQueries({ queryKey: ['cliente-yo'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const salir = () => {
    sesionCliente.clear();
    qc.removeQueries({ queryKey: ['cliente-yo'] });
    nav('/cliente', { replace: true });
  };
  const salirTodo = useMutation({ mutationFn: () => apiCliente('/salir-de-todo', { body: {} }), onSuccess: salir });
  const valida = modo === 'quitar' ? !pideActual || actual.length > 0 : nueva.length >= 4 && nueva === repetir && (!pideActual || actual.length > 0);

  return (
    <div className="animate-rise">
      <Titulo kicker="Tus datos">Cuenta</Titulo>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-flame-500/15 font-wide text-2xl text-flame-300">{yo.socio.nombre[0]}</span>
            <div className="min-w-0">
              <p className="truncate font-display text-xl font-extrabold text-white">
                {yo.socio.nombre} {yo.socio.apellido}
              </p>
              <p className="text-sm text-steel-500">
                Cliente #{yo.socio.codigo} · Cédula {yo.socio.cedula}
              </p>
            </div>
          </div>
          {yo.entrenador && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/[0.03] p-3">
              <Dumbbell className="h-5 w-5 text-flame-400" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-steel-500">Tu entrenador</p>
                <p className="font-bold text-steel-100">
                  {yo.entrenador.nombre}
                  {yo.entrenador.especialidad && <span className="font-normal text-steel-500"> · {yo.entrenador.especialidad}</span>}
                </p>
              </div>
              {yo.entrenador.telefono && (
                <a href={whatsapp(yo.entrenador.telefono)} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
                  <MessageCircle className="h-4 w-4 text-ok" />
                </a>
              )}
            </div>
          )}
          {yo.membresias.length > 0 && (
            <div className="mt-4">
              <p className="label">Tus planes</p>
              <div className="space-y-1.5">
                {yo.membresias.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 text-sm">
                    <span className="h-5 w-1.5 rounded-full" style={{ background: m.color }} />
                    <span className="flex-1 font-bold text-steel-200">{m.plan}</span>
                    <span className="text-xs text-steel-500">
                      {fechaCorta(m.fechaInicio)} → {fechaCorta(m.fechaFin)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Privacidad */}
        <section className={cx('card p-5', yo.privado ? 'border-ok/25' : 'border-warn/25')}>
          <div className="flex items-start gap-3">
            <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-2xl', yo.privado ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn')}>{yo.privado ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}</span>
            <div>
              <p className="font-display text-lg font-extrabold text-white">{yo.privado ? 'Tu información es privada' : 'Información privada'}</p>
              <p className="text-sm text-steel-400">
                {yo.privado
                  ? 'Para entrar se pide tu cédula y tu clave. Si la olvidas, entra con el enlace que te envía tu entrenador.'
                  : 'Ahora cualquiera con tu cédula puede ver tus días, tu peso y tu rutina. Ponle una clave para que solo tú puedas entrar.'}
              </p>
            </div>
          </div>
          {conEnlace && yo.privado && <p className="mt-3 rounded-xl bg-sky-400/10 px-3 py-2 text-xs text-sky-300">Entraste con tu enlace personal: puedes crear una clave nueva sin escribir la anterior.</p>}

          {!modo && (
            <div className="mt-4 flex flex-wrap gap-2">
              {yo.privado ? (
                <>
                  <button className="btn-ghost btn-sm" onClick={() => setModo('cambiar')}>
                    <KeyRound className="h-4 w-4" /> Cambiar clave
                  </button>
                  <button className="btn-ghost btn-sm" onClick={() => setModo('quitar')}>
                    Quitar clave
                  </button>
                </>
              ) : (
                <button className="btn-primary w-full" onClick={() => setModo('crear')}>
                  <KeyRound className="h-4 w-4" /> Proteger con una clave
                </button>
              )}
            </div>
          )}
          {modo && (
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (valida) guardar.mutate();
              }}
            >
              {pideActual && (
                <Field label="Tu clave actual">
                  <input className="input" type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} autoFocus />
                </Field>
              )}
              {modo !== 'quitar' && (
                <>
                  <Field label={modo === 'crear' ? 'Crea tu clave' : 'Clave nueva'} hint="Mínimo 4 caracteres. Puede ser de números o letras.">
                    <input className="input text-lg" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoFocus={!pideActual} />
                  </Field>
                  <Field label="Repítela">
                    <input className={cx('input text-lg', repetir && repetir !== nueva && 'border-bad/50')} type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} />
                  </Field>
                </>
              )}
              {modo === 'quitar' && <p className="text-sm text-warn">Sin clave, cualquiera con tu cédula podrá ver tu información.</p>}
              <div className="flex gap-2">
                <button type="button" className="btn-ghost flex-1" onClick={() => setModo(null)}>
                  Cancelar
                </button>
                <button className={cx('flex-1', modo === 'quitar' ? 'btn-danger' : 'btn-primary')} disabled={!valida || guardar.isPending}>
                  {modo === 'quitar' ? 'Quitar clave' : 'Guardar clave'}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Instalar */}
        <section className="card p-5">
          <p className="flex items-center gap-2 font-display font-extrabold text-white">
            <Smartphone className="h-5 w-5 text-flame-500" /> Tenla en tu teléfono
          </p>
          {puedeInstalar ? (
            <button
              className="btn-primary mt-3 w-full"
              onClick={() => {
                void eventoInstalar?.prompt();
                eventoInstalar = null;
                setPuedeInstalar(false);
              }}
            >
              <Download className="h-4 w-4" /> Instalar la app
            </button>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm text-steel-400">
              <li>
                <b className="text-steel-200">Android:</b> menú ⋮ del navegador → <i>Agregar a la pantalla principal</i>.
              </li>
              <li>
                <b className="text-steel-200">iPhone:</b> botón Compartir de Safari → <i>Agregar a inicio</i>.
              </li>
            </ul>
          )}
          <p className="mt-2 text-xs text-steel-600">Funciona igual desde la computadora: entra a esta misma dirección.</p>
        </section>

        <section className="card space-y-2 p-5">
          <button className="btn-ghost w-full" onClick={salir}>
            <LogOut className="h-4 w-4" /> Salir
          </button>
          <button className="w-full py-2 text-xs font-bold text-steel-500 hover:text-bad" disabled={salirTodo.isPending} onClick={() => confirm('¿Cerrar tu sesión en todos los teléfonos y computadoras?') && salirTodo.mutate()}>
            Cerrar sesión en todos lados
          </button>
        </section>
      </div>
    </div>
  );
}
