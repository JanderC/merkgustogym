import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleX, Hand, ScanFace, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AbrirPuerta } from '../../components/AbrirPuerta';
import { SocioPicker } from '../../components/socios';
import { Avatar, cx, Empty, PageHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { fecha, hora } from '../../lib/format';
import type { Asistencia, ResultadoAcceso } from '../../lib/types';

interface DiaAsistencia {
  fecha: string;
  resumen: { personas: number; entradas: number; denegados: number; alertas: number };
  items: Asistencia[];
}

export function FeedAsistencia({ items }: { items: Asistencia[] }) {
  if (!items.length) return <Empty icon={<ScanFace className="h-7 w-7" />} title="Nadie ha entrado todavía" hint="Las entradas del lector facial aparecen aquí al instante." />;
  return (
    <div className="divide-y divide-white/[0.04]">
      {items.map((a) => (
        <div key={a.id} className="flex animate-rise items-center gap-3 px-4 py-3">
          <Avatar socioId={a.socioId} nombre={a.socio ?? '?'} tieneFoto={a.tieneFoto} size={40} ring={a.resultado === 'permitido' ? 'ok' : 'bad'} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-steel-100">{a.socio ?? (a.employeeNo ? `Código ${a.employeeNo}` : 'Persona no registrada')}</p>
            <p className={cx('truncate text-xs', a.resultado === 'permitido' ? 'text-steel-500' : 'text-bad')}>{a.motivo}</p>
            {a.alerta && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-warn">
                <TriangleAlert className="h-3 w-3 shrink-0" /> {a.alerta}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="tnum text-sm font-bold text-steel-300">{hora(a.fechaHora)}</p>
            <p className="text-[10px] uppercase tracking-wider text-steel-600">{a.origen === 'manual' ? `manual${a.registradoPor ? ` · ${a.registradoPor.split(' ')[0]}` : ''}` : a.origen === 'simulado' ? 'simulado' : 'rostro'}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Entradas() {
  const qc = useQueryClient();
  const [ultimo, setUltimo] = useState<ResultadoAcceso | null>(null);
  const { data } = useQuery({
    queryKey: ['asistencia', 'hoy'],
    queryFn: () => api<DiaAsistencia>('/asistencia'),
    refetchInterval: 4000,
  });
  const registrar = useMutation({
    mutationFn: (socioId: string) => api<ResultadoAcceso>('/asistencia/manual', { body: { socioId } }),
    onSuccess: (r) => {
      setUltimo(r);
      void qc.invalidateQueries({ queryKey: ['asistencia'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const r = data?.resumen;
  return (
    <div>
      <PageHeader title="Entradas de hoy" kicker="Control de acceso" actions={<AbrirPuerta />}>
        El lector facial registra solo. Usa el registro manual si alguien no tiene rostro cargado o el lector falla.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-5">
          <div className="plate p-5 pt-7">
            <p className="label flex items-center gap-2">
              <Hand className="h-3.5 w-3.5" /> Registro manual
            </p>
            <SocioPicker onPick={(s) => registrar.mutate(s.id)} placeholder="Busca al cliente para marcar su entrada" />
            {ultimo && (
              <div className={cx('mt-5 flex animate-pop items-center gap-5 rounded-2xl border p-5', ultimo.resultado === 'permitido' ? 'border-ok/30 bg-ok/[0.07]' : 'border-bad/30 bg-bad/[0.07]')}>
                <Avatar socioId={ultimo.socio?.id} nombre={ultimo.socio?.nombre ?? '?'} tieneFoto size={72} ring={ultimo.resultado === 'permitido' ? 'ok' : 'bad'} />
                <div className="flex-1">
                  <p className={cx('flex items-center gap-2 font-wide text-xl', ultimo.resultado === 'permitido' ? 'text-ok' : 'text-bad')}>
                    {ultimo.resultado === 'permitido' ? <CircleCheck /> : <CircleX />} {ultimo.resultado === 'permitido' ? 'Adelante' : 'No puede pasar'}
                  </p>
                  <p className="font-bold text-white">{ultimo.socio?.nombre}</p>
                  <p className="text-sm text-steel-400">{ultimo.motivo}</p>
                  {ultimo.resultado === 'permitido' && ultimo.vigencia?.hasta && <p className="text-xs text-steel-500">Vigente hasta el {fecha(ultimo.vigencia.hasta)}</p>}
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Personas', r?.personas ?? 0, 'text-white'],
              ['Entradas', r?.entradas ?? 0, 'text-steel-200'],
              ['Rechazos', r?.denegados ?? 0, 'text-bad'],
            ].map(([l, v, c]) => (
              <div key={l as string} className="card p-4 text-center">
                <p className={cx('tnum font-wide text-3xl', c as string)}>{v}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-steel-500">{l}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <p className="font-display font-extrabold text-white">En vivo</p>
            <span className="flex items-center gap-2 text-xs text-steel-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-ok" /> actualizando
            </span>
          </div>
          <div className="max-h-[68vh] overflow-y-auto">
            <FeedAsistencia items={data?.items ?? []} />
          </div>
        </div>
      </div>
    </div>
  );
}
