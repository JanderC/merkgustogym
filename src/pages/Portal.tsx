/**
 * Portal del cliente: lo abre desde su teléfono con su enlace personal.
 * Solo lectura: su plan, sus entradas, su progreso y su rutina.
 */
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, CalendarDays, Clock, Dumbbell, Flame, HandCoins, Instagram, MapPin, Phone, Ruler, TrendingDown } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { LineaSerie } from '../components/charts';
import { Cambio, MEDIDAS, type Medicion, type Rutina } from '../components/Progreso';
import { cx } from '../components/ui';
import { API } from '../lib/api';
import { fecha, fechaCorta, hora } from '../lib/format';

interface DatosPortal {
  socio: { nombre: string; apellido: string; codigo: number; activo: boolean };
  gym: { nombre: string; slogan: string; horario: string; telefono: string; instagram: string; direccion: string };
  vigencia: { vigente: boolean; desde: string | null; hasta: string | null; ultimaFin: string | null; plan: string | null; diasRestantes: number; congelada: { desde: string; dias: number } | null };
  membresias: Array<{ id: string; plan: string; color: string; fechaInicio: string; fechaFin: string; estado: string }>;
  asistencias: { ultimas: string[]; esteMes: number; total: number };
  clases: Array<{ id: number; nombre: string; inicio: string; duracionMin: number; color: string; entrenador: string | null }>;
  mediciones: Medicion[];
  rutina: Rutina | null;
  deuda: string | null;
}

async function cargar(token: string) {
  const r = await fetch(`${API}/portal/${encodeURIComponent(token)}`);
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j as { message?: string } | null)?.message ?? 'No se pudo cargar');
  return j as DatosPortal;
}

const num = (v: number | null) => (v == null ? '—' : v.toLocaleString('es-VE', { maximumFractionDigits: 1 }));

