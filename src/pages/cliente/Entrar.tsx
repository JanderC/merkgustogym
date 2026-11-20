/**
 * Entrada de clientes (web y móvil): cédula y, si su información es privada, su clave.
 * Si olvidó la clave entra con el enlace personal que le envía su entrenador.
 */
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CalendarCheck, Dumbbell, IdCard, KeyRound, LineChart, Link2, Lock, ShieldCheck } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useManifiesto } from '../../components/app/AppUI';
import { api, ApiError, sesionCliente } from '../../lib/api';

export default function EntrarCliente() {
  useManifiesto('/cliente.webmanifest');
  const nav = useNavigate();
  const { data: gym } = useQuery({ queryKey: ['cliente-gym'], queryFn: () => api<{ nombre: string; slogan: string }>('/cliente/gym', { token: null }), staleTime: 3600_000 });
  const [cedula, setCedula] = useState('');
  const [clave, setClave] = useState('');
  const [pideClave, setPideClave] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const claveRef = useRef<HTMLInputElement>(null);

  if (sesionCliente.token) return <Navigate to="/cliente/app" replace />;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const r = await api<{ token: string; nombre: string }>('/cliente/entrar', { token: null, body: { cedula, ...(pideClave !== null && { clave }) } });
      sesionCliente.save(r.token, { nombre: r.nombre });
      nav('/cliente/app', { replace: true });
    } catch (err) {
      const det = err instanceof ApiError ? (err.details as { requiereClave?: boolean; nombre?: string } | undefined) : undefined;
      if (det?.requiereClave) {
        if (pideClave !== null) setError((err as Error).message);
        setPideClave(det.nombre ?? '');
        setClave('');
        setTimeout(() => claveRef.current?.focus(), 50);
      } else setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      {/* Marca (computadora) */}
      <div className="relative hidden overflow-hidden border-r border-white/[0.06] bg-ink-900 lg:block">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'repeating-linear-gradient(135deg, #BABFC8 0 2px, transparent 2px 26px)' }} />
        <div className="absolute -bottom-40 -left-40 h-[520px] w-[520px] rounded-full bg-flame-500/20 blur-[120px]" />
        <div className="relative flex h-full flex-col justify-between p-14">
          <img src="/logo-full.png" alt={gym?.nombre ?? 'Gym'} className="w-64" />
          <div>
            <p className="font-wide text-[56px] leading-[0.95] text-white">
              Tu progreso,
              <br />
              <span className="text-flame-500">en tu bolsillo.</span>
            </p>
            <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
              {[
                [CalendarCheck, 'Tus días', 'Cuántos te quedan de tu plan'],
                [LineChart, 'Tu avance', 'Peso y medidas en una gráfica'],
                [Dumbbell, 'Tu rutina', 'Marca cada día que entrenas'],
              ].map(([Icono, t, d]) => {
                const I = Icono as typeof Dumbbell;
                return (
                  <div key={t as string} className="plate p-4 pt-6">
                    <I className="h-5 w-5 text-flame-500" />
                    <p className="mt-2 font-display text-sm font-extrabold text-steel-100">{t as string}</p>
                    <p className="mt-1 text-xs text-steel-500">{d as string}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-steel-600">© {new Date().getFullYear()} {gym?.nombre ?? 'Merkgusto Gym'}</p>
        </div>
      </div>

      {/* Formulario */}
      <div className="flex min-h-screen flex-col px-6 py-8 lg:min-h-0 lg:items-center lg:justify-center">
        <div className="w-full max-w-sm animate-rise lg:mx-auto">
          <img src="/logo-full.png" alt="" className="mx-auto mb-10 w-44 lg:hidden" />
          {pideClave === null ? (
            <>
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-flame-500">Clientes</p>
              <h1 className="mt-2 font-wide text-3xl text-white">Entra a tu cuenta</h1>
              <p className="mt-2 text-sm text-steel-400">Escribe tu cédula para ver tus días, tu progreso y tu rutina.</p>
            </>
          ) : (
            <>
              <button className="mb-4 flex items-center gap-1 text-sm font-bold text-steel-400 hover:text-white" onClick={() => (setPideClave(null), setError(''))}>
                <ArrowLeft className="h-4 w-4" /> Otra cédula
              </button>
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-flame-500/10 text-flame-400">
                  <ShieldCheck className="h-6 w-6" />
                </span>
                <div>
                  <h1 className="font-wide text-2xl text-white">Hola{pideClave ? `, ${pideClave}` : ''}</h1>
                  <p className="text-sm text-steel-400">Tu información es privada: escribe tu clave.</p>
                </div>
              </div>
            </>
          )}

          <form onSubmit={(e) => void enviar(e)} className="mt-8 space-y-4">
            <div className="relative">
              <IdCard className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-steel-500" />
              <input
                className="input h-14 rounded-2xl pl-12 text-lg tracking-wide"
                placeholder="Cédula (ej. V-12345678)"
                autoComplete="username"
                autoFocus
                disabled={pideClave !== null}
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
              />
            </div>
            {pideClave !== null && (
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-steel-500" />
                <input ref={claveRef} className="input h-14 rounded-2xl pl-12 text-lg" type="password" placeholder="Tu clave" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
              </div>
            )}
            {error && <p className="rounded-xl border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">{error}</p>}
            <button className="btn-primary btn-xl w-full" disabled={cargando || cedula.replace(/\D/g, '').length < 5 || (pideClave !== null && clave.length < 1)}>
              {cargando ? 'Entrando…' : 'Entrar'} <ArrowRight className="h-5 w-5" />
            </button>
          </form>

          <div className="mt-8 space-y-3">
            <div className="flex gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-flame-400" />
              <p className="text-sm text-steel-400">
                <b className="text-steel-200">¿Olvidaste tu clave?</b> Pide a tu entrenador o a recepción tu <b className="text-steel-200">enlace personal</b> por WhatsApp: con él entras sin clave y puedes crear una nueva.
              </p>
            </div>
            <div className="flex gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-steel-500" />
              <p className="text-sm text-steel-500">¿Quieres que nadie más vea tu información? Adentro, en <b className="text-steel-300">Cuenta</b>, ponle una clave.</p>
            </div>
          </div>
          <p className="mt-10 text-center text-xs text-steel-600">
            ¿Trabajas en el gimnasio?{' '}
            <Link to="/login" className="font-bold text-steel-400 hover:text-flame-400">
              Entrada del equipo
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
