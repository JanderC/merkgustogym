import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, LockKeyhole, Receipt, Search, Undo2 } from 'lucide-react';
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

interface Devolucion {
  id: number;
  creadoEn: string;
  motivo: string;
  reingresaStock: boolean;
  montoRef: number;
  montoTexto: string;
  ticket: number;
  cajero: string;
  autorizo: string;
  metodo: string;
  items: string;
}

/** Devoluciones: qué salió, quién la pidió y qué supervisor la autorizó. */
function Devoluciones({ desde, hasta }: { desde: string; hasta: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['devoluciones', desde, hasta], queryFn: () => api<Devolucion[]>('/caja/devoluciones', { query: { desde, hasta } }) });
  const total = (data ?? []).reduce((s, d) => s + d.montoRef, 0);
  return (
    <div className="card overflow-hidden">
      {isLoading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty icon={<Undo2 className="h-7 w-7" />} title="Sin devoluciones" hint="Cada devolución necesita el código de un supervisor y aparece aquí." />
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Productos devueltos</th>
                <th>Pidió · Autorizó</th>
                <th>Entregado</th>
                <th className="text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id}>
                  <td>
                    <p className="font-bold text-steel-100">Ticket #{d.ticket}</p>
                    <p className="text-xs text-steel-500">{fechaHora(d.creadoEn)}</p>
                  </td>
                  <td className="max-w-[320px]">
                    <p className="truncate text-steel-200">{d.items}</p>
                    <p className="truncate text-xs text-steel-500">{d.motivo}</p>
                    <p className={cx('text-[11px] font-bold', d.reingresaStock ? 'text-ok' : 'text-warn')}>{d.reingresaStock ? 'Volvió al inventario' : 'Merma: no volvió al inventario'}</p>
                  </td>
                  <td className="text-steel-400">
                    {d.cajero}
                    <span className="flex items-center gap-1 text-xs text-flame-300">
                      <LockKeyhole className="h-3 w-3" /> {d.autorizo}
                    </span>
                  </td>
                  <td className="text-steel-400">
                    {d.metodo} · {d.montoTexto}
                  </td>
                  <td className="tnum text-right font-display font-extrabold text-bad">−{money(d.montoRef)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-white/[0.06] px-5 py-3 text-right text-sm text-steel-400">
            Total devuelto: <b className="tnum text-white">{money(total)}</b>
          </p>
        </div>
      )}
    </div>
  );
}

export default function Ventas() {
  const qc = useQueryClient();
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [estado, setEstado] = useState<'' | 'pagada' | 'anulada' | 'devoluciones'>('');
  const verDev = estado === 'devoluciones';
  const [buscar, setBuscar] = useState('');
  const [anular, setAnular] = useState<Venta | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['ventas', desde, hasta, estado, buscar],
    enabled: !verDev,
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
        <div className={cx('relative min-w-[220px] flex-1', verDev && 'invisible')}>
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
            { value: 'devoluciones', label: 'Devoluciones' },
          ]}
        />
        <div className={cx('text-right', verDev && 'invisible')}>
          <p className="label">Total pagado</p>
          <p className="tnum font-wide text-xl text-white">{money(total)}</p>
        </div>
      </div>
      {verDev ? (
        <Devoluciones desde={desde} hasta={hasta} />
      ) : (
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
      )}
      {anular && <AnularVenta venta={{ ...anular, totalRef: Number(anular.totalRef) }} onClose={() => setAnular(null)} onDone={() => void qc.invalidateQueries({ queryKey: ['ventas'] })} />}
    </div>
  );
}
