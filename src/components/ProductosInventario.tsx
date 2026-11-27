/**
 * Productos e inventario — una sola lista con todo a la mano (dueño y administración):
 *  • Nuevo producto con su cantidad inicial y costo (o un servicio sin inventario).
 *  • Entrada (llegó mercancía), Salida (merma, rotura, consumo) y Ajustar (lo que hay en el estante).
 *  • Historial de cada producto: quién metió, sacó o ajustó, cuándo y por qué.
 * La factura completa de proveedor sigue en Inventario › Compras para compras grandes.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ClipboardCheck, FileText, History, PackageMinus, PackagePlus, Pencil, Plus, ScanBarcode } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { fechaHora } from '../lib/format';
import { useCatalogo } from '../lib/hooks';
import { convertir, fmt, INFO, leerMonto, MONEDAS, type Moneda } from '../lib/monedas';
import type { Producto } from '../lib/types';
import { Paginacion, Th, useTabla } from './Tabla';
import { cx, Drawer, Empty, Field, Loading, Modal, NumInput, Tabs, Toggle } from './ui';

const CLAVES = ['productos', 'catalogo', 'kardex', 'inventario-resumen', 'compras', 'finanzas', 'caja-vivo', 'producto-historial'];
const useRefrescar = () => {
  const qc = useQueryClient();
  return () => CLAVES.forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
};
const num = (s: string) => (s.trim() ? leerMonto(s) : 0);

export const TIPOS_KARDEX: Record<string, { label: string; color: string }> = {
  venta: { label: 'Venta', color: 'text-steel-300' },
  anulacion: { label: 'Venta anulada', color: 'text-sky-300' },
  devolucion: { label: 'Devolución', color: 'text-sky-300' },
  compra: { label: 'Entrada / compra', color: 'text-ok' },
  compra_anulada: { label: 'Compra anulada', color: 'text-warn' },
  ajuste: { label: 'Inicial / salida', color: 'text-warn' },
  conteo: { label: 'Ajuste por conteo', color: 'text-flame-300' },
};

// ═════════════ Lista ═════════════

export function ProductosPanel() {
  const productos = useQuery({ queryKey: ['productos'], queryFn: () => api<Producto[]>('/productos') });
  const { data: cat } = useCatalogo();
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'bajos' | 'agotados'>('todos');
  const [editar, setEditar] = useState<Partial<Producto> | null | undefined>(undefined);
  const [mover, setMover] = useState<{ p: Producto; modo: Modo } | null>(null);
  const [historial, setHistorial] = useState<Producto | null>(null);

  const q = buscar.trim().toLowerCase();
  const todos = productos.data ?? [];
  const bajo = (p: Producto) => p.controlaStock && p.stock > 0 && p.stock <= (p.stockMinimo ?? 0);
  const agotado = (p: Producto) => p.controlaStock && p.stock <= 0 && p.activo !== false;
  const lista = todos.filter((p) => {
    if (filtro === 'bajos' && !bajo(p)) return false;
    if (filtro === 'agotados' && !agotado(p)) return false;
    return !q || p.nombre.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q) || (p.codigoBarras ?? '').toLowerCase() === q;
  });
  const t = useTabla(
    lista,
    {
      nombre: { label: 'Producto', valor: (p) => p.nombre },
      categoria: { label: 'Categoría', valor: (p) => p.categoria },
      precio: { label: 'Precio', valor: (p) => (cat ? convertir(Number(p.precio), p.moneda, 'COP', cat.tasas) : Number(p.precio)) },
      ganancia: { label: 'Ganancia', valor: (p) => (Number(p.costo ?? 0) > 0 ? (Number(p.precio) - Number(p.costo)) / Number(p.precio) : null) },
      stock: { label: 'Hay', valor: (p) => (p.controlaStock ? p.stock : null) },
    },
    { id: 'productos-inv', orden: { col: 'nombre', dir: 'asc' } },
  );

  // Pistola: si el código existe abre la entrada de ese producto; si no, crea el producto con ese código
  const escanear = () => {
    const c = buscar.trim();
    if (!c) return;
    const p = todos.find((x) => x.codigoBarras && x.codigoBarras.toLowerCase() === c.toLowerCase());
    if (p) {
      if (p.controlaStock) setMover({ p, modo: 'entrada' });
      else setEditar(p);
      setBuscar('');
    } else if (/^[0-9A-Za-z._-]{4,40}$/.test(c) && lista.length === 0) {
      setEditar({ codigoBarras: c });
      setBuscar('');
    }
  };

  if (productos.isLoading) return <Loading />;
  const nAgotados = todos.filter(agotado).length;
  const nBajos = todos.filter(bajo).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md">
          <ScanBarcode className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
          <input className="input pl-11" placeholder="Buscar o escanear código…" value={buscar} onChange={(e) => setBuscar(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && escanear()} />
        </div>
        <Tabs
          value={filtro}
          onChange={setFiltro}
          items={[
            { value: 'todos', label: `Todos (${todos.length})` },
            { value: 'agotados', label: <span className={nAgotados ? 'text-bad' : ''}>Agotados ({nAgotados})</span> },
            { value: 'bajos', label: <span className={nBajos ? 'text-warn' : ''}>Por acabarse ({nBajos})</span> },
          ]}
        />
        <div className="ml-auto flex gap-2">
          <Link className="btn-ghost" to="/panel/inventario?cargar=1" title="Factura completa de un proveedor, con varios productos">
            <FileText className="h-4 w-4" /> Factura de proveedor
          </Link>
          <button className="btn-primary" onClick={() => setEditar(null)}>
            <Plus className="h-4 w-4" /> Nuevo producto
          </button>
        </div>
      </div>

      {nAgotados > 0 && filtro === 'todos' && (
        <button onClick={() => setFiltro('agotados')} className="flex w-full items-center gap-2 rounded-xl border border-bad/25 bg-bad/[0.06] px-4 py-2.5 text-left text-sm text-steel-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-bad" />
          <span>
            <b>{nAgotados} producto(s) agotado(s)</b>: en caja no se pueden vender. Dales <b>Entrada</b> cuando llegue mercancía o <b>Ajustar</b> si sí hay en el estante.
          </span>
        </button>
      )}

      <div className="card overflow-x-auto">
        {lista.length === 0 ? (
          <Empty icon={<PackagePlus className="h-7 w-7" />} title={todos.length ? 'Nada con ese filtro' : 'Todavía no hay productos'} hint={todos.length ? 'Prueba con otro filtro o búsqueda.' : 'Crea el primero con «Nuevo producto».'} />
        ) : (
          <>
            <table className="table-base">
              <thead>
                <tr>
                  <th><Th t={t} col="nombre" /></th>
                  <th><Th t={t} col="categoria" /></th>
                  <th className="text-right"><Th t={t} col="precio" /></th>
                  <th className="text-right"><Th t={t} col="ganancia" /></th>
                  <th className="text-right"><Th t={t} col="stock" /></th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {t.visibles.map((p) => {
                  const costo = Number(p.costo ?? 0);
                  return (
                    <tr key={p.id} className={cx(p.activo === false && 'opacity-50')}>
                      <td>
                        <button className="text-left" onClick={() => setEditar(p)}>
                          <p className="font-bold text-steel-100 hover:text-flame-300">{p.nombre}</p>
                          <p className="tnum text-[11px] text-steel-500">
                            {p.codigoBarras ? `▮ ${p.codigoBarras}` : 'sin código'}
                            {!p.controlaStock && ' · servicio'}
                            {p.activo === false && ' · oculto en caja'}
                          </p>
                        </button>
                      </td>
                      <td className="text-steel-400">{p.categoria}</td>
                      <td className="tnum text-right text-steel-100">{fmt(Number(p.precio), p.moneda)}</td>
                      <td className="tnum text-right text-steel-400">{costo > 0 && Number(p.precio) > 0 ? `${Math.round(((Number(p.precio) - costo) / Number(p.precio)) * 100)}%` : '—'}</td>
                      <td className="text-right">
                        {p.controlaStock ? (
                          agotado(p) ? (
                            <span className="chip border-bad/30 text-bad">Agotado</span>
                          ) : (
                            <span className={cx('tnum font-bold', bajo(p) ? 'text-warn' : 'text-steel-100')}>{p.stock}</span>
                          )
                        ) : (
                          <span className="text-steel-600">—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          {p.controlaStock && (
                            <>
                              <button className="btn-primary btn-sm" onClick={() => setMover({ p, modo: 'entrada' })} title="Llegó mercancía">
                                <PackagePlus className="h-4 w-4" /> Entrada
                              </button>
                              <button className="btn-ghost btn-sm" onClick={() => setMover({ p, modo: 'salida' })} disabled={p.stock < 1} title="Merma, rotura, vencido, consumo">
                                <PackageMinus className="h-4 w-4" /> Salida
                              </button>
                              <button className="btn-ghost btn-sm" onClick={() => setMover({ p, modo: 'ajuste' })} title="Contar lo que hay en el estante">
                                <ClipboardCheck className="h-4 w-4" /> Ajustar
                              </button>
                              <button className="rounded-lg p-2 text-steel-500 hover:text-white" onClick={() => setHistorial(p)} title="Historial">
                                <History className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button className="rounded-lg p-2 text-steel-500 hover:text-white" onClick={() => setEditar(p)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Paginacion t={t} />
          </>
        )}
      </div>
      {editar !== undefined && <ProductoModal prod={editar} onClose={() => setEditar(undefined)} />}
      {mover && <MoverStockModal prod={mover.p} modoInicial={mover.modo} onClose={() => setMover(null)} />}
      {historial && <HistorialProducto prod={historial} onClose={() => setHistorial(null)} />}
    </div>
  );
}

// ═════════════ Crear / editar ═════════════

export function ProductoModal({ prod, onClose }: { prod: Partial<Producto> | null; onClose: () => void }) {
  const refrescar = useRefrescar();
  const { data: cat } = useCatalogo();
  const nuevo = !prod?.id;
  const [f, setF] = useState({
    nombre: prod?.nombre ?? '',
    categoria: prod?.categoria ?? 'Bebidas',
    precio: prod?.precio !== undefined ? String(prod.precio).replace('.', ',') : '',
    moneda: prod?.moneda ?? ('COP' as Moneda),
    stockMinimo: prod?.stockMinimo ?? 5,
    controlaStock: prod?.controlaStock ?? true,
    activo: prod?.activo ?? true,
    codigoBarras: prod?.codigoBarras ?? '',
  });
  const [inicial, setInicial] = useState(0);
  const [costo, setCosto] = useState('');
  const precio = num(f.precio);
  const costoN = nuevo ? num(costo) : Number(prod?.costo ?? 0);
  const m = useMutation({
    mutationFn: () => {
      const body = { ...f, precio, codigoBarras: f.codigoBarras.trim() || null, ...(nuevo && f.controlaStock && { stock: inicial, costo: costoN }) };
      return nuevo ? api<Producto>('/productos', { body }) : api<Producto>(`/productos/${prod!.id}`, { method: 'PUT', body });
    },
    onSuccess: (p) => {
      toast.success(nuevo ? `${p.nombre} creado${f.controlaStock ? ` con ${p.stock} unidad(es)` : ''}` : 'Producto guardado', { description: nuevo && f.controlaStock && p.stock > 0 ? 'Ya se puede vender en caja' : undefined });
      refrescar();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const faltaCosto = nuevo && f.controlaStock && inicial > 0 && costoN <= 0;
  const bajoCosto = costoN > 0 && precio > 0 && precio < costoN && f.moneda === (prod?.moneda ?? f.moneda);
  return (
    <Modal
      title={nuevo ? 'Nuevo producto' : `Editar: ${prod?.nombre}`}
      onClose={onClose}
      footer={
        <button className="btn-primary" disabled={m.isPending || f.nombre.trim().length < 2 || (f.controlaStock && precio <= 0) || faltaCosto || bajoCosto} onClick={() => m.mutate()}>
          {nuevo ? 'Crear producto' : 'Guardar'}
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nombre" className="col-span-2">
          <input className="input" autoFocus={nuevo} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Agua mineral 600 ml" />
        </Field>
        <Field label="Código de barras" hint="Haz clic y pásalo por el lector. Vacío si no tiene.">
          <div className="relative">
            <ScanBarcode className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
            <input className="input tnum pl-10 tracking-wider" value={f.codigoBarras} placeholder="7591234567890" onChange={(e) => setF({ ...f, codigoBarras: e.target.value.replace(/\s/g, '') })} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} />
          </div>
        </Field>
        <Field label="Categoría">
          <input className="input" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} list="cats-prod" />
          <datalist id="cats-prod">
            {['Bebidas', 'Suplementos', 'Snacks', 'Accesorios', 'Ropa', 'Servicios'].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        <div className="col-span-2 rounded-2xl border border-white/[0.06] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="label mb-0">Precio de venta</span>
            <Tabs value={f.moneda} onChange={(mo) => setF({ ...f, moneda: mo })} items={MONEDAS.map((x) => ({ value: x, label: INFO[x].simbolo }))} />
          </div>
          <input className="input tnum text-lg" inputMode="decimal" value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })} placeholder={f.moneda === 'COP' ? '4.500' : '1,50'} />
          {cat && precio > 0 && (
            <p className="mt-2 text-xs text-steel-500">
              Hoy equivale a{' '}
              {MONEDAS.filter((x) => x !== f.moneda)
                .map((x) => fmt(convertir(precio, f.moneda, x, cat.tasas), x))
                .join(' · ')}
            </p>
          )}
          {!nuevo && !!prod?.id && f.moneda !== prod.moneda && Number(prod.costo) > 0 && <p className="mt-2 text-xs text-warn">Al cambiar la moneda, el costo se convierte con la tasa de hoy.</p>}
        </div>

        <div className="col-span-2 rounded-2xl border border-white/[0.06]">
          <Toggle
            checked={f.controlaStock}
            onChange={(v) => setF({ ...f, controlaStock: v })}
            label="Lleva inventario (se cuentan las unidades)"
            hint={f.controlaStock ? 'Agua, proteína, barras…: se descuenta al vender y avisa cuando se acaba' : 'Servicio sin unidades (ej. alquiler de toalla): se vende sin límite'}
          />
        </div>

        {f.controlaStock && nuevo && (
          <div className="col-span-2 grid grid-cols-2 gap-4 rounded-2xl border border-flame-500/20 bg-flame-500/[0.04] p-4">
            <Field label="¿Cuántas hay ahora?" hint="Lo que hay en el estante hoy. Puede ser 0.">
              <NumInput className="text-lg" value={inicial} min={0} max={1_000_000} onChange={setInicial} />
            </Field>
            <Field label={`Costo de cada una (${INFO[f.moneda].simbolo})`} hint="Lo que te costó. Para saber la ganancia.">
              <input className={cx('input tnum text-lg', faltaCosto && 'border-bad/50')} inputMode="decimal" value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="0" />
            </Field>
          </div>
        )}
        {f.controlaStock && !nuevo && (
          <div className="col-span-2 grid grid-cols-3 gap-3 rounded-2xl border border-white/[0.06] p-4 text-sm">
            <div>
              <p className="label">Hay</p>
              <p className="tnum text-lg font-bold text-white">{prod?.stock ?? 0}</p>
            </div>
            <div>
              <p className="label">Costo promedio</p>
              <p className="tnum text-steel-200">{costoN > 0 ? fmt(costoN, prod?.moneda ?? f.moneda) : '—'}</p>
            </div>
            <p className="self-center text-[11px] text-steel-500">Las unidades cambian con Entrada, Salida o Ajustar: así queda en el historial.</p>
          </div>
        )}
        {f.controlaStock && (
          <Field label="Avisar cuando queden" className="col-span-2">
            <NumInput value={f.stockMinimo} min={0} onChange={(n) => setF({ ...f, stockMinimo: n })} />
          </Field>
        )}
        {precio > 0 && costoN > 0 && (
          <p className={cx('col-span-2 text-sm', bajoCosto ? 'text-bad' : 'text-ok')}>
            {bajoCosto ? `El precio queda por debajo del costo (${fmt(costoN, f.moneda)})` : `Ganancia por unidad: ${fmt(precio - costoN, f.moneda)} (${Math.round(((precio - costoN) / precio) * 100)}%)`}
          </p>
        )}
        <div className="col-span-2">
          <Toggle checked={f.activo} onChange={(v) => setF({ ...f, activo: v })} label="Disponible en caja" />
        </div>
      </div>
    </Modal>
  );
}

// ═════════════ Entrada / Salida / Ajustar ═════════════

type Modo = 'entrada' | 'salida' | 'ajuste';
type Pago = 'admin' | 'caja' | 'credito';

interface CajaAbierta {
  id: string;
  cajero: string;
}

export function MoverStockModal({ prod, modoInicial, onClose }: { prod: Producto; modoInicial: Modo; onClose: () => void }) {
  const refrescar = useRefrescar();
  const { data: cat } = useCatalogo();
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [cantidad, setCantidad] = useState(modoInicial === 'ajuste' ? Math.max(prod.stock, 0) : 1);
  const [motivo, setMotivo] = useState('');
  // Entrada
  const [moneda, setMoneda] = useState<Moneda>(prod.moneda);
  const [costo, setCosto] = useState(Number(prod.costo) > 0 ? String(prod.costo).replace('.', ',') : '');
  const [precio, setPrecio] = useState('');
  const [pago, setPago] = useState<Pago>('admin');
  const [metodo, setMetodo] = useState('efectivo');
  const [turnoId, setTurnoId] = useState('');
  const [proveedorId, setProveedorId] = useState<number | ''>('');
  const cajas = useQuery({ queryKey: ['caja-vivo'], queryFn: () => api<{ cajas: CajaAbierta[] }>('/caja/en-vivo'), enabled: modo === 'entrada' });
  const proveedores = useQuery({ queryKey: ['proveedores'], queryFn: () => api<Array<{ id: number; nombre: string; activo: boolean }>>('/inventario/proveedores'), enabled: modo === 'entrada' });
  const metodos = (cat?.metodos ?? []).filter((m) => m.monedas.includes(moneda));
  const metodoOk = pago === 'caja' ? 'efectivo' : metodos.some((m) => m.codigo === metodo) ? metodo : (metodos[0]?.codigo ?? 'efectivo');
  const costoN = num(costo);
  const total = costoN * cantidad;
  const cambiarModo = (m: Modo) => {
    setModo(m);
    setCantidad(m === 'ajuste' ? Math.max(prod.stock, 0) : 1);
  };

  const g = useMutation({
    mutationFn: () => {
      if (modo === 'ajuste') return api<Producto>(`/productos/${prod.id}/ajuste`, { body: { contado: cantidad, motivo: motivo.trim() } });
      if (modo === 'salida') return api<Producto>(`/productos/${prod.id}/entrada`, { body: { cantidad: -cantidad, motivo: motivo.trim() } });
      return api<Producto>(`/productos/${prod.id}/entrada`, {
        body: {
          cantidad,
          costoUnitario: costoN,
          moneda,
          precioVenta: precio.trim() ? num(precio) : null,
          proveedorId: proveedorId || null,
          motivo: motivo.trim() || null,
          pago: pago === 'credito' ? null : { metodo: metodoOk, turnoId: pago === 'caja' ? turnoId : null },
        },
      });
    },
    onSuccess: (p) => {
      toast.success(modo === 'entrada' ? `+${cantidad} ${prod.nombre}` : modo === 'salida' ? `−${cantidad} ${prod.nombre}` : `${prod.nombre} ajustado`, { description: `Ahora hay ${p.stock}. Quedó en el historial.` });
      refrescar();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const queda = modo === 'entrada' ? prod.stock + cantidad : modo === 'salida' ? prod.stock - cantidad : cantidad;
  const dif = cantidad - prod.stock;
  const valido =
    modo === 'entrada'
      ? cantidad >= 1 && costo.trim() !== '' && (pago !== 'caja' || !!turnoId)
      : modo === 'salida'
        ? cantidad >= 1 && cantidad <= prod.stock && motivo.trim().length >= 3
        : dif !== 0 && motivo.trim().length >= 3;

  return (
    <Modal
      title={prod.nombre}
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-sm text-steel-400">
            Hay <b className="tnum text-white">{prod.stock}</b> → quedarán <b className={cx('tnum', queda < 0 ? 'text-bad' : 'text-ok')}>{queda}</b>
          </p>
          <button className="btn-primary" disabled={!valido || g.isPending} onClick={() => g.mutate()}>
            {g.isPending ? 'Guardando…' : modo === 'entrada' ? 'Registrar entrada' : modo === 'salida' ? 'Registrar salida' : 'Ajustar'}
          </button>
        </div>
      }
    >
      <div className="mb-5">
        <Tabs
          value={modo}
          onChange={cambiarModo}
          items={[
            { value: 'entrada', label: 'Entrada' },
            { value: 'salida', label: 'Salida' },
            { value: 'ajuste', label: 'Ajustar conteo' },
          ]}
        />
      </div>

      {modo === 'entrada' && (
        <div className="grid gap-4">
          <p className="text-sm text-steel-400">Llegó mercancía. Se suma al inventario, se recalcula el costo promedio y queda como compra.</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="¿Cuántas llegaron?">
              <NumInput className="text-lg" value={cantidad} min={1} max={100_000} onChange={setCantidad} />
            </Field>
            <Field label="Costo de cada una">
              <div className="flex gap-2">
                <input className="input tnum text-lg" inputMode="decimal" value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="0" autoFocus />
                <select className="input w-20" value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)}>
                  {MONEDAS.map((x) => (
                    <option key={x} value={x}>
                      {INFO[x].simbolo}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
          </div>
          {costoN > 0 && <p className="-mt-2 text-sm text-steel-300">Total: <b className="tnum text-white">{fmt(total, moneda)}</b></p>}

          <div>
            <span className="label">¿Cómo se pagó?</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  { v: 'admin', t: 'Por administración', d: 'No toca las cajas de turno' },
                  { v: 'caja', t: 'Con dinero de una caja', d: 'Sale del efectivo de ese turno' },
                  { v: 'credito', t: 'Se debe', d: 'Queda por pagar al proveedor' },
                ] as const
              ).map((o) => (
                <button key={o.v} onClick={() => setPago(o.v)} className={cx('rounded-xl border p-2.5 text-left transition', pago === o.v ? 'border-flame-500/60 bg-flame-500/[0.08]' : 'border-white/[0.07] hover:border-white/15')}>
                  <p className="text-sm font-bold text-steel-100">{o.t}</p>
                  <p className="text-[11px] text-steel-500">{o.d}</p>
                </button>
              ))}
            </div>
            {pago === 'admin' && (
              <select className="input mt-2" value={metodoOk} onChange={(e) => setMetodo(e.target.value)}>
                {metodos.map((x) => (
                  <option key={x.codigo} value={x.codigo}>
                    {x.nombre}
                  </option>
                ))}
              </select>
            )}
            {pago === 'caja' &&
              (cajas.data?.cajas.length ? (
                <select className="input mt-2" value={turnoId} onChange={(e) => setTurnoId(e.target.value)}>
                  <option value="">Elige la caja de la que salió el efectivo…</option>
                  {cajas.data.cajas.map((c) => (
                    <option key={c.id} value={c.id}>
                      Caja de {c.cajero} (efectivo)
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-2 text-xs text-warn">No hay cajas abiertas ahora. Márcalo como pagado por administración.</p>
              ))}
          </div>

          <details className="rounded-xl border border-white/[0.06] p-3">
            <summary className="cursor-pointer text-sm font-bold text-steel-300">Más datos (opcional): proveedor, nuevo precio, nota</summary>
            <div className="mt-3 grid gap-3">
              <Field label="Proveedor">
                <select className="input" value={proveedorId} onChange={(e) => setProveedorId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Sin proveedor (compra en mercado, tienda…)</option>
                  {(proveedores.data ?? [])
                    .filter((p) => p.activo)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label={`Nuevo precio de venta (${INFO[prod.moneda].simbolo})`} hint={`Hoy se vende a ${fmt(Number(prod.precio), prod.moneda)}. Vacío = queda igual.`}>
                <input className="input tnum" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="Igual" />
              </Field>
              <Field label="Nota">
                <input className="input" value={motivo} maxLength={150} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. compra en el mercado" />
              </Field>
            </div>
          </details>
        </div>
      )}

      {modo === 'salida' && (
        <div className="grid gap-4">
          <p className="text-sm text-steel-400">Sale sin venderse: merma, rotura, vencido o consumo interno.</p>
          <Field label="Unidades que salen">
            <NumInput className="text-lg" value={cantidad} min={1} max={Math.max(prod.stock, 1)} onChange={setCantidad} />
          </Field>
          <Field label="Motivo">
            <input className="input" value={motivo} maxLength={150} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. se rompió una botella" autoFocus />
          </Field>
        </div>
      )}

      {modo === 'ajuste' && (
        <div className="grid gap-4">
          <p className="text-sm text-steel-400">Cuenta lo que hay en el estante y escríbelo. La diferencia queda en el historial con tu nombre.</p>
          <Field label="¿Cuántas hay de verdad?">
            <NumInput className="text-lg" value={cantidad} min={0} max={1_000_000} onChange={setCantidad} />
          </Field>
          {dif !== 0 && (
            <p className={cx('text-sm font-bold', dif > 0 ? 'text-ok' : 'text-bad')}>
              {dif > 0 ? `Sobran ${dif} (el sistema decía ${prod.stock})` : `Faltan ${-dif} (el sistema decía ${prod.stock})`}
              {Number(prod.costo) > 0 && <span className="font-normal text-steel-400"> · {fmt(Math.abs(dif) * Number(prod.costo), prod.moneda)} a costo</span>}
            </p>
          )}
          <Field label="¿Por qué no cuadraba?">
            <input className="input" value={motivo} maxLength={150} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. se cargó sin unidades, conteo del viernes…" />
          </Field>
        </div>
      )}
    </Modal>
  );
}

// ═════════════ Historial de un producto ═════════════

export function HistorialProducto({ prod, onClose }: { prod: Producto; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['producto-historial', prod.id],
    queryFn: () => api<Array<{ id: number; creadoEn: string; tipo: string; cantidad: number; stockResultante: number | null; referencia: string | null; usuario: string | null }>>('/inventario/movimientos', { query: { productoId: prod.id } }),
  });
  return (
    <Drawer title={prod.nombre} subtitle={`Historial de unidades · hay ${prod.stock}`} onClose={onClose}>
      {isLoading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty icon={<History className="h-7 w-7" />} title="Sin movimientos todavía" />
      ) : (
        <div className="space-y-1.5">
          {data.map((k) => {
            const tipo = TIPOS_KARDEX[k.tipo] ?? { label: k.tipo, color: 'text-steel-300' };
            return (
              <div key={k.id} className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
                <span className={cx('tnum w-12 shrink-0 text-right font-bold', k.cantidad > 0 ? 'text-ok' : 'text-bad')}>
                  {k.cantidad > 0 ? `+${k.cantidad}` : k.cantidad}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cx('text-sm font-bold', tipo.color)}>{tipo.label}</p>
                  {k.referencia && <p className="text-xs text-steel-400">{k.referencia}</p>}
                  <p className="text-[11px] text-steel-600">
                    {fechaHora(k.creadoEn)}
                    {k.usuario && ` · ${k.usuario}`}
                  </p>
                </div>
                <span className="tnum shrink-0 text-xs text-steel-500">quedó {k.stockResultante ?? '—'}</span>
              </div>
            );
          })}
        </div>
      )}
    </Drawer>
  );
}
