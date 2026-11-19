import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { BarSerie } from '../../components/charts';
import { cx, Field, Loading, PageHeader, Stat, Tabs } from '../../components/ui';
import { api } from '../../lib/api';
import { fechaCorta, hoyISO, money, moneySigned, sumarDias } from '../../lib/format';
import { fmt, type Moneda } from '../../lib/monedas';

interface Reporte {
  serie: Array<{ fecha: string; ingresos: number; personas: number }>;
  metodos: Array<{ nombre: string; moneda: Moneda; montoMoneda: number; monto: number; n: number }>;
  top: Array<{ descripcion: string; tipo: string; cantidad: number; monto: number }>;
  cajeros: Array<{ nombre: string; monto: number; n: number }>;
  cierres: { cantidad: number; faltantes: number; sobrantes: number };
}

const rangos = {
  '7': () => [sumarDias(hoyISO(), -6), hoyISO()],
  '30': () => [sumarDias(hoyISO(), -29), hoyISO()],
  mes: () => [hoyISO().slice(0, 8) + '01', hoyISO()],
  '90': () => [sumarDias(hoyISO(), -89), hoyISO()],
} as const;

export default function Reportes() {
  const [rango, setRango] = useState<keyof typeof rangos | 'custom'>('30');
  const [desde, setDesde] = useState(rangos['30']()[0]);
  const [hasta, setHasta] = useState(hoyISO());
  const { data: r, isLoading } = useQuery({ queryKey: ['reporte', desde, hasta], queryFn: () => api<Reporte>('/dashboard/reporte', { query: { desde, hasta } }) });

  const elegir = (k: keyof typeof rangos | 'custom') => {
    setRango(k);
    if (k !== 'custom') {
      const [d, h] = rangos[k]();
      setDesde(d!);
      setHasta(h!);
    }
  };
  const total = r?.serie.reduce((s, x) => s + x.ingresos, 0) ?? 0;
  const dias = r?.serie.length || 1;
  const visitas = r?.serie.reduce((s, x) => s + x.personas, 0) ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Reportes" kicker="Números del negocio" />
      {/* Filtros en una sola fila sobre los gráficos */}
      <div className="flex flex-wrap items-end gap-3">
        <Tabs
          value={rango}
          onChange={elegir}
          items={[
            { value: '7', label: '7 días' },
            { value: '30', label: '30 días' },
            { value: 'mes', label: 'Este mes' },
            { value: '90', label: '90 días' },
            { value: 'custom', label: 'Fechas' },
          ]}
        />
        {rango === 'custom' && (
          <>
            <Field label="Desde">
              <input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </Field>
            <Field label="Hasta">
              <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </Field>
          </>
        )}
      </div>
      {isLoading || !r ? (
        <Loading />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Stat accent label="Ingresos" value={money(total)} hint={`Promedio ${money(total / dias)} por día`} />
            <Stat label="Visitas" value={visitas} hint={`${(visitas / dias).toFixed(1)} personas por día`} />
            <Stat label="Cierres" value={r.cierres.cantidad} hint="Turnos cerrados en el periodo" />
            <Stat label="Diferencias" value={<span className={cx(r.cierres.faltantes < 0 ? 'text-bad' : 'text-ok')}>{moneySigned(r.cierres.faltantes)}</span>} hint={`Sobrantes ${money(r.cierres.sobrantes)}`} />
          </div>
          <div className="card p-5">
            <p className="mb-4 font-display font-extrabold text-white">Ingresos por día</p>
            <BarSerie data={r.serie} x="fecha" y="ingresos" nombre="Ingresos" formatY={(v) => money(v)} formatX={fechaCorta} height={260} />
          </div>
          <div className="card p-5">
            <p className="mb-4 font-display font-extrabold text-white">Personas por día</p>
            <BarSerie data={r.serie} x="fecha" y="personas" nombre="Personas" color="#9AA1AC" allowDecimals={false} formatX={fechaCorta} height={200} />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="card p-5">
              <p className="mb-4 font-display font-extrabold text-white">Lo que más vende</p>
              <BarSerie horizontal data={r.top} x="descripcion" y="monto" nombre="Vendido" formatY={(v) => money(v)} height={Math.max(160, r.top.length * 34)} />
            </div>
            <div className="space-y-6">
              <div className="card p-5">
                <p className="mb-3 font-display font-extrabold text-white">Por método de pago</p>
                <table className="table-base">
                  <tbody>
                    {r.metodos.map((m) => (
                      <tr key={m.nombre + m.moneda}>
                        <td className="font-bold text-steel-200">
                          {m.nombre}
                        </td>
                        <td className="text-right text-steel-500">{m.n} pago(s)</td>
                        <td className="tnum text-right font-bold text-white">
                          {fmt(m.montoMoneda, m.moneda)}
                          {m.moneda !== 'USD' && <span className="block text-xs font-normal text-steel-500">≈ {money(m.monto)}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card p-5">
                <p className="mb-3 font-display font-extrabold text-white">Por cajera</p>
                <table className="table-base">
                  <tbody>
                    {r.cajeros.map((c) => (
                      <tr key={c.nombre}>
                        <td className="font-bold text-steel-200">{c.nombre}</td>
                        <td className="text-right text-steel-500">{c.n} venta(s)</td>
                        <td className="tnum text-right font-bold text-white">{money(c.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
