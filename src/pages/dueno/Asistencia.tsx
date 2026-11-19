import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Field, Loading, PageHeader, Stat, Tabs } from '../../components/ui';
import { api } from '../../lib/api';
import { hoyISO } from '../../lib/format';
import type { Asistencia as A } from '../../lib/types';
import { FeedAsistencia } from '../cajero/Entradas';

export default function Asistencia() {
  const [fecha, setFecha] = useState(hoyISO());
  const [resultado, setResultado] = useState<'' | 'permitido' | 'denegado'>('');
  const { data, isLoading } = useQuery({
    queryKey: ['asistencia', fecha, resultado],
    queryFn: () => api<{ resumen: { personas: number; entradas: number; denegados: number; alertas: number }; items: A[] }>('/asistencia', { query: { fecha, resultado: resultado || undefined, limite: 500 } }),
    refetchInterval: fecha === hoyISO() ? 5000 : false,
  });
  const r = data?.resumen;
  return (
    <div>
      <PageHeader title="Asistencia" kicker="Log del lector">
        Cada intento de entrada: aceptados, rechazos con su motivo y alertas de desincronización con el lector.
      </PageHeader>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat accent label="Personas" value={r?.personas ?? 0} />
        <Stat label="Entradas" value={r?.entradas ?? 0} />
        <Stat label="Rechazos" value={r?.denegados ?? 0} />
        <Stat label="Alertas" value={r?.alertas ?? 0} hint="El sistema reenvió la vigencia" />
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Día">
          <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        <Tabs
          value={resultado}
          onChange={setResultado}
          items={[
            { value: '', label: 'Todos' },
            { value: 'permitido', label: 'Permitidos' },
            { value: 'denegado', label: 'Rechazados' },
          ]}
        />
      </div>
      <div className="card overflow-hidden">{isLoading ? <Loading /> : <FeedAsistencia items={data?.items ?? []} />}</div>
    </div>
  );
}
