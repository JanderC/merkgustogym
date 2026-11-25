/**
 * Mis personalizados (app del entrenador): quién pagó, quién no y lo que me toca
 * en mi próximo pago. El cobro lo hace la recepción; aquí se le recuerda al cliente.
 */
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Award, ChevronRight, HandCoins, MessageCircle, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Titulo } from '../../components/app/AppUI';
import { Avatar, cx, Loading } from '../../components/ui';
import { apiCoach, sesionCoach } from '../../lib/api';
import { fecha, fechaDia } from '../../lib/format';
import { EstadoPz } from '../cajero/Personalizados';
import { whatsappDe, type PersonalizadoCoach } from './tipos';

interface Respuesta {
  filas: Array<PersonalizadoCoach & { socioId: string; nombre: string; telefono: string | null; tieneFoto: boolean }>;
  tarifa: { mensual: string | null; semanal: string | null; comision: number };
  porCobrar: {
    texto: string;
    cantidad: number;
    retenidoTexto: string | null;
    retenidos: number;
    detalle: Array<{ id: number; cliente: string; periodo: string; cobradoTexto: string; leTocaTexto: string; retenido: boolean; fecha: string }>;
  };
}

const FILTROS = [
  { v: 'cobrar', l: 'Por cobrar' },
  { v: 'al_dia', l: 'Al día' },
  { v: 'sin_pago', l: 'Sin pagar' },
  { v: 'todos', l: 'Todos' },
] as const;

export function PersonalizadosCoach() {
  const { data, isLoading } = useQuery({ queryKey: ['coach-personalizados'], queryFn: () => apiCoach<Respuesta>('/personalizados'), refetchInterval: 60_000 });
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]['v']>('cobrar');
  const [verDetalle, setVerDetalle] = useState(false);
  if (isLoading || !data) return <Loading />;
  const lista = data.filas.filter((f) =>
    filtro === 'cobrar' ? ['vencido', 'vence', 'debe'].includes(f.estado) : filtro === 'al_dia' ? ['al_dia', 'por_empezar'].includes(f.estado) : filtro === 'sin_pago' ? f.estado === 'sin_pago' : true,
  );
  const n = (pred: (e: string) => boolean) => data.filas.filter((f) => pred(f.estado)).length;
  const p = data.porCobrar;

  return (
    <div className="animate-rise">
      <Link to="/coach" className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-steel-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Inicio
      </Link>
      <Titulo kicker="Entrenamiento personalizado">Mis personalizados</Titulo>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-3xl border border-flame-500/25 bg-gradient-to-br from-flame-500/[0.12] to-transparent p-5">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-flame-300">
            <Wallet className="h-4 w-4" /> Te toca en tu próximo pago
          </p>
          <p className="tnum mt-2 font-wide text-4xl text-white">{p.texto}</p>
          <p className="mt-1 text-sm text-steel-400">
            {p.cantidad} personalizado(s) cobrado(s) · tu parte es el {data.tarifa.comision}%
          </p>
          {p.retenidos > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-sky-300">
              <HandCoins className="h-3.5 w-3.5" /> +{p.retenidoTexto} cuando {p.retenidos === 1 ? 'tu cliente termine' : `${p.retenidos} clientes terminen`} de pagar
            </p>
          )}
          {p.detalle.length > 0 && (
            <button className="mt-3 text-xs font-bold text-flame-400" onClick={() => setVerDetalle(!verDetalle)}>
              {verDetalle ? 'Ocultar detalle' : 'Ver detalle'}
            </button>
          )}
          {verDetalle && (
            <div className="mt-2 space-y-1 border-t border-white/10 pt-2 text-xs">
              {p.detalle.map((d) => (
                <p key={d.id} className={cx('flex justify-between gap-3', d.retenido ? 'text-sky-300' : 'text-steel-300')}>
                  <span>
                    {d.cliente} · {d.periodo} · pagó {d.cobradoTexto}
                    {d.retenido && ' (debe)'}
                  </span>
                  <span className="tnum font-bold">{d.leTocaTexto}</span>
                </p>
              ))}
            </div>
          )}
        </section>
        <section className="card p-5">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-steel-500">
            <Award className="h-4 w-4 text-flame-400" /> Tu tarifa
          </p>
          <p className="mt-2 font-display text-2xl font-extrabold text-white">{data.tarifa.mensual ? `${data.tarifa.mensual} al mes` : 'Sin tarifa'}</p>
          {data.tarifa.semanal && <p className="text-sm text-steel-400">{data.tarifa.semanal} a la semana</p>}
          <p className="mt-3 text-xs text-steel-500">El cliente paga en recepción. En cuanto paga, aparece aquí al día. La tarifa la configura administración.</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Mini n={n((e) => e === 'al_dia' || e === 'por_empezar')} t="al día" cls="text-ok" />
            <Mini n={n((e) => e === 'vence')} t="vencen" cls="text-warn" />
            <Mini n={n((e) => e === 'vencido' || e === 'debe')} t="por cobrar" cls="text-bad" />
          </div>
        </section>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {FILTROS.map((f) => (
          <button key={f.v} onClick={() => setFiltro(f.v)} className={cx('shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition', filtro === f.v ? 'bg-flame-500 text-ink-950' : 'bg-white/[0.05] text-steel-400 hover:text-steel-100')}>
            {f.l}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {lista.map((f) => (
          <div key={f.socioId} className="card flex items-center gap-3 p-3.5">
            <Avatar socioId={f.socioId} nombre={f.nombre} tieneFoto={f.tieneFoto} size={44} token={sesionCoach.token} />
            <Link to={`/coach/clientes/${f.socioId}`} className="min-w-0 flex-1">
              <p className="truncate font-bold text-steel-100">{f.nombre}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <EstadoPz estado={f.estado} />
                <span className="text-xs text-steel-500">{f.texto}</span>
              </div>
              {f.hasta && f.estado !== 'sin_pago' && (
                <p className="mt-0.5 text-[11px] text-steel-500">
                  Pagado hasta {fechaDia(f.hasta)}
                  {f.ultimoPago && ` · último pago ${fecha(f.ultimoPago.fecha)} (${f.ultimoPago.duracion})`}
                </p>
              )}
            </Link>
            {f.telefono && ['vencido', 'vence', 'debe'].includes(f.estado) ? (
              <a
                href={`${whatsappDe(f.telefono)}?text=${encodeURIComponent(`¡Hola ${f.nombre.split(' ')[0]}! Te escribe tu entrenador. Tu personalizado ${f.estado === 'debe' ? `tiene un saldo pendiente (${f.deudaTexto})` : f.estado === 'vencido' ? 'está vencido' : `vence el ${fechaDia(f.hasta)}`}. Pasa por recepción para renovarlo y seguimos con tu plan 💪`)}`}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost btn-sm"
                title="Recordarle por WhatsApp"
              >
                <MessageCircle className="h-4 w-4 text-ok" />
              </a>
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-steel-600" />
            )}
          </div>
        ))}
        {!lista.length && <p className="text-sm text-steel-500">{filtro === 'cobrar' ? '¡Todos tus personalizados están al día!' : 'Nadie con ese filtro.'}</p>}
      </div>
    </div>
  );
}

function Mini({ n, t, cls }: { n: number; t: string; cls: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-2">
      <p className={cx('tnum font-wide text-xl', cls)}>{n}</p>
      <p className="text-[10px] text-steel-500">{t}</p>
    </div>
  );
}
