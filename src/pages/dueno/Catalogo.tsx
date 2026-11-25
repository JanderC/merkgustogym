import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, FileText, PackageMinus, Pencil, Plus, RotateCcw, ScanBarcode, Snowflake, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Precio } from '../../components/PanelPago';
import { PlanClientesModal } from '../../components/PlanClientes';
import { cx, Field, Loading, Modal, NumInput, PageHeader, Tabs, Toggle } from '../../components/ui';
import { Paginacion, Th, useTabla } from '../../components/Tabla';
import { api } from '../../lib/api';
import { useCatalogo } from '../../lib/hooks';
import { convertir, fmt, INFO, leerMonto, MONEDAS, type Moneda } from '../../lib/monedas';
import type { Plan, Producto, TipoDuracion } from '../../lib/types';

const COLORES = ['#FF8A10', '#BABFC8', '#7DD3FC', '#A3E635', '#F472B6', '#FACC15', '#A78BFA', '#34D399'];
const UNIDADES: Array<{ value: TipoDuracion; label: string }> = [
  { value: 'dias', label: 'Días' },
  { value: 'semanas', label: 'Semanas' },
  { value: 'meses', label: 'Meses' },
  { value: 'anios', label: 'Años' },
];

function MonedaSelector({ value, onChange }: { value: Moneda; onChange: (m: Moneda) => void }) {
  return <Tabs value={value} onChange={onChange} items={MONEDAS.map((m) => ({ value: m, label: INFO[m].simbolo }))} />;
}

