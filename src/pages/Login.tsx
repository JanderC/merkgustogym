import { ArrowRight, Dumbbell, Eye, EyeOff, Lock, User, UserRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { sesionCoach } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  if (user) return <Navigate to={user.rol === 'cajero' ? '/mostrador' : '/panel'} replace />;
  if (sesionCoach.token) return <Navigate to="/coach" replace />;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const u = await login(usuario, password);
      if (u === 'entrenador') nav('/coach', { replace: true });
      else nav(u.rol === 'cajero' ? '/mostrador' : '/panel', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="grid min-h-full lg:grid-cols-[1.15fr_1fr]">
      {/* Lado de marca */}
      <div className="relative hidden overflow-hidden border-r border-white/[0.06] bg-ink-900 lg:block">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'repeating-linear-gradient(135deg, #BABFC8 0 2px, transparent 2px 26px)' }}
        />
        <div className="absolute -bottom-40 -left-40 h-[520px] w-[520px] rounded-full bg-flame-500/20 blur-[120px]" />
        <div className="relative flex h-full flex-col justify-between p-14">
          <img src="/logo-full.png" alt="GYM Merkgusto" className="w-72" />
          <div>
            <p className="font-wide text-[64px] leading-[0.95] text-white">
              Entrena
              <br />
              <span className="text-flame-500">con gusto.</span>
            </p>
            <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
              {[
                ['Caja ciega', 'Cada cierre llega directo al dueño'],
                ['Acceso facial', 'El lector conoce cada vigencia'],
                ['WhatsApp', 'Responde solo y reporta a diario'],
              ].map(([t, d]) => (
                <div key={t} className="plate p-4 pt-6">
                  <p className="font-display text-sm font-extrabold text-steel-100">{t}</p>
                  <p className="mt-1 text-xs text-steel-500">{d}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-steel-600">© {new Date().getFullYear()} Merkgusto Gym</p>
        </div>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center p-6">
        <form onSubmit={enviar} className="w-full max-w-sm animate-rise">
          <img src="/logo-full.png" alt="GYM Merkgusto" className="mx-auto mb-10 w-48 lg:hidden" />
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-flame-500">Bienvenido</p>
          <h1 className="mt-2 font-wide text-3xl text-white">Inicia tu turno</h1>
          <p className="mt-2 text-sm text-steel-400">
            Ingresa con el usuario que te asignó el dueño. <span className="inline-flex items-center gap-1 text-steel-300"><Dumbbell className="h-3.5 w-3.5 text-flame-500" /> Entrenadores también.</span>
          </p>

          <div className="mt-8 space-y-4">
            <div className="relative">
              <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-steel-500" />
              <input className="input h-14 rounded-2xl pl-12 text-base" placeholder="Usuario" autoFocus autoComplete="username" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-steel-500" />
              <input
                className="input h-14 rounded-2xl pl-12 pr-12 text-base"
                placeholder="Contraseña"
                type={ver ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" onClick={() => setVer(!ver)} className="absolute right-4 top-1/2 -translate-y-1/2 text-steel-500 hover:text-steel-200">
                {ver ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          {error && <p className="mt-4 rounded-xl border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">{error}</p>}
          <button className="btn-primary btn-xl mt-6 w-full" disabled={cargando || !usuario || !password}>
            {cargando ? 'Entrando…' : 'Entrar'} <ArrowRight className="h-5 w-5" />
          </button>
          <Link to="/cliente" className="mt-6 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition hover:border-flame-500/40 hover:bg-flame-500/[0.04]">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-flame-500/10 text-flame-400">
              <UserRound className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-steel-100">¿Eres cliente del gimnasio?</span>
              <span className="block text-xs text-steel-500">Entra con tu cédula: tus días, tu progreso y tu rutina</span>
            </span>
            <ArrowRight className="h-4 w-4 text-steel-500" />
          </Link>
        </form>
      </div>
    </div>
  );
}
