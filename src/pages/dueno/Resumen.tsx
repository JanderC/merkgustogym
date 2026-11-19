import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Banknote, DoorOpen, PackageX, ScanFace, ShoppingBag, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarSerie } from '../../components/charts';
import { Diferencia, Loading, PageHeader, Stat } from '../../components/ui';
import { api } from '../../lib/api';
import { duracion, fechaCorta, hora, money } from '../../lib/format';
import { fmt, type Moneda } from '../../lib/monedas';
import type { ResumenTurno } from '../../lib/types';

interface Dashboard {
  hoy: {
    fecha: string;
    ventas: { total: number; operaciones: number; anuladas: number; membresias: { cantidad: number; monto: number }; productos: { cantidad: number; monto: number }; porMetodo: Array<{ nombre: string; moneda: Moneda; montoMoneda: number; monto: number }> };
    sociosNuevos: number;
    asistencia: { personas: number; entradas: number; denegados: number; alertas: number };
    turnos: ResumenTurno[];
  };
  socios: { total: number; vigentes: number; porVencer: number; vencidosRecientes: number; sinRostro: number };
  serie: Array<{ fecha: string; ingresos: number; personas: number }>;
  porHora: Array<{ hora: number; promedio: number }>;
  stockBajo: Array<{ id: number; nombre: string; stock: number; stockMinimo: number }>;
  porRevisar: Array<{ id: string; numero: number; cajero: string; cerradoEn: string; diferencia: number; totalVendido: number }>;
  bioErrores: number;
}