export default function Portal() {
  const { token = '' } = useParams();
  const { data: d, error, isLoading } = useQuery({ queryKey: ['portal', token], queryFn: () => cargar(token), retry: false, refetchOnWindowFocus: true });

  if (isLoading) {
    return (
      <div className="grid min-h-full place-items-center p-6">
        <Flame className="h-10 w-10 animate-pulse text-flame-500" />
      </div>
    );
  }
  if (error || !d) {
    return (
      <div className="grid min-h-full place-items-center p-6 text-center">
        <div>
          <img src="/logo-merkgusto.png" alt="" className="mx-auto mb-6 h-16 w-auto opacity-80" />
          <p className="font-wide text-xl text-white">Enlace no disponible</p>
          <p className="mx-auto mt-2 max-w-xs text-steel-400">{(error as Error | null)?.message ?? 'Pide uno nuevo en recepción.'}</p>
        </div>
      </div>
    );
  }

  const v = d.vigencia;
  const meds = d.mediciones;
  const ultima = meds[0];
  const primera = meds[meds.length - 1];
  const serie = [...meds].reverse().filter((m) => m.peso != null);
  const pocoTiempo = v.vigente && v.diasRestantes <= 5;

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 pb-16 pt-6">
      <header className="flex items-center gap-3">
        <img src="/logo-merkgusto.png" alt="" className="h-11 w-11 rounded-xl object-contain" />
        <div className="min-w-0">
          <p className="truncate font-wide text-lg text-white">{d.gym.nombre}</p>
          {d.gym.slogan && <p className="truncate text-xs text-steel-500">{d.gym.slogan}</p>}
        </div>
      </header>

      <h1 className="mt-7 font-wide text-3xl text-white">Hola, {d.socio.nombre} 💪</h1>
      <p className="text-sm text-steel-500">Cliente #{d.socio.codigo}</p>

      {/* Plan */}
      <section className={cx('mt-5 rounded-3xl border p-5', v.vigente ? (pocoTiempo ? 'border-warn/30 bg-warn/[0.07]' : 'border-ok/25 bg-ok/[0.07]') : 'border-bad/25 bg-bad/[0.07]')}>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-steel-400">
          <CalendarCheck className="h-4 w-4" /> Tu plan
        </p>
        {v.congelada ? (
          <p className="mt-2 font-wide text-2xl text-sky-300">Congelado desde el {fecha(v.congelada.desde)}</p>
        ) : v.vigente ? (
          <>
            <p className={cx('mt-2 font-wide text-4xl', pocoTiempo ? 'text-warn' : 'text-ok')}>
              {v.diasRestantes} <span className="text-xl">día{v.diasRestantes === 1 ? '' : 's'}</span>
            </p>
            <p className="text-steel-300">
              {v.plan} · hasta el {fecha(v.hasta)}
            </p>
            {pocoTiempo && <p className="mt-2 text-sm text-warn">Se acaba pronto: renueva en recepción para no perder tus días.</p>}
          </>
        ) : (
          <>
            <p className="mt-2 font-wide text-2xl text-bad">{v.desde ? `Empieza el ${fecha(v.desde)}` : 'Sin plan vigente'}</p>
            {v.ultimaFin && <p className="text-steel-400">Tu último plan venció el {fecha(v.ultimaFin)}</p>}
          </>
        )}
        {d.deuda && (
          <p className="mt-3 flex items-center gap-2 text-sm text-warn">
            <HandCoins className="h-4 w-4" /> Tienes un saldo pendiente: {d.deuda}
          </p>
        )}
      </section>

      {/* Entradas */}
      <section className="mt-4 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-steel-500">Este mes</p>
          <p className="mt-1 font-wide text-3xl text-white">{d.asistencias.esteMes}</p>
          <p className="text-xs text-steel-500">entrenamiento{d.asistencias.esteMes === 1 ? '' : 's'}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-steel-500">Última vez</p>
          <p className="mt-1 font-wide text-lg text-white">{d.asistencias.ultimas[0] ? fechaCorta(d.asistencias.ultimas[0]) : '—'}</p>
          <p className="text-xs text-steel-500">{d.asistencias.ultimas[0] ? hora(d.asistencias.ultimas[0]) : 'aún sin entradas'}</p>
        </div>
      </section>

      {/* Clases */}
      {d.clases.length > 0 && (
        <section className="card mt-4 p-5">
          <p className="flex items-center gap-2 font-display font-extrabold text-white">
            <CalendarDays className="h-5 w-5 text-flame-500" /> Tus próximas clases
          </p>
          <div className="mt-3 space-y-2">
            {d.clases.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <span className="h-9 w-1.5 rounded-full" style={{ background: c.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-steel-100">{c.nombre}</p>
                  <p className="text-xs text-steel-500">
                    {fechaCorta(c.inicio)} · {hora(c.inicio)} · {c.duracionMin} min{c.entrenador && ` · ${c.entrenador}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Progreso */}
      <section className="card mt-4 p-5">
        <p className="flex items-center gap-2 font-display font-extrabold text-white">
          <TrendingDown className="h-5 w-5 text-flame-500" /> Tu progreso
        </p>
        {!ultima ? (
          <p className="mt-2 text-sm text-steel-400">Pide en recepción o a tu entrenador que te tome las medidas para ver tu avance aquí.</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-steel-500">
              Última medición: {fecha(ultima.fecha)}
              {meds.length > 1 && ` · empezaste el ${fecha(primera.fecha)}`}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {MEDIDAS.filter((m) => ultima[m.k] != null).map((m) => (
                <div key={m.k} className="rounded-2xl bg-white/[0.04] px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-steel-500">{m.label}</p>
                  <p className="tnum text-lg font-bold text-white">
                    {num(ultima[m.k] as number)} <span className="text-xs font-normal text-steel-500">{m.unidad}</span>
                  </p>
                  {meds.length > 1 && <Cambio actual={ultima[m.k] as number | null} inicial={primera[m.k] as number | null} unidad={m.unidad} menosEsMejor={m.k !== 'musculo'} />}
                </div>
              ))}
            </div>
            {serie.length > 1 && (
              <div className="mt-4">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-steel-400">
                  <Ruler className="h-3.5 w-3.5" /> Peso
                </p>
                <LineaSerie data={serie} x="fecha" y="peso" nombre="Peso" formatX={fechaCorta} formatY={(n) => `${n} kg`} height={170} />
              </div>
            )}
          </>
        )}
      </section>

      {/* Rutina */}
      <section className="card mt-4 p-5">
        <p className="flex items-center gap-2 font-display font-extrabold text-white">
          <Dumbbell className="h-5 w-5 text-flame-500" /> Tu rutina
        </p>
        {!d.rutina ? (
          <p className="mt-2 text-sm text-steel-400">Todavía no tienes rutina asignada. Pídela a tu entrenador.</p>
        ) : (
          <>
            <p className="mt-2 text-lg font-bold text-white">{d.rutina.titulo}</p>
            <p className="text-xs text-steel-500">
              {d.rutina.objetivo}
              {d.rutina.objetivo && d.rutina.entrenador && ' · '}
              {d.rutina.entrenador && `con ${d.rutina.entrenador}`}
            </p>
            <div className="mt-4 space-y-4">
              {d.rutina.dias.map((dia, i) => (
                <div key={i}>
                  <p className="mb-1.5 text-sm font-bold text-flame-300">{dia.nombre}</p>
                  <div className="divide-y divide-white/[0.05] rounded-2xl bg-white/[0.03]">
                    {dia.ejercicios.map((e, k) => (
                      <div key={k} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-steel-100">{e.nombre}</p>
                          {e.nota && <p className="text-xs text-steel-500">{e.nota}</p>}
                        </div>
                        {(e.series || e.reps) && (
                          <span className="tnum shrink-0 rounded-lg bg-flame-500/10 px-2 py-1 text-sm font-bold text-flame-300">
                            {e.series || '—'} × {e.reps || '—'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Historial de planes */}
      {d.membresias.length > 0 && (
        <section className="card mt-4 p-5">
          <p className="font-display font-extrabold text-white">Tus planes</p>
          <div className="mt-3 space-y-2">
            {d.membresias.map((m) => (
              <div key={m.id} className="flex items-center gap-3 text-sm">
                <span className="h-6 w-1.5 rounded-full" style={{ background: m.color }} />
                <span className="flex-1 font-bold text-steel-200">{m.plan}</span>
                <span className="text-xs text-steel-500">
                  {fechaCorta(m.fechaInicio)} → {fechaCorta(m.fechaFin)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Gimnasio */}
      <footer className="mt-8 space-y-2 text-sm text-steel-500">
        {d.gym.horario && (
          <p className="flex gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" /> {d.gym.horario}
          </p>
        )}
        {d.gym.direccion && (
          <p className="flex gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {d.gym.direccion}
          </p>
        )}
        {d.gym.telefono && (
          <p className="flex gap-2">
            <Phone className="mt-0.5 h-4 w-4 shrink-0" /> {d.gym.telefono}
          </p>
        )}
        {d.gym.instagram && (
          <p className="flex gap-2">
            <Instagram className="mt-0.5 h-4 w-4 shrink-0" /> {d.gym.instagram}
          </p>
        )}
        <p className="pt-4 text-center text-xs text-steel-700">Este enlace es personal. No lo compartas.</p>
      </footer>
    </div>
  );
}
