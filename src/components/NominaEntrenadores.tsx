/** Pago a entrenadores: lo que le toca a cada uno en el periodo, pagarlo y el historial. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Ban, Banknote, CheckCircle2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { fecha, fechaCorta, fechaHora, hoyISO, sumarDias } from '../lib/format';
import { useCatalogo } from '../lib/hooks';
import { fmt, leerMonto, redondear, type Moneda } from '../lib/monedas';
import type { PagoTipo } from './EntrenadorGestion';
import { Paginacion, Th, useTabla } from './Tabla';
import { cx, Empty, Field, Loading, Modal } from './ui';

interface FilaNomina {
  id: string;
  nombre: string;
  pagoTipo: PagoTipo;
  tipoTexto: string;
  tarifa: number;
  tarifaTexto: string;
  moneda: Moneda;
  horas: number;
  clases: number;
  diasTrabajados: number;
  tardanzas: number;
  ausencias: number;
  montoBase: number;
  montoTexto: string;
  /** Personalizados cobrados y aún no pagados (listos) o con saldo pendiente del cliente (retenidos) */
  personalizados: {
    monto: number;
    montoTexto: string;
    cantidad: number;
    retenido: number;
    retenidoTexto: string;
    retenidos: number;
    detalle: Array<{ id: number; cliente: string; ticket: number | null; fecha: string; periodo: string; cobradoTexto: string; comision: number; leTocaTexto: string; enPago: number; retenido: boolean }>;
  };
  total: number;
  totalTexto: string;
  pagos: Array<{ id: number; desde: string; hasta: string; totalTexto: string; creadoEn: string }>;
}
interface PagoHist {
  id: number;
  entrenador: string;
  desde: string;
  hasta: string;
  pagoTipo: PagoTipo;
  horas: number;
  clases: number;
  baseTexto: string;
  bonosTexto: string;
  descuentosTexto: string;
  personalizadosTexto: string | null;
  totalTexto: string;
  total: number | string;
  bonos: number;
  descuentos: number;
  metodo: string;
  registro: string;
  nota: string | null;
  creadoEn: string;
  anulado: boolean;
}

/** Atajos de periodo: quincena actual, quincena anterior, mes actual, mes anterior. */
function periodos() {
  const h = hoyISO();
  const [y, m, d] = h.split('-').map(Number) as [number, number, number];
  const p = (n: number) => String(n).padStart(2, '0');
  const finMes = (yy: number, mm: number) => new Date(yy, mm, 0).getDate();
  const mesAnt = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const quinActual = d <= 15 ? { desde: `${y}-${p(m)}-01`, hasta: `${y}-${p(m)}-15` } : { desde: `${y}-${p(m)}-16`, hasta: `${y}-${p(m)}-${finMes(y, m)}` };
  const quinAnt = d <= 15 ? { desde: `${mesAnt.y}-${p(mesAnt.m)}-16`, hasta: `${mesAnt.y}-${p(mesAnt.m)}-${finMes(mesAnt.y, mesAnt.m)}` } : { desde: `${y}-${p(m)}-01`, hasta: `${y}-${p(m)}-15` };
  return [
    { label: 'Esta quincena', ...quinActual },
    { label: 'Quincena anterior', ...quinAnt },
    { label: 'Este mes', desde: `${y}-${p(m)}-01`, hasta: `${y}-${p(m)}-${finMes(y, m)}` },
    { label: 'Mes anterior', desde: `${mesAnt.y}-${p(mesAnt.m)}-01`, hasta: `${mesAnt.y}-${p(mesAnt.m)}-${finMes(mesAnt.y, mesAnt.m)}` },
  ];
}

