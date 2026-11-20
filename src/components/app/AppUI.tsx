/**
 * Piezas compartidas de la app del cliente y la app de entrenadores (web y móvil):
 * cascarón con barra inferior en el teléfono y menú lateral en la computadora,
 * anillo de días, progreso con gráfica, rutina por días y editores táctiles.
 */
import { BookmarkPlus, Check, ChevronDown, Dumbbell, Plus, Ruler, Trash2, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { fecha, fechaCorta, hoyISO } from '../../lib/format';
import { LineaSerie } from '../charts';
import { Cambio, MEDIDAS, type Ejercicio, type Medicion } from '../Progreso';
import { cx, Field, Modal } from '../ui';

export const num = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('es-VE', { maximumFractionDigits: 1 }));

/** Cambia el manifiesto para que "Agregar a pantalla de inicio" abra esta app. */
export function useManifiesto(href: string, color = '#0B0C0E') {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const previo = link?.getAttribute('href') ?? null;
    if (link) link.setAttribute('href', href);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
    return () => {
      if (link && previo) link.setAttribute('href', previo);
    };
  }, [href, color]);
}

// ═════════════ Cascarón ═════════════
export interface ItemNav {
  to: string;
  label: string;
  icon: typeof Dumbbell;
  end?: boolean;
}