export default function Resumen() {
  const { data: d, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/dashboard'), refetchInterval: 30_000 });
  if (isLoading || !d) return <Loading />;
  const h = d.hoy;
  const abiertos = h.turnos.filter((t) => t.estado === 'abierto');
  const horaPico = [...d.porHora].sort((a, b) => b.promedio - a.promedio)[0];

  return (
    <div className="space-y-6">
      <PageHeader title="Resumen de hoy" kicker={new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })} />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat accent label="Vendido hoy" value={money(h.ventas.total)} icon={<Banknote className="h-5 w-5" />} hint={`${h.ventas.operaciones} venta(s)${h.ventas.anuladas ? ` · ${h.ventas.anuladas} anulada(s)` : ''}`} />
        <Stat label="Entraron hoy" value={h.asistencia.personas} icon={<DoorOpen className="h-5 w-5" />} hint={`${h.asistencia.entradas} marcas · ${h.asistencia.denegados} rechazos`} />
        <Stat label="Clientes al día" value={d.socios.vigentes} icon={<Users className="h-5 w-5" />} hint={`${d.socios.porVencer} vencen en 5 días · ${h.sociosNuevos} nuevo(s) hoy`} />
        <Stat label="Planes vendidos hoy" value={h.ventas.membresias.cantidad} icon={<ShoppingBag className="h-5 w-5" />} hint={`${money(h.ventas.membresias.monto)} planes · ${money(h.ventas.productos.monto)} productos`} />
      </div>

      {/* Alertas que requieren al dueño */}
      {(d.porRevisar.length > 0 || d.bioErrores > 0 || h.asistencia.alertas > 0 || d.stockBajo.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {d.porRevisar.length > 0 && (
            <Link to="/panel/cierres" className="card card-hover flex items-center gap-3 p-4">
              <AlertTriangle className="h-5 w-5 text-warn" />
              <span className="flex-1 text-sm">
                <b className="text-white">{d.porRevisar.length} cierre(s)</b> por revisar
              </span>
              <ArrowRight className="h-4 w-4 text-steel-500" />
            </Link>
          )}
          {d.bioErrores > 0 && (
            <Link to="/panel/biometrico" className="card card-hover flex items-center gap-3 p-4">
              <ScanFace className="h-5 w-5 text-bad" />
              <span className="flex-1 text-sm">
                <b className="text-white">{d.bioErrores}</b> envío(s) al lector con error
              </span>
              <ArrowRight className="h-4 w-4 text-steel-500" />
            </Link>
          )}
          {h.asistencia.alertas > 0 && (
            <Link to="/panel/asistencia" className="card card-hover flex items-center gap-3 p-4">
              <AlertTriangle className="h-5 w-5 text-warn" />
              <span className="flex-1 text-sm">
                <b className="text-white">{h.asistencia.alertas}</b> acceso(s) con alerta hoy
              </span>
              <ArrowRight className="h-4 w-4 text-steel-500" />
            </Link>
          )}
          {d.stockBajo.length > 0 && (
            <Link to="/panel/catalogo" className="card card-hover flex items-center gap-3 p-4">
              <PackageX className="h-5 w-5 text-warn" />
              <span className="flex-1 truncate text-sm">
                Stock bajo: <b className="text-white">{d.stockBajo.map((p) => p.nombre).join(', ')}</b>
              </span>
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <div className="card p-5">
            <p className="font-display font-extrabold text-white">Ingresos · últimos 14 días</p>
            <p className="mb-4 text-xs text-steel-500">Ventas pagadas por día (sin anuladas)</p>
            <BarSerie data={d.serie} x="fecha" y="ingresos" nombre="Ingresos" formatY={(v) => money(v)} formatX={fechaCorta} />
          </div>
          <div className="card p-5">
            <p className="font-display font-extrabold text-white">Personas por día</p>
            <p className="mb-4 text-xs text-steel-500">Clientes distintos que entraron</p>
            <BarSerie data={d.serie} x="fecha" y="personas" nombre="Personas" color="#9AA1AC" allowDecimals={false} height={180} formatX={fechaCorta} />
          </div>
        </div>
        <div className="space-y-6">
          <div className="plate p-5 pt-7">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display font-extrabold text-white">Turnos de hoy</p>
              <Link to="/panel/cierres" className="text-xs font-bold text-flame-400">
                Ver cierres →
              </Link>
            </div>
            {h.turnos.length === 0 && <p className="text-sm text-steel-500">Nadie ha abierto turno hoy.</p>}
            <div className="space-y-2">
              {h.turnos.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3">
                  <div className="flex-1">
                    <p className="font-bold text-steel-100">
                      #{t.numero} · {t.cajero}
                    </p>
                    <p className="text-xs text-steel-500">
                      {hora(t.abiertoEn)} → {t.cerradoEn ? hora(t.cerradoEn) : `abierto ${duracion(t.abiertoEn)}`} · {t.operaciones} venta(s)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tnum font-display font-extrabold text-white">{money(t.totalVendidoRef)}</p>
                    <Diferencia n={t.diferencia} declaro={t.declaro} abierto={t.estado === 'abierto'} />
                  </div>
                </div>
              ))}
            </div>
            {abiertos.length > 0 && <p className="mt-3 text-xs text-steel-500">Los turnos abiertos muestran lo vendido en vivo. La diferencia se calcula al cerrar.</p>}
          </div>
          <div className="card p-5">
            <p className="font-display font-extrabold text-white">Cobrado hoy por método</p>
            <div className="mt-4 space-y-3">
              {h.ventas.porMetodo.length === 0 && <p className="text-sm text-steel-500">Sin cobros todavía.</p>}
              {h.ventas.porMetodo.map((m) => (
                <div key={m.nombre + m.moneda}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-steel-300">
                      {m.nombre}
                    </span>
                    <span className="tnum text-right font-bold text-steel-100">
                      {fmt(m.montoMoneda, m.moneda)}
                      {m.moneda !== 'USD' && <span className="ml-1.5 text-xs font-normal text-steel-500">≈ {money(m.monto)}</span>}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full bg-flame-500" style={{ width: `${(m.monto / Math.max(h.ventas.total, 0.01)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <p className="font-display font-extrabold text-white">¿A qué hora vienen?</p>
            <p className="mb-3 text-xs text-steel-500">Promedio de entradas por hora · 30 días{horaPico?.promedio ? ` · pico a las ${horaPico.hora}:00` : ''}</p>
            <BarSerie data={d.porHora.filter((p) => p.hora >= 5 && p.hora <= 22)} x="hora" y="promedio" nombre="Entradas/día" color="#9AA1AC" height={150} formatX={(v) => `${v}h`} formatY={(v) => v.toFixed(2)} />
          </div>
        </div>
      </div>
    </div>
  );
}
