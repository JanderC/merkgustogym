import { useQuery } from '@tanstack/react-query';
import { CircleCheck, CircleX, Maximize, ScanFace } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Avatar, cx } from '../components/ui';
import { api } from '../lib/api';
import { fecha } from '../lib/format';
import type { Vigencia } from '../lib/types';

interface Ultimo {
  id: number;
  fechaHora: string;
  resultado: 'permitido' | 'denegado';
  motivo: string | null;
  socioId: string | null;
  nombre: string | null;
  apellido: string | null;
  tieneFoto: boolean | null;
  vigencia: Vigencia | null;
  resumen: { personas: number };
}

const VISIBLE_MS = 12_000;

/** Pantalla para un TV/monitor en la entrada: saluda a cada cliente que marca. */
export default function Pantalla() {
  const [ahora, setAhora] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const { data } = useQuery({ queryKey: ['pantalla'], queryFn: () => api<Ultimo | null>('/asistencia/ultimo'), refetchInterval: 1500 });

  const reciente = data && ahora.getTime() - new Date(data.fechaHora).getTime() < VISIBLE_MS ? data : null;
  const ok = reciente?.resultado === 'permitido';
  const nombre = reciente ? `${reciente.nombre ?? ''} ${reciente.apellido ?? ''}`.trim() || 'Persona no registrada' : '';

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-ink-950">
      <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'repeating-linear-gradient(135deg, #BABFC8 0 2px, transparent 2px 30px)' }} />
      <div className={cx('absolute inset-0 transition-colors duration-500', reciente ? (ok ? 'bg-ok/[0.08]' : 'bg-bad/[0.1]') : 'bg-transparent')} />

      <header className="relative flex items-center justify-between px-12 py-8">
        <img src="/logo-full.png" alt="Merkgusto" className="h-16" />
        <div className="text-right">
          <p className="tnum font-wide text-5xl text-white">{ahora.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
          <p className="text-steel-400">{ahora.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-12">
        {reciente ? (
          <div key={reciente.id} className="flex animate-pop items-center gap-16">
            <Avatar socioId={reciente.socioId} nombre={nombre} tieneFoto={reciente.tieneFoto} size={320} ring={ok ? 'ok' : 'bad'} />
            <div className="max-w-2xl">
              <p className={cx('flex items-center gap-4 font-wide text-5xl', ok ? 'text-ok' : 'text-bad')}>
                {ok ? <CircleCheck className="h-14 w-14" /> : <CircleX className="h-14 w-14" />}
                {ok ? '¡Bienvenido!' : 'Acceso denegado'}
              </p>
              <p className="mt-6 font-wide text-7xl leading-none text-white">{nombre}</p>
              {ok && reciente.vigencia?.vigente ? (
                <p className="mt-6 text-3xl text-steel-300">
                  {reciente.vigencia.plan} · <span className={cx('font-bold', reciente.vigencia.diasRestantes <= 3 ? 'text-warn' : 'text-flame-400')}>{reciente.vigencia.diasRestantes} día(s)</span> restantes
                </p>
              ) : (
                <p className="mt-6 text-3xl text-steel-300">{reciente.motivo}</p>
              )}
              {ok && reciente.vigencia?.vigente && reciente.vigencia.diasRestantes <= 3 && <p className="mt-3 text-2xl text-warn">Tu plan vence el {fecha(reciente.vigencia.hasta)} · renueva en recepción</p>}
              {!ok && <p className="mt-3 text-2xl text-steel-500">Pasa por recepción, te ayudamos 🧡</p>}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-10 grid h-48 w-48 place-items-center rounded-full border-2 border-dashed border-flame-500/40">
              <ScanFace className="h-24 w-24 animate-pulse text-flame-500" />
            </div>
            <p className="font-wide text-6xl text-white">Mira al lector</p>
            <p className="mt-4 text-2xl text-steel-400">y entra a darlo todo 💪</p>
          </div>
        )}
      </main>

      <footer className="relative flex items-center justify-between px-12 py-8 text-steel-500">
        <p className="text-xl">
          Hoy han entrenado <b className="tnum font-wide text-3xl text-flame-500">{data?.resumen.personas ?? 0}</b> personas
        </p>
        <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => undefined)} className="btn-ghost btn-sm opacity-40 hover:opacity-100">
          <Maximize className="h-4 w-4" /> Pantalla completa
        </button>
      </footer>
    </div>
  );
}
