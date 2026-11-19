import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Receipt, Search } from 'lucide-react';
import { useState } from 'react';
import { cx, Empty, Field, Loading, PageHeader, Tabs } from '../../components/ui';
import { api } from '../../lib/api';
import { fechaHora, hoyISO, money } from '../../lib/format';
import { AnularVenta } from './Cierres';

interface Venta {
  id: string;
  numero: number;
  creadoEn: string;
  totalRef: number;
  pagadoRef: number;
  estado: 'pagada' | 'anulada';
  motivoAnulacion: string | null;
  cajero: string;
  turno: number;
  socio: string | null;
  detalle: string;
  pagos: string | null;
}

export default function Ventas() {
  const qc = useQueryClient();
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [estado, setEstado] = useState<'' | 'pagada' | 'anulada'>('');
  const [buscar, setBuscar] = useState('');
  const [anular, setAnular] = useState<Venta | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['ventas', desde, hasta, estado, buscar],
    queryFn: () => api<Venta[]>('/caja/ventas', { query: { desde, hasta, estado: estado || undefined, buscar: buscar.trim() || undefined } }),
  });
  const total = (data ?? []).filter((v) => v.estado === 'pagada').reduce((s, v) => s + Number(v.totalRef), 0);

  return (
    <div>
      <PageHeader title="Ventas" kicker="Movimientos">
        Cada cobro con su cajera, turno y forma de pago.
      </PageHeader>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Field label="Desde">
          <input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </Field>
        <Field label="Hasta">
          <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </Field>
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
          <input className="input pl-10" placeholder="Cliente, producto o nº de ticket" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </div>
        <Tabs
          value={estado}
          onChange={setEstado}
          items={[
            { value: '', label: 'Todas' },
            { value: 'pagada', label: 'Pagadas' },
            { value: 'anulada', label: 'Anuladas' },
          ]}
        />
        <div className="text-right">
          <p className="label">Total pagado</p>
          <p className="tnum font-wide text-xl text-white">{money(total)}</p>
        </div>
      </div>
      <div className="card overflow-hidden">
        {isLoading ? (
          <Loading />
        ) : !data?.length ? (
          <Empty icon={<Receipt className="h-7 w-7" />} title="Sin ventas" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Detalle</th>
                  <th>Cajera</th>
                  <th>Pago</th>
                  <th className="text-right">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((v) => (
                  <tr key={v.id} className={cx(v.estado === 'anulada' && 'opacity-50')}>
                    <td>
                      <p className="font-bold text-steel-100">#{v.numero}</p>
                      <p className="text-xs text-steel-500">{fechaHora(v.creadoEn)}</p>
                    </td>
                    <td className="max-w-[320px]">
                      <p className={cx('truncate text-steel-200', v.estado === 'anulada' && 'line-through')}>{v.detalle}</p>
                      <p className="truncate text-xs text-steel-500">{v.socio ?? 'Cliente ocasional'}</p>
                      {v.motivoAnulacion && <p className="text-xs text-bad">Anulada: {v.motivoAnulacion}</p>}
                    </td>
                    <td className="text-steel-400">
                      {v.cajero}
                      <span className="block text-xs text-steel-600">Turno #{v.turno}</span>
                    </td>
                    <td className="text-steel-400">{v.pagos ?? "Fiado"}</td>
                    <td className="tnum text-right font-display font-extrabold text-white">{money(Number(v.totalRef))}</td>
                    <td className="text-right">
                      {v.estado === 'pagada' && (
                        <button className="rounded-lg p-1.5 text-steel-500 hover:bg-bad/10 hover:text-bad" title="Anular" onClick={() => setAnular(v)}>
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {anular && <AnularVenta venta={{ ...anular, totalRef: Number(anular.totalRef) }} onClose={() => setAnular(null)} onDone={() => void qc.invalidateQueries({ queryKey: ['ventas'] })} />}
    </div>
  );
}
