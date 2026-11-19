import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, PackagePlus, Pencil, Plus, RotateCcw, Snowflake, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Precio } from '../../components/PanelPago';
import { PlanClientesModal } from '../../components/PlanClientes';
import { cx, Field, Loading, Modal, NumInput, PageHeader, Tabs, Toggle } from '../../components/ui';
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
    costo: prod?.costo !== undefined ? String(prod.costo).replace('.', ',') : '',
    stock: prod?.stock ?? 0,
    stockMinimo: prod?.stockMinimo ?? 5,
    controlaStock: prod?.controlaStock ?? true,
    activo: prod?.activo ?? true,
  });
  const precio = leerMonto(f.precio);
  const costo = leerMonto(f.costo);
  const m = useMutation({
    mutationFn: () => {
      const body = { ...f, precio, costo };
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
      title={prod?.id ? 'Editar producto' : 'Nuevo producto'}
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
            <Field label={`Costo (${INFO[f.moneda].simbolo})`} hint="Para calcular la ganancia">
              <input className="input tnum" inputMode="decimal" value={f.costo} onChange={(e) => setF({ ...f, costo: e.target.value })} />
            </Field>
          </div>
          {precio > 0 && costo > 0 && (
            <p className="mt-2 text-xs text-ok">
              Ganancia por unidad: {fmt(precio - costo, f.moneda)} ({Math.round(((precio - costo) / precio) * 100)}%)
            </p>
          )}
        </div>
        {!prod?.id && (
          <Field label="Stock inicial">
            <NumInput value={f.stock} min={0} onChange={(n) => setF({ ...f, stock: n })} />
          </Field>
        )}
        <Field label="Avisar cuando queden">
          <NumInput value={f.stockMinimo} min={0} onChange={(n) => setF({ ...f, stockMinimo: n })} />
        </Field>
        <div className="col-span-2 grid grid-cols-2">
          <Toggle checked={f.controlaStock} onChange={(v) => setF({ ...f, controlaStock: v })} label="Controlar inventario" />
          <Toggle checked={f.activo} onChange={(v) => setF({ ...f, activo: v })} label="Disponible en caja" />
        </div>
      </div>
    </Modal>
  );
}

function EntradaStock({ prod, onClose }: { prod: Producto; onClose: () => void }) {
  const qc = useQueryClient();
  const [cantidad, setCantidad] = useState(12);
  const m = useMutation({
    mutationFn: () => api(`/productos/${prod.id}/entrada`, { body: { cantidad } }),
    onSuccess: () => {
      toast.success(`Stock actualizado: ${prod.nombre}`);
      void qc.invalidateQueries({ queryKey: ['productos'] });
      void qc.invalidateQueries({ queryKey: ['catalogo'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal title={`Mercancía: ${prod.nombre}`} size="sm" onClose={onClose} footer={<button className="btn-primary" onClick={() => m.mutate()}>Aplicar</button>}>
      <p className="mb-4 text-sm text-steel-400">
        Stock actual: <b className="text-white">{prod.stock}</b>. Usa un número negativo para descontar merma.
      </p>
      <Field label="Unidades que entran">
        <NumInput className="text-lg" value={cantidad} min={-100000} max={100000} onChange={setCantidad} />
      </Field>
      <p className="mt-3 text-sm text-steel-500">Quedará en {prod.stock + cantidad}</p>
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

  return (
    <div>
      <PageHeader
        title="Planes y productos"
        kicker="Lo que se vende"
        actions={
          <button className="btn-primary" onClick={() => (tab === 'planes' ? setPlan(null) : setProd(null))}>
            <Plus className="h-4 w-4" /> {tab === 'planes' ? 'Nuevo plan' : 'Nuevo producto'}
          </button>
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
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th className="text-right">Precio</th>
                <th className="text-right">Ganancia</th>
                <th className="text-right">Stock</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {productos.data?.map((p) => {
                const bajo = p.controlaStock && p.stock <= (p.stockMinimo ?? 0);
                const costo = Number(p.costo ?? 0);
                return (
                  <tr key={p.id} className={cx(!p.activo && 'opacity-50')}>
                    <td className="font-bold text-steel-100">{p.nombre}</td>
                    <td className="text-steel-400">{p.categoria}</td>
                    <td className="tnum text-right text-steel-100">{fmt(Number(p.precio), p.moneda)}</td>
                    <td className="tnum text-right text-steel-400">{costo > 0 ? `${Math.round(((Number(p.precio) - costo) / Number(p.precio)) * 100)}%` : '—'}</td>
                    <td className="text-right">{p.controlaStock ? <span className={cx('tnum font-bold', bajo ? 'text-warn' : 'text-steel-200')}>{p.stock}</span> : <span className="text-steel-600">—</span>}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        {p.controlaStock && (
                          <button className="btn-ghost btn-sm" onClick={() => setStock(p)}>
                            <PackagePlus className="h-4 w-4" /> Entrada
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