export function AppShell({ nav, marca, cuenta, children }: { nav: ItemNav[]; marca: ReactNode; cuenta: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-full lg:grid lg:grid-cols-[250px_1fr]">
      {/* Computadora: menú lateral */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-white/[0.06] bg-ink-900/60 p-5 lg:flex">
        {marca}
        <nav className="mt-8 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cx('flex h-12 items-center gap-3 rounded-xl px-4 text-sm font-bold transition', isActive ? 'bg-flame-500 text-ink-950 shadow-glow' : 'text-steel-400 hover:bg-white/[0.04] hover:text-steel-100')
              }
            >
              <n.icon className="h-5 w-5" /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">{cuenta}</div>
      </aside>

      <div className="min-w-0">
        {/* Teléfono: encabezado compacto */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-white/[0.06] bg-ink-950/85 px-4 backdrop-blur-xl lg:hidden">
          {marca}
          {cuenta}
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">{children}</main>
      </div>

      {/* Teléfono: barra inferior */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => cx('flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-bold transition', isActive ? 'text-flame-400' : 'text-steel-500')}
            >
              {({ isActive }) => (
                <>
                  <span className={cx('grid h-8 w-12 place-items-center rounded-full transition', isActive && 'bg-flame-500/15')}>
                    <n.icon className="h-5 w-5" />
                  </span>
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function Titulo({ kicker, children, accion }: { kicker?: string; children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {kicker && <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-flame-500">{kicker}</p>}
        <h1 className="mt-1 font-wide text-2xl text-white sm:text-3xl">{children}</h1>
      </div>
      {accion}
    </div>
  );
}

export function Seccion({ titulo, icono, accion, children, className }: { titulo: ReactNode; icono?: ReactNode; accion?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('card p-5', className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-display font-extrabold text-white">
          {icono}
          {titulo}
        </p>
        {accion}
      </div>
      {children}
    </section>
  );
}

// ═════════════ Anillo de días ═════════════
export function AnilloDias({ restantes, total, color = '#FF8A10', size = 150 }: { restantes: number; total: number; color?: string; size?: number }) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const p = total > 0 ? Math.max(0, Math.min(1, restantes / total)) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.07)" strokeWidth={11} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={11}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)', filter: `drop-shadow(0 0 10px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-wide leading-none text-white" style={{ fontSize: size * 0.3 }}>
            {restantes}
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-steel-400">día{restantes === 1 ? '' : 's'}</p>
        </div>
      </div>
    </div>
  );
}

// ═════════════ Progreso ═════════════
export function ProgresoResumen({ mediciones, onBorrar, puedeBorrar }: { mediciones: Array<Medicion & { autor?: string; entrenador?: string | null }>; onBorrar?: (id: number) => void; puedeBorrar?: (m: Medicion & { autor?: string }) => boolean }) {
  const [verTodo, setVerTodo] = useState(false);
  const [medida, setMedida] = useState<keyof Medicion>('peso');
  if (!mediciones.length) return null;
  const ultima = mediciones[0];
  const primera = mediciones[mediciones.length - 1];
  const disponibles = MEDIDAS.filter((m) => mediciones.some((x) => x[m.k] != null));
  const info = MEDIDAS.find((m) => m.k === medida) ?? MEDIDAS[0];
  const serie = [...mediciones].reverse().filter((m) => m[medida] != null);
  const lista = verTodo ? mediciones : mediciones.slice(0, 4);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {MEDIDAS.filter((m) => ultima[m.k] != null).map((m) => (
          <button
            key={m.k}
            onClick={() => setMedida(m.k)}
            className={cx('rounded-2xl border px-3 py-2.5 text-left transition', medida === m.k ? 'border-flame-500/50 bg-flame-500/[0.07]' : 'border-transparent bg-white/[0.04] hover:bg-white/[0.06]')}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-steel-500">{m.label}</p>
            <p className="tnum text-lg font-bold text-white">
              {num(ultima[m.k] as number)} <span className="text-xs font-normal text-steel-500">{m.unidad}</span>
            </p>
            {mediciones.length > 1 && <Cambio actual={ultima[m.k] as number | null} inicial={primera[m.k] as number | null} unidad={m.unidad} menosEsMejor={m.k !== 'musculo'} />}
          </button>
        ))}
      </div>
      {serie.length > 1 ? (
        <div className="rounded-2xl bg-white/[0.02] p-2">
          <p className="mb-1 px-2 text-xs font-bold text-steel-400">
            {info.label} · desde el {fecha(serie[0].fecha)}
          </p>
          <LineaSerie data={serie} x="fecha" y={medida} nombre={info.label} formatX={fechaCorta} formatY={(v) => `${v} ${info.unidad}`} height={180} />
        </div>
      ) : (
        disponibles.length > 0 && <p className="text-xs text-steel-500">Con la próxima medida verás tu gráfica de avance.</p>
      )}
      <div className="space-y-1.5">
        {lista.map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-xl bg-white/[0.02] px-3 py-2 text-xs text-steel-400">
            <span className="w-20 shrink-0 font-bold text-steel-300">{fechaCorta(m.fecha)}</span>
            <span className="min-w-0 flex-1 truncate">
              {MEDIDAS.filter((x) => m[x.k] != null)
                .map((x) => `${x.label} ${num(m[x.k] as number)}${x.unidad === '%' ? '%' : ` ${x.unidad}`}`)
                .join(' · ')}
            </span>
            <span className="hidden shrink-0 text-[10px] uppercase tracking-wider text-steel-600 sm:inline">{m.autor === 'cliente' ? 'tú' : m.entrenador ?? (m.autor === 'entrenador' ? 'entrenador' : 'gimnasio')}</span>
            {onBorrar && puedeBorrar?.(m) && (
              <button onClick={() => confirm('¿Borrar esta medida?') && onBorrar(m.id)} className="text-steel-600 hover:text-bad" title="Borrar">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {mediciones.length > 4 && (
          <button className="flex items-center gap-1 text-xs font-bold text-steel-500 hover:text-flame-400" onClick={() => setVerTodo(!verTodo)}>
            <ChevronDown className={cx('h-4 w-4 transition', verTodo && 'rotate-180')} /> {verTodo ? 'Ver menos' : `Ver las ${mediciones.length}`}
          </button>
        )}
      </div>
    </div>
  );
}

/** Anotar medidas: primero el peso (lo más común) y, si quiere, el resto. */
export function MedicionModal({ anterior, guardar, onClose, titulo = 'Anotar medidas' }: { anterior?: Medicion; guardar: (body: Record<string, unknown>) => Promise<unknown>; onClose: () => void; titulo?: string }) {
  const [f, setF] = useState<Record<string, string>>({ fecha: hoyISO(), nota: '' });
  const [mas, setMas] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const leer = (v: string | undefined) => (v && v.trim() ? Number(v.replace(',', '.')) : null);
  const alguna = MEDIDAS.some((x) => leer(f[x.k]) != null && !Number.isNaN(leer(f[x.k])));
  const enviar = async () => {
    setEnviando(true);
    setError('');
    try {
      await guardar({ fecha: f.fecha, nota: f.nota || null, ...Object.fromEntries(MEDIDAS.map((x) => [x.k, leer(f[x.k])])) });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };
  const visibles = mas ? MEDIDAS : MEDIDAS.filter((m) => m.k === 'peso' || m.k === 'cintura');
  return (
    <Modal
      title={titulo}
      size="sm"
      onClose={onClose}
      footer={
        <button className="btn-primary w-full sm:w-auto" disabled={!alguna || enviando} onClick={() => void enviar()}>
          <Check className="h-4 w-4" /> Guardar
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {visibles.map((x) => (
          <Field key={x.k} label={`${x.label} (${x.unidad})`} hint={anterior?.[x.k] != null ? `Antes: ${num(anterior[x.k] as number)}` : undefined} className={x.k === 'peso' && !mas ? 'col-span-2' : undefined}>
            <input
              className={cx('input tnum', x.k === 'peso' && 'h-14 text-2xl font-bold')}
              inputMode="decimal"
              placeholder={x.k === 'peso' ? '70,5' : ''}
              autoFocus={x.k === 'peso'}
              value={f[x.k] ?? ''}
              onChange={(e) => setF({ ...f, [x.k]: e.target.value.replace(/[^0-9.,]/g, '') })}
            />
          </Field>
        ))}
      </div>
      {!mas && (
        <button className="mt-3 flex items-center gap-1 text-sm font-bold text-flame-400" onClick={() => setMas(true)}>
          <Ruler className="h-4 w-4" /> Más medidas (grasa, cadera, brazo…)
        </button>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Fecha">
          <input type="date" className="input" max={hoyISO()} value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
        </Field>
        <Field label="Nota">
          <input className="input" maxLength={300} value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} placeholder="En ayunas" />
        </Field>
      </div>
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
    </Modal>
  );
}

// ═════════════ Rutina ═════════════
export interface RutinaBase {
  id?: number;
  titulo: string;
  objetivo: string | null;
  dias: Array<{ nombre: string; ejercicios: Ejercicio[] }>;
}

export function RutinaVista({ rutina, hechos = [], onMarcar, abierto: abiertoInicial }: { rutina: RutinaBase; hechos?: string[]; onMarcar?: (dia: string, hecho: boolean) => void; abierto?: number }) {
  const [abierto, setAbierto] = useState<number | null>(abiertoInicial ?? 0);
  return (
    <div className="space-y-2.5">
      {rutina.dias.map((dia, i) => {
        const hecho = hechos.includes(dia.nombre);
        const open = abierto === i;
        return (
          <div key={i} className={cx('overflow-hidden rounded-2xl border transition', hecho ? 'border-ok/30 bg-ok/[0.04]' : 'border-white/[0.06] bg-white/[0.02]')}>
            <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left" onClick={() => setAbierto(open ? null : i)}>
              <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display text-sm font-extrabold', hecho ? 'bg-ok text-ink-950' : 'bg-flame-500/10 text-flame-400')}>
                {hecho ? <Check className="h-5 w-5" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-steel-100">{dia.nombre}</span>
                <span className="block text-xs text-steel-500">
                  {dia.ejercicios.length} ejercicio{dia.ejercicios.length === 1 ? '' : 's'}
                  {hecho && ' · hecho hoy'}
                </span>
              </span>
              <ChevronDown className={cx('h-5 w-5 text-steel-500 transition', open && 'rotate-180')} />
            </button>
            {open && (
              <div className="border-t border-white/[0.05] px-4 pb-4 pt-2">
                <div className="divide-y divide-white/[0.05]">
                  {dia.ejercicios.map((e, k) => (
                    <div key={k} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-steel-100">{e.nombre}</p>
                        {e.nota && <p className="text-xs text-steel-500">{e.nota}</p>}
                      </div>
                      {(e.series || e.reps) && (
                        <span className="tnum shrink-0 rounded-lg bg-flame-500/10 px-2.5 py-1 text-sm font-bold text-flame-300">
                          {e.series || '—'} × {e.reps || '—'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {onMarcar && (
                  <button className={cx('mt-3 w-full', hecho ? 'btn-ghost' : 'btn-ok')} onClick={() => onMarcar(dia.nombre, !hecho)}>
                    {hecho ? (
                      <>
                        <X className="h-4 w-4" /> Desmarcar
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" /> ¡Lo hice hoy!
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const ejercicioVacio = (): Ejercicio => ({ nombre: '', series: '', reps: '', nota: '' });

/** Editor de rutina pensado para el dedo: cada ejercicio es una tarjeta. */
export function RutinaEditor({
  inicial,
  titulo,
  guardar,
  onClose,
  plantillas,
  guardarPlantilla,
}: {
  inicial?: RutinaBase | null;
  titulo: string;
  guardar: (r: RutinaBase) => Promise<unknown>;
  onClose: () => void;
  plantillas?: RutinaBase[];
  guardarPlantilla?: (r: RutinaBase) => Promise<unknown>;
}) {
  const [nombre, setNombre] = useState(inicial?.titulo ?? '');
  const [objetivo, setObjetivo] = useState(inicial?.objetivo ?? '');
  const [dias, setDias] = useState(inicial?.dias.length ? inicial.dias : [{ nombre: 'Día 1', ejercicios: [ejercicioVacio()] }]);
  const [diaActivo, setDiaActivo] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const limpios = dias.map((d) => ({ ...d, ejercicios: d.ejercicios.filter((e) => e.nombre.trim()) }));
  const valido = nombre.trim().length >= 2 && limpios.length > 0;
  const d = dias[diaActivo] ?? dias[0];
  const setDia = (i: number, x: (typeof dias)[number]) => setDias(dias.map((y, j) => (j === i ? x : y)));
  const cuerpo = (): RutinaBase => ({ titulo: nombre.trim(), objetivo: objetivo.trim() || null, dias: limpios });

  const enviar = async (fn: (r: RutinaBase) => Promise<unknown>, cerrar: boolean) => {
    setEnviando(true);
    setError('');
    try {
      await fn(cuerpo());
      if (cerrar) onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };
  const usarPlantilla = (p: RutinaBase) => {
    setNombre(p.titulo);
    setObjetivo(p.objetivo ?? '');
    setDias(p.dias.map((x) => ({ ...x, ejercicios: x.ejercicios.map((e) => ({ ...e })) })));
    setDiaActivo(0);
  };

  return (
    <Modal
      title={titulo}
      size="lg"
      onClose={onClose}
      footer={
        <>
          {guardarPlantilla && (
            <button className="btn-ghost" disabled={!valido || enviando} onClick={() => void enviar(guardarPlantilla, false)} title="Guardar como plantilla para otros clientes">
              <BookmarkPlus className="h-4 w-4" /> <span className="hidden sm:inline">Guardar como plantilla</span>
            </button>
          )}
          <button className="btn-primary" disabled={!valido || enviando} onClick={() => void enviar(guardar, true)}>
            <Check className="h-4 w-4" /> Guardar rutina
          </button>
        </>
      }
    >
      {plantillas && plantillas.length > 0 && (
        <div className="mb-4">
          <p className="label">Empezar desde una plantilla</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {plantillas.map((p, i) => (
              <button key={p.id ?? i} className="shrink-0 rounded-xl border border-white/[0.08] px-3 py-2 text-left text-sm hover:border-flame-500/40" onClick={() => usarPlantilla(p)}>
                <span className="block font-bold text-steel-100">{p.titulo}</span>
                <span className="text-xs text-steel-500">{p.dias.length} día(s)</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre de la rutina">
          <input className="input" value={nombre} maxLength={100} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Tonificación 3 días" />
        </Field>
        <Field label="Objetivo (opcional)">
          <input className="input" value={objetivo} maxLength={150} onChange={(e) => setObjetivo(e.target.value)} placeholder="Ej. bajar grasa" />
        </Field>
      </div>

      <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-1">
        {dias.map((x, i) => (
          <button
            key={i}
            onClick={() => setDiaActivo(i)}
            className={cx('shrink-0 rounded-full px-4 py-2 text-sm font-bold transition', i === diaActivo ? 'bg-flame-500 text-ink-950' : 'bg-white/[0.05] text-steel-300 hover:bg-white/[0.08]')}
          >
            {x.nombre || `Día ${i + 1}`}
          </button>
        ))}
        {dias.length < 7 && (
          <button
            className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-white/15 px-3 py-2 text-sm font-bold text-steel-400 hover:text-flame-400"
            onClick={() => {
              setDias([...dias, { nombre: `Día ${dias.length + 1}`, ejercicios: [ejercicioVacio()] }]);
              setDiaActivo(dias.length);
            }}
          >
            <Plus className="h-4 w-4" /> Día
          </button>
        )}
      </div>

      {d && (
        <div className="mt-3 rounded-2xl border border-white/[0.06] p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <input className="input flex-1 font-bold" value={d.nombre} maxLength={80} onChange={(e) => setDia(diaActivo, { ...d, nombre: e.target.value })} placeholder="Ej. Pierna y glúteo" />
            {dias.length > 1 && (
              <button
                className="btn-ghost btn-sm"
                onClick={() => {
                  setDias(dias.filter((_, j) => j !== diaActivo));
                  setDiaActivo(Math.max(0, diaActivo - 1));
                }}
                title="Quitar este día"
              >
                <Trash2 className="h-4 w-4 text-bad" />
              </button>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {d.ejercicios.map((e, k) => {
              const setE = (x: Partial<Ejercicio>) => setDia(diaActivo, { ...d, ejercicios: d.ejercicios.map((y, j) => (j === k ? { ...y, ...x } : y)) });
              return (
                <div key={k} className="rounded-xl bg-white/[0.03] p-2.5">
                  <div className="flex gap-2">
                    <input className="input min-w-0 flex-1 py-2 text-sm font-bold" value={e.nombre} maxLength={80} onChange={(ev) => setE({ nombre: ev.target.value })} placeholder={`Ejercicio ${k + 1}`} />
                    <button className="px-1 text-steel-500 hover:text-bad" onClick={() => setDia(diaActivo, { ...d, ejercicios: d.ejercicios.filter((_, j) => j !== k) })} title="Quitar">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-[70px_90px_1fr] gap-2">
                    <input className="input py-2 text-center text-sm" value={e.series} maxLength={10} onChange={(ev) => setE({ series: ev.target.value })} placeholder="Series" />
                    <input className="input py-2 text-center text-sm" value={e.reps} maxLength={20} onChange={(ev) => setE({ reps: ev.target.value })} placeholder="Reps" />
                    <input className="input py-2 text-sm" value={e.nota} maxLength={120} onChange={(ev) => setE({ nota: ev.target.value })} placeholder="Nota (descanso, peso…)" />
                  </div>
                </div>
              );
            })}
            <button className="w-full rounded-xl border border-dashed border-white/15 py-2.5 text-sm font-bold text-flame-400 hover:border-flame-500/40" onClick={() => setDia(diaActivo, { ...d, ejercicios: [...d.ejercicios, ejercicioVacio()] })}>
              + Agregar ejercicio
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
    </Modal>
  );
}

/** Insignia de alerta del entrenador. */
export function ChipAlerta({ tipo, texto }: { tipo: string; texto: string }) {
  const cls =
    tipo === 'vencido' ? 'border-bad/30 bg-bad/10 text-bad' : tipo === 'vence' ? 'border-warn/30 bg-warn/10 text-warn' : tipo === 'ausente' ? 'border-sky-400/30 bg-sky-400/10 text-sky-300' : 'border-white/10 text-steel-400';
  return <span className={cx('chip', cls)}>{texto}</span>;
}
