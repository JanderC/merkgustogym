import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeftRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fechaHora, hoyISO } from '../lib/format';
import type { Moneda, Tasas } from '../lib/monedas';
import { cx } from './ui';

export interface ConfigPublica {
  nombre: string;
  monedaRef: Moneda;
  tasas: Tasas;
  tablero: { dolar: number; bs: number };
  tasasActualizadas: string | null;
  tasasPor: string | null;
  fuenteUsdVes: 'manual' | 'bcv' | 'paralelo';
}

export const useConfigPublica = () =>
  useQuery({ queryKey: ['config-publica'], queryFn: () => api<ConfigPublica>('/config/publica'), refetchInterval: 5 * 60_000, staleTime: 60_000 });

const n = (v: number) => v.toLocaleString('es-VE', { maximumFractionDigits: 2 });

/** Chip con las tasas del día. Dueño y admin de caja van a la página de tasas al tocarlo. */
export function TasaWidget() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { data } = useConfigPublica();
  if (!data) return null;
  const desactualizada = !data.tasasActualizadas || hoyISO(new Date(data.tasasActualizadas)) !== hoyISO();
  const puede = user?.rol !== 'cajero';
  return (
    <button
      type="button"
      onClick={() => puede && nav('/panel/tasas')}
      title={data.tasasActualizadas ? `Actualizada ${fechaHora(data.tasasActualizadas)}${data.tasasPor ? ` por ${data.tasasPor}` : ''}` : 'Sin actualizar'}
      className={cx(
        'tnum hidden items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold xl:flex',
        desactualizada ? 'border-warn/40 bg-warn/10 text-warn' : 'border-white/[0.08] text-steel-300',
        puede ? 'cursor-pointer hover:border-flame-500/40' : 'cursor-default',
      )}
    >
      {desactualizada ? <AlertTriangle className="h-3.5 w-3.5" /> : <ArrowLeftRight className="h-3.5 w-3.5 text-flame-500" />}
      <span>
        Dólar <span className="text-white">{n(data.tasas.usdCop)}</span>
      </span>
      <span className="text-steel-600">·</span>
      <span>
        Bs <span className="text-white">{n(data.tasas.vesCop)}</span>
      </span>
      <span className="font-normal text-steel-500">($1 = Bs {n(data.tasas.usdCop / data.tasas.vesCop)})</span>
      {desactualizada && <span className="font-normal">· {puede ? 'actualizar' : 'tasa de ayer'}</span>}
    </button>
  );
}