/** Planes eliminados que tenían historial: se pueden restaurar. */
function PlanesEliminados() {
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const { data } = useQuery({ queryKey: ['planes-eliminados'], queryFn: () => api<Plan[]>('/planes', { query: { eliminados: 1 } }) });
  const restaurar = useMutation({
    mutationFn: (id: number) => api(`/planes/${id}/restaurar`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Plan restaurado (oculto en caja: actívalo al editarlo)');
      for (const k of ['planes', 'planes-eliminados', 'catalogo']) void qc.invalidateQueries({ queryKey: [k] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!data?.length) return null;
  return (
    <div className="mt-6">
      <button className="flex items-center gap-2 text-sm font-bold text-steel-400 hover:text-white" onClick={() => setAbierto((v) => !v)}>
        <Archive className="h-4 w-4" /> Planes eliminados ({data.length})
      </button>
      {abierto && (
        <div className="card mt-2 divide-y divide-white/[0.05]">
          {data.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-bold text-steel-200">
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                  {p.nombre} <span className="text-xs font-normal text-steel-500">· {p.duracion}</span>
                </p>
                <p className="text-xs text-steel-500">
                  {p.historicos ?? 0} cliente(s) en su historial{(p.activos ?? 0) > 0 && ` · ${p.activos} todavía vigente(s) hasta vencer`}
                </p>
              </div>
              <button className="btn-ghost btn-sm" disabled={restaurar.isPending} onClick={() => restaurar.mutate(p.id)}>
                <RotateCcw className="h-4 w-4" /> Restaurar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlanModal({ plan, onClose, onEliminar }: { plan: Partial<Plan> | null; onClose: () => void; onEliminar?: () => void }) {
  const qc = useQueryClient();
  const { data: cat } = useCatalogo();
  const [f, setF] = useState({
    nombre: plan?.nombre ?? '',
    descripcion: plan?.descripcion ?? '',
    tipoDuracion: plan?.tipoDuracion ?? ('meses' as TipoDuracion),
    cantidad: plan?.cantidad ?? 1,
    precio: plan?.precio !== undefined ? String(plan.precio).replace('.', ',') : '',
    moneda: plan?.moneda ?? ('USD' as Moneda),
    personas: plan?.personas ?? 1,
    congelable: plan?.congelable ?? true,
    maxDiasCongelado: plan?.maxDiasCongelado ?? 30,
    accesoLector: plan?.accesoLector ?? (plan?.tipoDuracion ? plan.tipoDuracion !== 'dias' : true),
    color: plan?.color ?? '#FF8A10',
    activo: plan?.activo ?? true,
    orden: plan?.orden ?? 0,
  });
  const m = useMutation({
    mutationFn: () => {
      const body = { ...f, precio: leerMonto(f.precio) };
      return plan?.id ? api(`/planes/${plan.id}`, { method: 'PUT', body }) : api('/planes', { body });
    },
    onSuccess: () => {
      toast.success('Plan guardado');
      void qc.invalidateQueries({ queryKey: ['planes'] });
      void qc.invalidateQueries({ queryKey: ['catalogo'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const precio = leerMonto(f.precio);
  const unidad = { dias: ['día', 'días'], semanas: ['semana', 'semanas'], meses: ['mes', 'meses'], anios: ['año', 'años'] }[f.tipoDuracion];
  return (
    <Modal
      title={plan?.id ? 'Editar plan' : 'Nuevo plan'}
      size="lg"
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {onEliminar ? (
            <button className="btn-danger" onClick={onEliminar}>
              <Trash2 className="h-4 w-4" /> Eliminar plan
            </button>
          ) : (
            <span />
          )}
          <button className="btn-primary" disabled={m.isPending || f.nombre.length < 2 || precio < 0} onClick={() => m.mutate()}>
            Guardar
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nombre" className="col-span-2">
          <input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Mensual, Trimestral, Promo Dúo…" />
        </Field>
        <Field label="Descripción" className="col-span-2">
          <input className="input" value={f.descripcion ?? ''} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
        </Field>
        <div className="col-span-2 rounded-2xl border border-white/[0.06] p-4">
          <span className="label">Duración</span>
          <div className="flex flex-wrap items-center gap-3">
            <NumInput className="w-24 text-lg" value={f.cantidad} min={1} max={366} onChange={(n) => setF({ ...f, cantidad: n })} />
            <Tabs value={f.tipoDuracion} onChange={(v) => setF({ ...f, tipoDuracion: v, accesoLector: v !== 'dias', congelable: v !== 'dias' && f.congelable })} items={UNIDADES} />
          </div>
          <p className="mt-2 text-xs text-steel-500">
            {f.tipoDuracion === 'meses'
              ? `Mes a mes: si paga el 15 de enero, queda hasta el 14 de ${f.cantidad === 1 ? 'febrero' : 'dentro de ' + f.cantidad + ' meses'} y renueva el 15.`
              : `${f.cantidad} ${f.cantidad === 1 ? unidad[0] : unidad[1]} desde el día que paga (el primer día cuenta).`}
          </p>
        </div>
        <div className="col-span-2 rounded-2xl border border-white/[0.06] p-4">
          <span className="label">Precio</span>
          <div className="flex flex-wrap items-center gap-3">
            <input className="input tnum w-40 text-lg" inputMode="decimal" value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })} placeholder="0" />
            <MonedaSelector value={f.moneda} onChange={(mo) => setF({ ...f, moneda: mo })} />
          </div>
          {cat && precio > 0 && (
            <p className="mt-2 text-xs text-steel-400">
              Hoy equivale a{' '}
              {MONEDAS.filter((x) => x !== f.moneda)
                .map((x) => fmt(convertir(precio, f.moneda, x, cat.tasas), x))
                .join(' · ')}
              . Se cobra en la moneda que elija el cliente.
            </p>
          )}
        </div>
        <Field label="Personas" hint="2 o más = plan grupal (Promo Dúo, familiar): cada uno con su membresía">
          <NumInput value={f.personas} min={1} max={10} onChange={(n) => setF({ ...f, personas: n })} />
        </Field>
        <Field label="Orden en caja">
          <NumInput value={f.orden} min={0} max={999} onChange={(n) => setF({ ...f, orden: n })} />
        </Field>
        <div className="col-span-2 rounded-2xl border border-white/[0.06]">
          <Toggle
            checked={f.accesoLector}
            onChange={(v) => setF({ ...f, accesoLector: v })}
            label="Da acceso por el lector facial"
            hint={f.accesoLector ? 'El lector le abre la puerta mientras esté vigente (semanal, mensual…)' : 'Pase diario / rutinas: entra registrándose en recepción, el lector no le abre'}
          />
        </div>
        <div className="col-span-2 grid grid-cols-2 items-end gap-4">
          <Toggle checked={f.congelable} onChange={(v) => setF({ ...f, congelable: v })} label="Se puede congelar" hint="Viajes o lesiones: los días se devuelven al reanudar" />
          {f.congelable && (
            <Field label="Máximo de días congelado">
              <NumInput value={f.maxDiasCongelado} min={1} max={365} onChange={(n) => setF({ ...f, maxDiasCongelado: n })} />
            </Field>
          )}
        </div>
        <Field label="Color" className="col-span-2">
          <div className="flex gap-2">
            {COLORES.map((c) => (
              <button key={c} type="button" onClick={() => setF({ ...f, color: c })} className={cx('h-9 w-9 rounded-full ring-2 ring-offset-2 ring-offset-ink-900', f.color === c ? 'ring-white' : 'ring-transparent')} style={{ background: c }} />
            ))}
          </div>
        </Field>
        <div className="col-span-2">
          <Toggle checked={f.activo} onChange={(v) => setF({ ...f, activo: v })} label="Disponible en caja" />
        </div>
      </div>
    </Modal>
  );
}

function ProductoModal({ prod, onClose }: { prod: Partial<Producto> | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    nombre: prod?.nombre ?? '',
    categoria: prod?.categoria ?? 'Bebidas',
    precio: prod?.precio !== undefined ? String(prod.precio).replace('.', ',') : '',
    moneda: prod?.moneda ?? ('COP' as Moneda),
    stockMinimo: prod?.stockMinimo ?? 5,
    // Lo nuevo desde aquí solo puede ser un servicio: los productos con inventario nacen en la factura
    controlaStock: prod?.id ? !!prod.controlaStock : false,
    activo: prod?.activo ?? true,
    codigoBarras: prod?.codigoBarras ?? '',
  });
  const precio = leerMonto(f.precio);
  const costo = Number(prod?.costo ?? 0);
  const m = useMutation({
    mutationFn: () => {
      const body = { ...f, precio, codigoBarras: f.codigoBarras.trim() || null };
      return prod?.id ? api(`/productos/${prod.id}`, { method: 'PUT', body }) : api('/productos', { body });
    },
    onSuccess: () => {
      toast.success('Producto guardado');
      void qc.invalidateQueries({ queryKey: ['productos'] });
      void qc.invalidateQueries({ queryKey: ['catalogo'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal
      title={prod?.id ? 'Editar producto' : 'Nuevo servicio (sin inventario)'}
      onClose={onClose}
      footer={
        <button className="btn-primary" disabled={m.isPending || f.nombre.length < 2} onClick={() => m.mutate()}>
          Guardar
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nombre" className="col-span-2">
          <input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        </Field>
        <Field label="Código de barras" className="col-span-2" hint="Haz clic aquí y pasa el producto por el lector; o escríbelo. Vacío si no tiene.">
          <div className="relative">
            <ScanBarcode className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
            <input
              className="input tnum pl-10 tracking-wider"
              value={f.codigoBarras}
              placeholder="7591234567890"
              onChange={(e) => setF({ ...f, codigoBarras: e.target.value.replace(/\s/g, '') })}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            />
          </div>
        </Field>
        <Field label="Categoría" className="col-span-2">
          <input className="input" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} list="cats" />
          <datalist id="cats">
            {['Bebidas', 'Suplementos', 'Snacks', 'Accesorios', 'Ropa'].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <div className="col-span-2 rounded-2xl border border-white/[0.06] p-4">
          <span className="label">Moneda del precio</span>
          <MonedaSelector value={f.moneda} onChange={(mo) => setF({ ...f, moneda: mo })} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label={`Precio de venta (${INFO[f.moneda].simbolo})`}>
              <input className="input tnum text-lg" inputMode="decimal" value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })} placeholder="4.500" />
            </Field>
            {f.controlaStock && (
              <div>
                <p className="label">Costo promedio</p>
                <p className="tnum py-2 text-steel-200">{costo > 0 ? fmt(costo, prod?.moneda ?? f.moneda) : '—'}</p>
                <p className="text-[11px] text-steel-500">Sale de las facturas de compra</p>
              </div>
            )}
          </div>
          {!!prod?.id && f.moneda !== prod.moneda && costo > 0 && <p className="mt-2 text-xs text-warn">Al cambiar la moneda, el costo se convierte con la tasa de hoy.</p>}
          {precio > 0 && costo > 0 && f.moneda === prod?.moneda && (
            <p className="mt-2 text-xs text-ok">
              Ganancia por unidad: {fmt(precio - costo, f.moneda)} ({Math.round(((precio - costo) / precio) * 100)}%)
            </p>
          )}
        </div>
        {f.controlaStock ? (
          <>
            <div>
              <p className="label">En inventario</p>
              <p className="tnum py-2 text-lg font-bold text-white">{prod?.stock ?? 0}</p>
              <p className="text-[11px] text-steel-500">Entra por factura; se corrige con el conteo físico</p>
            </div>
            <Field label="Avisar cuando queden">
              <NumInput value={f.stockMinimo} min={0} onChange={(n) => setF({ ...f, stockMinimo: n })} />
            </Field>
          </>
        ) : (
          <p className="col-span-2 rounded-xl border border-white/[0.06] p-3 text-xs text-steel-400">
            Servicio sin inventario (ej. alquiler de toalla). Para mercancía que se compra usa <b>Cargar factura</b>: ahí se crea el producto con su costo.
          </p>
        )}
        <div className="col-span-2">
          <Toggle checked={f.activo} onChange={(v) => setF({ ...f, activo: v })} label="Disponible en caja" />
        </div>
      </div>
    </Modal>
  );
}

function EntradaStock({ prod, onClose }: { prod: Producto; onClose: () => void }) {
  const qc = useQueryClient();
  const [cantidad, setCantidad] = useState(1);
  const [motivo, setMotivo] = useState('');
  const m = useMutation({
    mutationFn: () => api(`/productos/${prod.id}/entrada`, { body: { cantidad: -cantidad, motivo: motivo.trim() } }),
    onSuccess: () => {
      toast.success(`Salida registrada: ${prod.nombre}`, { description: 'Quedó registrado en Inventario › Movimientos' });
      ['productos', 'catalogo', 'kardex', 'inventario-resumen'].forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal
      title={`Sacar del inventario: ${prod.nombre}`}
      size="sm"
      onClose={onClose}
      footer={
        <button className="btn-primary" disabled={cantidad < 1 || cantidad > prod.stock || motivo.trim().length < 3 || m.isPending} onClick={() => m.mutate()}>
          Aplicar
        </button>
      }
    >
      <p className="mb-4 rounded-xl border border-flame-500/20 bg-flame-500/[0.05] p-3 text-sm text-steel-300">
        ¿Llegó mercancía? Solo entra con su factura en <Link to="/panel/inventario?cargar=1" className="font-bold text-flame-400">Cargar factura</Link>. Aquí solo salidas: merma, rotura, vencido o consumo interno.
      </p>
      <p className="mb-4 text-sm text-steel-400">
        Hay <b className="text-white">{prod.stock}</b>.
      </p>
      <Field label="Unidades que salen">
        <NumInput className="text-lg" value={cantidad} min={1} max={Math.max(prod.stock, 1)} onChange={setCantidad} />
      </Field>
      <Field label="Motivo" className="mt-3">
        <input className="input" value={motivo} maxLength={150} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. se rompió una botella" />
      </Field>
      <p className="mt-3 text-sm text-steel-500">Quedarán {prod.stock - cantidad}</p>
    </Modal>
  );
}

export default function Catalogo() {
  const [tab, setTab] = useState<'planes' | 'productos'>('planes');
  const [plan, setPlan] = useState<Partial<Plan> | null | undefined>(undefined);
  const [prod, setProd] = useState<Partial<Producto> | null | undefined>(undefined);
  const [stock, setStock] = useState<Producto | null>(null);
  const [clientes, setClientes] = useState<{ plan: Plan; eliminar: boolean } | null>(null);
  const { data: cat } = useCatalogo();
  const planes = useQuery({ queryKey: ['planes'], queryFn: () => api<Plan[]>('/planes') });
  const productos = useQuery({ queryKey: ['productos'], queryFn: () => api<Producto[]>('/productos') });
  const [buscarProd, setBuscarProd] = useState('');
  const navigate = useNavigate();
  const qp = buscarProd.trim().toLowerCase();
  const listaProd = (productos.data ?? []).filter((p) => !qp || p.nombre.toLowerCase().includes(qp) || p.categoria.toLowerCase().includes(qp) || (p.codigoBarras ?? '').toLowerCase() === qp);
  const tp = useTabla(
    listaProd,
    {
      nombre: { label: 'Producto', valor: (p) => p.nombre },
      categoria: { label: 'Categoría', valor: (p) => p.categoria },
      precio: { label: 'Precio', valor: (p) => (cat ? convertir(Number(p.precio), p.moneda, 'COP', cat.tasas) : Number(p.precio)) },
      ganancia: { label: 'Ganancia', valor: (p) => (Number(p.costo ?? 0) > 0 ? (Number(p.precio) - Number(p.costo)) / Number(p.precio) : null) },
      stock: { label: 'Stock', valor: (p) => (p.controlaStock ? p.stock : null) },
    },
    { id: 'productos', orden: { col: 'nombre', dir: 'asc' } },
  );
  // Pistola en el buscador: si el código existe abre el producto; si no, crea el producto con ese código
  const escanearProd = () => {
    const c = buscarProd.trim();
    if (!c) return;
    const p = productos.data?.find((x) => x.codigoBarras && x.codigoBarras.toLowerCase() === c.toLowerCase());
    if (p) {
      setProd(p);
      setBuscarProd('');
    } else if (/^[0-9A-Za-z._-]{4,40}$/.test(c) && listaProd.length === 0) {
      // No existe: se crea cargando su factura
      navigate(`/panel/inventario?cargar=1&codigo=${encodeURIComponent(c)}`);
    }
  };

  return (
    <div>
      <PageHeader
        title="Planes y productos"
        kicker="Lo que se vende"
        actions={
          tab === 'planes' ? (
            <button className="btn-primary" onClick={() => setPlan(null)}>
              <Plus className="h-4 w-4" /> Nuevo plan
            </button>
          ) : (
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setProd(null)}>
                <Plus className="h-4 w-4" /> Servicio
              </button>
              <Link className="btn-primary" to="/panel/inventario?cargar=1">
                <FileText className="h-4 w-4" /> Cargar factura
              </Link>
            </div>
          )
        }
      >
        Cada plan y producto tiene su precio en su moneda. En caja se cobra en la que elija el cliente, con las tasas del día.
      </PageHeader>
      <div className="mb-5">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'planes', label: 'Planes' },
            { value: 'productos', label: 'Tienda e inventario' },
          ]}
        />
      </div>
      {tab === 'planes' ? (
        planes.isLoading ? (
          <Loading />
        ) : (
          <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {planes.data?.map((p) => (
              <div key={p.id} className={cx('plate p-5 pt-7', !p.activo && 'opacity-50')}>
                <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl" style={{ background: p.color }} />
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display text-lg font-extrabold text-white">{p.nombre}</p>
                    <p className="text-xs text-steel-500">
                      {p.duracion} {!p.activo && '· oculto en caja'}
                    </p>
                  </div>
                  <div className="flex gap-0.5">
                    <button className="rounded-lg p-1.5 text-steel-500 hover:text-white" title="Editar" onClick={() => setPlan(p)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button className="rounded-lg p-1.5 text-steel-500 hover:bg-bad/10 hover:text-bad" title="Eliminar plan" onClick={() => setClientes({ plan: p, eliminar: true })}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-4">
                  <Precio monto={p.precio} moneda={p.moneda} tasas={cat?.tasas} grande />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.personas > 1 && (
                    <span className="chip border-flame-500/30 text-flame-300">
                      <Users className="h-3 w-3" /> {p.personas} personas
                    </span>
                  )}
                  <span className={cx('chip', p.accesoLector ? 'border-ok/30 text-ok' : 'border-white/15 text-steel-400')}>{p.accesoLector ? 'Lector facial' : 'Por recepción'}</span>
                  {p.congelable && (
                    <span className="chip border-sky-400/30 text-sky-300">
                      <Snowflake className="h-3 w-3" /> hasta {p.maxDiasCongelado} días
                    </span>
                  )}
                </div>
                <button className="mt-3 flex w-full items-center justify-between rounded-xl border border-white/[0.06] px-3 py-2 text-left text-sm hover:border-white/20" onClick={() => setClientes({ plan: p, eliminar: false })}>
                  <span>
                    <b className={cx('tnum', p.activos ? 'text-white' : 'text-steel-500')}>{p.activos ?? 0}</b> <span className="text-steel-400">vigente(s)</span>
                    {(p.historicos ?? 0) > 0 && <span className="text-steel-500"> · {p.historicos} en total</span>}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-flame-300">
                    <Users className="h-3.5 w-3.5" /> Ver clientes
                  </span>
                </button>
              </div>
            ))}
          </div>
          <PlanesEliminados />
          </>
        )
      ) : productos.isLoading ? (
        <Loading />
      ) : (
        <div className="space-y-3">
        <div className="relative max-w-xl">
          <ScanBarcode className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
          <input
            className="input pl-11"
            placeholder="Buscar o escanear código: si existe lo abre; si no, carga su factura"
            value={buscarProd}
            onChange={(e) => setBuscarProd(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && escanearProd()}
          />
        </div>
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th><Th t={tp} col="nombre" /></th>
                <th><Th t={tp} col="categoria" /></th>
                <th className="text-right"><Th t={tp} col="precio" /></th>
                <th className="text-right"><Th t={tp} col="ganancia" /></th>
                <th className="text-right"><Th t={tp} col="stock" /></th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tp.visibles.map((p) => {
                const bajo = p.controlaStock && p.stock <= (p.stockMinimo ?? 0);
                const costo = Number(p.costo ?? 0);
                return (
                  <tr key={p.id} className={cx(!p.activo && 'opacity-50')}>
                    <td>
                      <p className="font-bold text-steel-100">{p.nombre}</p>
                      {p.codigoBarras ? (
                        <p className="tnum flex items-center gap-1 text-[11px] tracking-wider text-steel-500">
                          <ScanBarcode className="h-3 w-3" /> {p.codigoBarras}
                        </p>
                      ) : (
                        <p className="text-[11px] text-steel-600">sin código de barras</p>
                      )}
                    </td>
                    <td className="text-steel-400">{p.categoria}</td>
                    <td className="tnum text-right text-steel-100">{fmt(Number(p.precio), p.moneda)}</td>
                    <td className="tnum text-right text-steel-400">{costo > 0 ? `${Math.round(((Number(p.precio) - costo) / Number(p.precio)) * 100)}%` : '—'}</td>
                    <td className="text-right">{p.controlaStock ? <span className={cx('tnum font-bold', bajo ? 'text-warn' : 'text-steel-200')}>{p.stock}</span> : <span className="text-steel-600">—</span>}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        {p.controlaStock && (
                          <button className="btn-ghost btn-sm" title="Merma, rotura, vencido" onClick={() => setStock(p)} disabled={p.stock < 1}>
                            <PackageMinus className="h-4 w-4" /> Salida
                          </button>
                        )}
                        <button className="rounded-lg p-2 text-steel-500 hover:text-white" onClick={() => setProd(p)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Paginacion t={tp} />
        </div>
        </div>
      )}
      {plan !== undefined && (
        <PlanModal
          plan={plan}
          onClose={() => setPlan(undefined)}
          onEliminar={
            plan?.id
              ? () => {
                  const p = planes.data?.find((x) => x.id === plan.id);
                  setPlan(undefined);
                  if (p) setClientes({ plan: p, eliminar: true });
                }
              : undefined
          }
        />
      )}
      {clientes && <PlanClientesModal plan={clientes.plan} eliminar={clientes.eliminar} planes={planes.data ?? []} onClose={() => setClientes(null)} />}
      {prod !== undefined && <ProductoModal prod={prod} onClose={() => setProd(undefined)} />}
      {stock && <EntradaStock prod={stock} onClose={() => setStock(null)} />}
    </div>
  );
}