export function NominaEntrenadores() {
  const atajos = periodos();
  const [desde, setDesde] = useState(atajos[1]!.desde);
  const [hasta, setHasta] = useState(atajos[1]!.hasta);
  const [pagar, setPagar] = useState<FilaNomina | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['nomina', desde, hasta], queryFn: () => api<FilaNomina[]>('/entrenadores/nomina', { query: { desde, hasta } }) });
  const { data: hist } = useQuery({ queryKey: ['pagos-ent'], queryFn: () => api<PagoHist[]>('/entrenadores/pagos', { query: { desde: sumarDias(hoyISO(), -120) } }) });
  const t = useTabla(
    data,
    {
      nombre: { label: 'Entrenador', valor: (n) => n.nombre },
      tipo: { label: 'Cómo se le paga', valor: (n) => n.pagoTipo },
      horas: { label: 'Horas', valor: (n) => n.horas },
      clases: { label: 'Clases', valor: (n) => n.clases },
      pz: { label: 'Personalizados', valor: (n) => n.personalizados.monto },
      monto: { label: 'Le toca', valor: (n) => n.total },
    },
    { id: 'nomina', orden: { col: 'nombre', dir: 'asc' } },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Desde">
          <input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </Field>
        <Field label="Hasta">
          <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-1.5 pb-1">
          {atajos.map((a) => (
            <button
              key={a.label}
              className={cx('chip cursor-pointer', desde === a.desde && hasta === a.hasta ? 'border-flame-500/50 bg-flame-500/10 text-flame-300' : 'border-white/10 text-steel-400 hover:text-steel-100')}
              onClick={() => (setDesde(a.desde), setHasta(a.hasta))}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <Loading />
        ) : !data?.length ? (
          <Empty icon={<Wallet className="h-7 w-7" />} title="Sin entrenadores" />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th><Th t={t} col="nombre" /></th>
                <th><Th t={t} col="tipo" /></th>
                <th className="text-right"><Th t={t} col="horas" /></th>
                <th className="text-right"><Th t={t} col="clases" /></th>
                <th className="text-right"><Th t={t} col="pz" /></th>
                <th className="text-right"><Th t={t} col="monto" /></th>
                <th />
              </tr>
            </thead>
            <tbody>
              {t.visibles.map((n) => (
                <tr key={n.id}>
                  <td>
                    <p className="font-bold text-steel-100">{n.nombre}</p>
                    <p className="text-xs text-steel-500">
                      {n.diasTrabajados} día(s)
                      {n.tardanzas > 0 && <span className="text-warn"> · {n.tardanzas} tardanza(s)</span>}
                      {n.ausencias > 0 && <span className="text-bad"> · {n.ausencias} ausencia(s)</span>}
                    </p>
                  </td>
                  <td className="text-steel-400">{n.pagoTipo === 'ninguno' ? <span className="text-steel-600">Configúralo al editar al entrenador</span> : `${n.tipoTexto} · ${n.tarifaTexto}`}</td>
                  <td className={cx('tnum text-right', n.pagoTipo === 'por_hora' ? 'font-bold text-white' : 'text-steel-500')}>{n.horas}</td>
                  <td className={cx('tnum text-right', n.pagoTipo === 'por_clase' ? 'font-bold text-white' : 'text-steel-500')}>{n.clases}</td>
                  <td className="tnum text-right">
                    {n.personalizados.cantidad > 0 ? (
                      <span className="font-bold text-flame-300">
                        {n.personalizados.montoTexto}
                        <span className="block text-[11px] font-normal text-steel-500">{n.personalizados.cantidad} cobrado(s)</span>
                      </span>
                    ) : (
                      <span className="text-steel-600">—</span>
                    )}
                    {n.personalizados.retenidos > 0 && <span className="block text-[11px] text-sky-300" title="El cliente todavía debe: entra cuando termine de pagar">+{n.personalizados.retenidoTexto} retenido</span>}
                  </td>
                  <td className="tnum text-right font-display font-extrabold text-white">{n.pagoTipo === 'ninguno' && n.personalizados.cantidad === 0 ? '—' : n.totalTexto}</td>
                  <td className="text-right">
                    {n.pagos.length ? (
                      <span className="chip border-ok/30 bg-ok/10 text-ok" title={n.personalizados.cantidad ? 'Los personalizados cobrados después de ese pago entran en el próximo periodo' : undefined}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Pagado {n.pagos[0]!.totalTexto} · {fechaCorta(n.pagos[0]!.desde)} → {fechaCorta(n.pagos[0]!.hasta)}
                      </span>
                    ) : (
                      (n.pagoTipo !== 'ninguno' || n.personalizados.cantidad > 0) && (
                        <button className="btn-primary btn-sm" onClick={() => setPagar(n)}>
                          <Banknote className="h-4 w-4" /> Pagar
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Paginacion t={t} />
      </div>

      <div>
        <h4 className="label">Pagos registrados</h4>
        <HistorialPagos pagos={hist} />
      </div>
      {pagar && <PagarModal fila={pagar} desde={desde} hasta={hasta} onClose={() => setPagar(null)} />}
    </div>
  );
}

function PagarModal({ fila, desde, hasta, onClose }: { fila: FilaNomina; desde: string; hasta: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: cat } = useCatalogo();
  const [bonos, setBonos] = useState('');
  const [descuentos, setDescuentos] = useState('');
  const [metodo, setMetodo] = useState('efectivo');
  const [nota, setNota] = useState('');
  const metodos = (cat?.metodos ?? []).filter((m) => m.monedas.includes(fila.moneda));
  const metodoOk = metodos.some((m) => m.codigo === metodo) ? metodo : (metodos[0]?.codigo ?? 'efectivo');
  const total = redondear(fila.total + leerMonto(bonos) - leerMonto(descuentos), fila.moneda);
  const pz = fila.personalizados;
  const m = useMutation({
    mutationFn: () => api<{ totalTexto: string }>('/entrenadores/pagos', { body: { entrenadorId: fila.id, desde, hasta, bonos: leerMonto(bonos), descuentos: leerMonto(descuentos), metodo: metodoOk, nota: nota || null } }),
    onSuccess: (r) => {
      toast.success(`Pago a ${fila.nombre} registrado: ${r.totalTexto}`, { description: 'Quedó como egreso “Entrenadores” en finanzas' });
      ['nomina', 'pagos-ent', 'finanzas', 'personalizados'].forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const detalle = fila.pagoTipo === 'por_hora' ? `${fila.horas} h × ${fila.tarifaTexto}` : fila.pagoTipo === 'por_clase' ? `${fila.clases} clase(s) × ${fila.tarifaTexto}` : fila.pagoTipo === 'fijo' ? 'Monto fijo' : null;
  return (
    <Modal
      title={`Pagar a ${fila.nombre}`}
      onClose={onClose}
      footer={
        <button className="btn-primary" disabled={total < 0 || m.isPending} onClick={() => m.mutate()}>
          <Banknote className="h-4 w-4" /> Registrar pago de {fmt(Math.max(total, 0), fila.moneda)}
        </button>
      }
    >
      <p className="text-sm text-steel-400">
        Del {fecha(desde)} al {fecha(hasta)}
      </p>
      <div className="mt-4 space-y-2 rounded-2xl bg-white/[0.03] p-4 text-sm">
        {detalle && (
          <p className="flex justify-between text-steel-300">
            <span>{detalle}</span>
            <span className="tnum font-bold">{fila.montoTexto}</span>
          </p>
        )}
        {pz.cantidad > 0 && (
          <div>
            <p className="flex justify-between text-flame-200">
              <span className="flex items-center gap-1.5">
                <Award className="h-4 w-4" /> {pz.cantidad} personalizado(s) cobrado(s)
              </span>
              <span className="tnum font-bold">{pz.montoTexto}</span>
            </p>
            <div className="mt-1.5 space-y-0.5 border-l border-flame-500/20 pl-3 text-xs text-steel-400">
              {pz.detalle
                .filter((d) => !d.retenido)
                .map((d) => (
                  <p key={d.id} className="flex justify-between gap-3">
                    <span>
                      {d.cliente} · {d.periodo}
                      {d.ticket && ` · #${d.ticket}`} · pagó {d.cobradoTexto} × {d.comision}%
                    </span>
                    <span className="tnum">{d.leTocaTexto}</span>
                  </p>
                ))}
            </div>
          </div>
        )}
        {pz.retenidos > 0 && (
          <p className="text-xs text-sky-300">
            {pz.retenidos} personalizado(s) por {pz.retenidoTexto} no entran todavía: el cliente aún debe ({pz.detalle.filter((d) => d.retenido).map((d) => d.cliente).join(', ')}).
          </p>
        )}
        {leerMonto(bonos) > 0 && (
          <p className="flex justify-between text-ok">
            <span>Bonos</span>
            <span className="tnum">+{fmt(leerMonto(bonos), fila.moneda)}</span>
          </p>
        )}
        {leerMonto(descuentos) > 0 && (
          <p className="flex justify-between text-bad">
            <span>Descuentos</span>
            <span className="tnum">−{fmt(leerMonto(descuentos), fila.moneda)}</span>
          </p>
        )}
        <p className="flex justify-between border-t border-white/10 pt-2 font-bold text-white">
          <span>Total</span>
          <span className="tnum font-wide text-lg">{fmt(total, fila.moneda)}</span>
        </p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Bonos (opcional)">
          <input className="input tnum" inputMode="decimal" value={bonos} onChange={(e) => setBonos(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Descuentos (opcional)" hint={fila.ausencias ? `${fila.ausencias} ausencia(s) en el periodo` : undefined}>
          <input className="input tnum" inputMode="decimal" value={descuentos} onChange={(e) => setDescuentos(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Cómo se le paga">
          <select className="input" value={metodoOk} onChange={(e) => setMetodo(e.target.value)}>
            {metodos.map((x) => (
              <option key={x.codigo} value={x.codigo}>
                {x.nombre}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nota (opcional)">
          <input className="input" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} placeholder="Ej. bono por clases extra" />
        </Field>
      </div>
    </Modal>
  );
}

function HistorialPagos({ pagos }: { pagos?: PagoHist[] }) {
  const qc = useQueryClient();
  const [anular, setAnular] = useState<PagoHist | null>(null);
  const [motivo, setMotivo] = useState('');
  const m = useMutation({
    mutationFn: () => api(`/entrenadores/pagos/${anular!.id}/anular`, { body: { motivo } }),
    onSuccess: () => {
      toast.success('Pago anulado');
      ['nomina', 'pagos-ent', 'finanzas'].forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
      setAnular(null);
      setMotivo('');
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const t = useTabla(
    pagos,
    {
      fecha: { label: 'Fecha', valor: (p) => p.creadoEn },
      entrenador: { label: 'Entrenador', valor: (p) => p.entrenador },
      periodo: { label: 'Periodo', valor: (p) => p.desde },
      metodo: { label: 'Método', valor: (p) => p.metodo },
      total: { label: 'Total', valor: (p) => Number(p.total) },
    },
    { id: 'pagos-entrenadores', orden: { col: 'fecha', dir: 'desc' }, porPagina: 10 },
  );
  if (!pagos) return <Loading />;
  if (!pagos.length) return <p className="text-sm text-steel-500">Todavía no hay pagos.</p>;
  return (
    <div className="card overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th><Th t={t} col="entrenador" /></th>
            <th><Th t={t} col="periodo" /></th>
            <th><Th t={t} col="metodo">Detalle</Th></th>
            <th className="text-right"><Th t={t} col="total" /></th>
            <th />
          </tr>
        </thead>
        <tbody>
          {t.visibles.map((p) => (
            <tr key={p.id} className={cx(p.anulado && 'opacity-40')}>
              <td>
                <p className={cx('font-bold text-steel-100', p.anulado && 'line-through')}>{p.entrenador}</p>
                <p className="text-xs text-steel-500">
                  {fechaHora(p.creadoEn)} · {p.registro}
                </p>
              </td>
              <td className="text-steel-400">
                {fecha(p.desde)} → {fecha(p.hasta)}
              </td>
              <td className="text-xs text-steel-400">
                Base {p.baseTexto}
                {p.personalizadosTexto && <span className="text-flame-300"> · personalizados {p.personalizadosTexto}</span>}
                {p.bonos > 0 && <span className="text-ok"> · +{p.bonosTexto}</span>}
                {p.descuentos > 0 && <span className="text-bad"> · −{p.descuentosTexto}</span>} · {p.metodo}
                {p.nota && <span className="block text-steel-500">{p.nota}</span>}
              </td>
              <td className="tnum text-right font-display font-extrabold text-white">{p.totalTexto}</td>
              <td className="text-right">
                {!p.anulado && (
                  <button className="btn-ghost btn-sm" onClick={() => setAnular(p)} title="Anular">
                    <Ban className="h-4 w-4 text-bad" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Paginacion t={t} />
      {anular && (
        <Modal
          title="Anular pago"
          size="sm"
          onClose={() => setAnular(null)}
          footer={
            <button className="btn-danger" disabled={motivo.trim().length < 4 || m.isPending} onClick={() => m.mutate()}>
              Anular
            </button>
          }
        >
          <p className="mb-3 text-sm text-steel-300">
            Pago a {anular.entrenador} por {anular.totalTexto}. También se anula su egreso en finanzas{anular.personalizadosTexto ? ' y sus personalizados vuelven a quedar por pagar' : ''}.
          </p>
          <input className="input" placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
        </Modal>
      )}
    </div>
  );
}
