/**
 * Inventario: compras a proveedores (con costo), conteo físico ciego,
 * movimientos de cada unidad (kardex) y proveedores.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Ban, Boxes, ClipboardCheck, FileImage, HandCoins, History, PackagePlus, Pencil, Plus, ScanBarcode, Search, Truck, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Drawer, Empty, Field, Loading, Modal, NumInput, PageHeader, Stat, Tabs, cx } from '../../components/ui';
import { api, API, session } from '../../lib/api';
import { fecha, fechaHora, hace, hoyISO, money, sumarDias } from '../../lib/format';
import { useCatalogo } from '../../lib/hooks';
import { fmt, INFO, leerMonto, MONEDAS, redondear, type Moneda } from '../../lib/monedas';
import type { Producto } from '../../lib/types';

interface Resumen {
  productos: number;
  unidades: number;
  valorCosto: number;
  valorVenta: number;
  sinCosto: number;
  bajoMinimo: Array<{ id: number; nombre: string; stock: number; minimo: number }>;
  porPagar: { compras: number; ref: number; texto: string };
}
interface Proveedor {
  id: number;
  nombre: string;
  documento: string | null;
  telefono: string | null;
  contacto: string | null;
  notas: string | null;
  activo: boolean;
  compras: number;
  ultimaCompra: string | null;
}
interface Compra {
  id: number;
  fecha: string;
  factura: string | null;
  moneda: Moneda;
  total: number;
  totalRef: number;
  saldo: number;
  estado: 'pagada' | 'pendiente' | 'anulada';
  nota: string | null;
  soporteId: number | null;
  creadoEn: string;
  motivoAnulacion: string | null;
  proveedor: string | null;
  registro: string;
  items: string[];
  totalTexto: string;
  saldoTexto: string;
}

const TIPOS_KARDEX: Record<string, { label: string; color: string }> = {
  venta: { label: 'Venta', color: 'text-steel-300' },
  anulacion: { label: 'Venta anulada', color: 'text-sky-300' },
  devolucion: { label: 'Devolución', color: 'text-sky-300' },
  compra: { label: 'Compra', color: 'text-ok' },
  compra_anulada: { label: 'Compra anulada', color: 'text-warn' },
  ajuste: { label: 'Ajuste manual', color: 'text-warn' },
  conteo: { label: 'Conteo físico', color: 'text-flame-300' },
};

const useProductos = () => useQuery({ queryKey: ['productos'], queryFn: () => api<Producto[]>('/productos') });
const useProveedores = () => useQuery({ queryKey: ['proveedores'], queryFn: () => api<Proveedor[]>('/inventario/proveedores') });

export default function Inventario() {
  const [tab, setTab] = useState<'compras' | 'conteo' | 'movimientos' | 'proveedores'>('compras');
  const { data: r } = useQuery({ queryKey: ['inventario-resumen'], queryFn: () => api<Resumen>('/inventario/resumen') });
  return (
    <div>
      <PageHeader title="Inventario" kicker="Mercancía">
        Lo que entra (compras), lo que sale y lo que de verdad hay en el estante.
      </PageHeader>
      {r && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Inventario a costo" value={money(r.valorCosto)} icon={<Boxes className="h-5 w-5" />} hint={`${r.unidades} unidades · ${r.productos} productos`} />
          <Stat label="Inventario a precio de venta" value={money(r.valorVenta)} icon={<PackagePlus className="h-5 w-5" />} hint={r.sinCosto ? `${r.sinCosto} producto(s) sin costo` : 'Todos tienen costo'} />
          <Stat
            label="Bajo el mínimo"
            value={<span className={r.bajoMinimo.length ? 'text-warn' : ''}>{r.bajoMinimo.length}</span>}
            icon={<AlertTriangle className="h-5 w-5" />}
            hint={r.bajoMinimo.slice(0, 3).map((p) => `${p.nombre} (${p.stock})`).join(', ') || 'Nada por reponer'}
          />
          <Stat label="Por pagar a proveedores" value={<span className={r.porPagar.ref ? 'text-warn' : ''}>{money(r.porPagar.ref)}</span>} icon={<HandCoins className="h-5 w-5" />} hint={r.porPagar.compras ? `${r.porPagar.compras} compra(s) · ${r.porPagar.texto}` : 'Sin deudas con proveedores'} />
        </div>
      )}
      <div className="mb-5">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'compras', label: 'Compras' },
            { value: 'conteo', label: 'Conteo físico' },
            { value: 'movimientos', label: 'Movimientos' },
            { value: 'proveedores', label: 'Proveedores' },
          ]}
        />
      </div>
      {tab === 'compras' && <Compras />}
      {tab === 'conteo' && <Conteo />}
      {tab === 'movimientos' && <Movimientos />}
      {tab === 'proveedores' && <Proveedores />}
    </div>
  );
}

const invalidarInventario = (qc: ReturnType<typeof useQueryClient>) => ['compras', 'productos', 'inventario-resumen', 'kardex', 'proveedores', 'catalogo', 'finanzas'].forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));

// ═════════════ Compras ═════════════

function Compras() {
  const [desde, setDesde] = useState(sumarDias(hoyISO(), -30));
  const [hasta, setHasta] = useState(hoyISO());
  const [pendientes, setPendientes] = useState(false);
  const [nueva, setNueva] = useState(false);
  const [ver, setVer] = useState<Compra | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['compras', desde, hasta, pendientes],
    queryFn: () => api<Compra[]>('/inventario/compras', { query: pendientes ? { pendientes: 1 } : { desde, hasta } }),
  });
  const vigentes = (data ?? []).filter((c) => c.estado !== 'anulada');
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        {!pendientes && (
          <>
            <Field label="Desde">
              <input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </Field>
            <Field label="Hasta">
              <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </Field>
          </>
        )}
        <label className="flex cursor-pointer items-center gap-2 pb-3 text-sm font-bold text-steel-300">
          <input type="checkbox" className="h-4 w-4 accent-[#FF8A10]" checked={pendientes} onChange={(e) => setPendientes(e.target.checked)} /> Solo las que se deben
        </label>
        <button className="btn-primary ml-auto" onClick={() => setNueva(true)}>
          <Plus className="h-4 w-4" /> Registrar compra
        </button>
      </div>
      <div className="card overflow-hidden">
        {isLoading ? (
          <Loading />
        ) : !data?.length ? (
          <Empty icon={<Truck className="h-7 w-7" />} title="Sin compras en estas fechas" hint="Registra aquí la mercancía que llega: suma al inventario y calcula el costo real de cada producto." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Compra</th>
                  <th>Proveedor</th>
                  <th>Productos</th>
                  <th>Estado</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id} className={cx('cursor-pointer', c.estado === 'anulada' && 'opacity-50')} onClick={() => setVer(c)}>
                    <td>
                      <p className="font-bold text-steel-100">#{c.id}</p>
                      <p className="text-xs text-steel-500">
                        {fecha(c.fecha)}
                        {c.factura && ` · fact. ${c.factura}`}
                      </p>
                    </td>
                    <td className="text-steel-300">{c.proveedor ?? <span className="text-steel-600">—</span>}</td>
                    <td className="max-w-[320px]">
                      <p className="truncate text-steel-300">{c.items.join(', ')}</p>
                      <p className="text-xs text-steel-600">por {c.registro}</p>
                    </td>
                    <td>
                      {c.estado === 'anulada' ? (
                        <span className="chip border-bad/30 text-bad">Anulada</span>
                      ) : c.estado === 'pendiente' ? (
                        <span className="chip border-warn/30 bg-warn/10 text-warn">Debe {c.saldoTexto}</span>
                      ) : (
                        <span className="chip border-ok/30 text-ok">Pagada</span>
                      )}
                    </td>
                    <td className={cx('tnum text-right font-display font-extrabold', c.estado === 'anulada' ? 'text-steel-500 line-through' : 'text-white')}>{c.totalTexto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-white/[0.06] px-5 py-3 text-right text-sm text-steel-400">
              Total comprado: <b className="tnum text-white">{money(vigentes.reduce((s, c) => s + c.totalRef, 0))}</b>
            </p>
          </div>
        )}
      </div>
      {nueva && <CompraModal onClose={() => setNueva(false)} />}
      {ver && <CompraDrawer compra={ver} onClose={() => setVer(null)} />}
    </>
  );
}

interface Linea {
  productoId: number;
  nombre: string;
  cantidad: number;
  costo: string;
}

function CompraModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: cat } = useCatalogo();
  const { data: productos } = useProductos();
  const { data: proveedores } = useProveedores();
  const [proveedorId, setProveedorId] = useState<number | ''>('');
  const [nuevoProv, setNuevoProv] = useState(false);
  const [factura, setFactura] = useState('');
  const [fechaC, setFechaC] = useState(hoyISO());
  const [moneda, setMoneda] = useState<Moneda>('COP');
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [buscar, setBuscar] = useState('');
  const [pagada, setPagada] = useState(true);
  const [metodo, setMetodo] = useState('efectivo');
  const [abono, setAbono] = useState('');
  const [nota, setNota] = useState('');
  const [soporte, setSoporte] = useState<string | null>(null);
  const buscarRef = useRef<HTMLInputElement>(null);

  const total = redondear(lineas.reduce((s, l) => s + l.cantidad * leerMonto(l.costo), 0), moneda);
  const metodos = (cat?.metodos ?? []).filter((m) => m.monedas.includes(moneda));
  const metodoOk = metodos.some((m) => m.codigo === metodo) ? metodo : (metodos[0]?.codigo ?? 'efectivo');
  const sugeridos = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    if (!q) return [];
    return (productos ?? []).filter((p) => p.activo !== false && !lineas.some((l) => l.productoId === p.id) && (p.nombre.toLowerCase().includes(q) || p.codigoBarras === buscar.trim())).slice(0, 6);
  }, [buscar, productos, lineas]);

  const agregar = (p: Producto) => {
    setLineas((ls) => (ls.some((l) => l.productoId === p.id) ? ls.map((l) => (l.productoId === p.id ? { ...l, cantidad: l.cantidad + 1 } : l)) : [...ls, { productoId: p.id, nombre: p.nombre, cantidad: 1, costo: p.costo && p.moneda === moneda ? String(p.costo) : '' }]));
    setBuscar('');
    buscarRef.current?.focus();
  };

  const m = useMutation({
    mutationFn: () =>
      api<{ id: number; totalTexto: string; saldoTexto: string; saldo: number }>('/inventario/compras', {
        body: {
          proveedorId: proveedorId || null,
          factura: factura || null,
          fecha: fechaC,
          moneda,
          items: lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad, costoUnitario: leerMonto(l.costo) })),
          pago: pagada ? { metodo: metodoOk, monto: abono ? leerMonto(abono) : null } : null,
          nota: nota || null,
          soporte,
        },
      }),
    onSuccess: (r) => {
      toast.success(`Compra #${r.id} registrada: ${r.totalTexto}`, { description: r.saldo > 0 ? `Queda debiendo ${r.saldoTexto} al proveedor` : 'La mercancía ya está en el inventario' });
      invalidarInventario(qc);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const subir = (file?: File) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return toast.error('El archivo pesa más de 4 MB');
    const rd = new FileReader();
    rd.onload = () => setSoporte(String(rd.result));
    rd.readAsDataURL(file);
  };
  const listo = lineas.length > 0 && lineas.every((l) => l.cantidad > 0 && l.costo.trim() !== '') && !m.isPending;

  return (
    <Modal
      title="Registrar compra"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto self-center text-sm text-steel-400">
            Total <b className="tnum font-wide text-xl text-white">{fmt(total, moneda)}</b>
          </span>
          <button className="btn-primary" disabled={!listo} onClick={() => m.mutate()}>
            <PackagePlus className="h-4 w-4" /> Guardar y sumar al inventario
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Proveedor" className="sm:col-span-2">
          <div className="flex gap-2">
            <select className="input flex-1" value={proveedorId} onChange={(e) => setProveedorId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Sin proveedor</option>
              {(proveedores ?? [])
                .filter((p) => p.activo)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
            </select>
            <button className="btn-ghost" onClick={() => setNuevoProv(true)} title="Nuevo proveedor">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </Field>
        <Field label="Factura nº">
          <input className="input" value={factura} maxLength={40} onChange={(e) => setFactura(e.target.value)} />
        </Field>
        <Field label="Fecha">
          <input type="date" className="input" max={hoyISO()} value={fechaC} onChange={(e) => setFechaC(e.target.value)} />
        </Field>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <p className="text-sm font-bold text-steel-300">Moneda de la factura</p>
        <Tabs value={moneda} onChange={setMoneda} items={MONEDAS.map((x) => ({ value: x, label: INFO[x].simbolo }))} />
        <p className="text-xs text-steel-500">El costo se convierte a la moneda de cada producto con la tasa de hoy.</p>
      </div>

      <div className="relative mt-4">
        <ScanBarcode className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
        <input
          ref={buscarRef}
          className="input pl-11"
          placeholder="Escanea o busca el producto para agregarlo"
          value={buscar}
          autoFocus
          onChange={(e) => setBuscar(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const exacto = (productos ?? []).find((p) => p.codigoBarras && p.codigoBarras === buscar.trim());
            if (exacto) agregar(exacto);
            else if (sugeridos[0]) agregar(sugeridos[0]);
            else if (buscar.trim()) toast.error('No hay un producto con ese código. Créalo primero en Planes y productos.');
          }}
        />
        {sugeridos.length > 0 && (
          <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-white/10 bg-ink-850 shadow-card">
            {sugeridos.map((p) => (
              <button key={p.id} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-white/[0.05]" onClick={() => agregar(p)}>
                <span className="flex-1 font-bold text-steel-100">{p.nombre}</span>
                <span className="text-xs text-steel-500">
                  stock {p.stock}
                  {p.costo ? ` · costo ${fmt(Number(p.costo), p.moneda)}` : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {lineas.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-steel-500">Agrega los productos que llegaron.</p>}
        {lineas.length > 0 && (
          <div className="grid grid-cols-[1fr_90px_130px_110px_28px] gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-steel-600">
            <span>Producto</span>
            <span>Cantidad</span>
            <span>Costo c/u ({INFO[moneda].simbolo})</span>
            <span className="text-right">Subtotal</span>
            <span />
          </div>
        )}
        {lineas.map((l) => (
          <div key={l.productoId} className="grid grid-cols-[1fr_90px_130px_110px_28px] items-center gap-2">
            <p className="truncate text-sm font-bold text-steel-100">{l.nombre}</p>
            <NumInput className="py-2 text-center" value={l.cantidad} min={1} max={100000} onChange={(n) => setLineas((ls) => ls.map((x) => (x.productoId === l.productoId ? { ...x, cantidad: n } : x)))} />
            <input className="input tnum py-2" inputMode="decimal" value={l.costo} placeholder="0" onChange={(e) => setLineas((ls) => ls.map((x) => (x.productoId === l.productoId ? { ...x, costo: e.target.value } : x)))} />
            <p className="tnum text-right text-sm text-steel-300">{fmt(l.cantidad * leerMonto(l.costo), moneda)}</p>
            <button className="text-steel-500 hover:text-bad" onClick={() => setLineas((ls) => ls.filter((x) => x.productoId !== l.productoId))}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-white/[0.06] p-4">
        <Tabs
          value={pagada ? 'si' : 'no'}
          onChange={(v) => setPagada(v === 'si')}
          items={[
            { value: 'si', label: 'Se pagó' },
            { value: 'no', label: 'A crédito (se debe)' },
          ]}
        />
        {pagada ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Cómo se pagó">
              <select className="input" value={metodoOk} onChange={(e) => setMetodo(e.target.value)}>
                {metodos.map((x) => (
                  <option key={x.codigo} value={x.codigo}>
                    {x.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cuánto se pagó" hint="Vacío = todo. Si fue una parte, el resto queda como deuda con el proveedor.">
              <input className="input tnum" inputMode="decimal" placeholder={fmt(total, moneda)} value={abono} onChange={(e) => setAbono(e.target.value)} />
            </Field>
            <p className="text-xs text-steel-500 sm:col-span-2">Se registra como egreso “Compra de mercancía” en finanzas. No afecta la caja de las cajeras.</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-steel-400">La mercancía entra al inventario y la deuda queda en “Por pagar a proveedores” hasta que la abones.</p>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
        <Field label="Nota (opcional)">
          <input className="input" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} />
        </Field>
        <Field label="Factura (foto o PDF)">
          <label className="btn-ghost cursor-pointer">
            <FileImage className="h-4 w-4" /> {soporte ? 'Cambiar' : 'Adjuntar'}
            <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => subir(e.target.files?.[0])} />
          </label>
        </Field>
      </div>
      {nuevoProv && (
        <ProveedorModal
          onClose={() => setNuevoProv(false)}
          onDone={(p) => {
            setProveedorId(p.id);
            setNuevoProv(false);
          }}
        />
      )}
    </Modal>
  );
}

function CompraDrawer({ compra: c, onClose }: { compra: Compra; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: cat } = useCatalogo();
  const { data } = useQuery({ queryKey: ['compra', c.id], queryFn: () => api<{ items: Array<{ id: number; nombre: string; cantidad: number; costoUnitario: number; subtotal: number }>; pagos: Array<{ id: number; metodo: string; montoTexto: string; creadoEn: string; registro: string }> }>(`/inventario/compras/${c.id}`) });
  const [abonar, setAbonar] = useState(false);
  const [anular, setAnular] = useState(false);
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('efectivo');
  const [motivo, setMotivo] = useState('');
  const metodos = (cat?.metodos ?? []).filter((m) => m.monedas.includes(c.moneda));
  const metodoOk = metodos.some((m) => m.codigo === metodo) ? metodo : (metodos[0]?.codigo ?? 'efectivo');
  const listo = () => {
    invalidarInventario(qc);
    void qc.invalidateQueries({ queryKey: ['compra', c.id] });
    onClose();
  };
  const pagar = useMutation({
    mutationFn: () => api<{ pagado: string }>(`/inventario/compras/${c.id}/pagos`, { body: { metodo: metodoOk, monto: monto ? leerMonto(monto) : c.saldo } }),
    onSuccess: (r) => (toast.success(`Abono registrado: ${r.pagado}`), listo()),
    onError: (e: Error) => toast.error(e.message),
  });
  const anu = useMutation({
    mutationFn: () => api(`/inventario/compras/${c.id}/anular`, { body: { motivo } }),
    onSuccess: () => (toast.success('Compra anulada: la mercancía salió del inventario'), listo()),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Drawer
      title={`Compra #${c.id}`}
      subtitle={`${fecha(c.fecha)}${c.proveedor ? ` · ${c.proveedor}` : ''}${c.factura ? ` · factura ${c.factura}` : ''} · registró ${c.registro}`}
      onClose={onClose}
      footer={
        c.estado !== 'anulada' && (
          <>
            <button className="btn-ghost btn-sm" onClick={() => (setAnular(!anular), setAbonar(false))}>
              <Ban className="h-4 w-4 text-bad" /> Anular
            </button>
            {c.estado === 'pendiente' && (
              <button className="btn-primary btn-sm" onClick={() => (setAbonar(!abonar), setAnular(false))}>
                <HandCoins className="h-4 w-4" /> Abonar al proveedor
              </button>
            )}
          </>
        )
      }
    >
      {c.estado === 'anulada' && <p className="mb-4 rounded-xl border border-bad/30 bg-bad/[0.07] p-3 text-sm text-bad">Anulada: {c.motivoAnulacion}</p>}
      {c.estado === 'pendiente' && <p className="mb-4 rounded-xl border border-warn/30 bg-warn/[0.07] p-3 text-sm text-warn">Se le debe al proveedor {c.saldoTexto} de {c.totalTexto}.</p>}
      {abonar && (
        <div className="mb-5 grid gap-3 rounded-2xl border border-flame-500/30 p-4 sm:grid-cols-[1fr_1fr_auto]">
          <select className="input" value={metodoOk} onChange={(e) => setMetodo(e.target.value)}>
            {metodos.map((x) => (
              <option key={x.codigo} value={x.codigo}>
                {x.nombre}
              </option>
            ))}
          </select>
          <input className="input tnum" inputMode="decimal" placeholder={`Todo: ${c.saldoTexto}`} value={monto} onChange={(e) => setMonto(e.target.value)} />
          <button className="btn-primary" disabled={pagar.isPending} onClick={() => pagar.mutate()}>
            Registrar
          </button>
        </div>
      )}
      {anular && (
        <div className="mb-5 space-y-3 rounded-2xl border border-bad/30 p-4">
          <p className="text-sm text-steel-300">Saca del inventario todo lo de esta compra y anula sus pagos. Si ya se vendió parte, corrige con un conteo.</p>
          <input className="input" placeholder="Motivo (ej. factura cargada dos veces)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <button className="btn-danger" disabled={motivo.trim().length < 4 || anu.isPending} onClick={() => anu.mutate()}>
            Anular compra
          </button>
        </div>
      )}
      <h4 className="label">Productos</h4>
      <div className="space-y-1.5">
        {(data?.items ?? []).map((i) => (
          <div key={i.id} className="flex items-center gap-3 rounded-xl bg-white/[0.02] px-4 py-2.5 text-sm">
            <span className="flex-1 font-bold text-steel-100">{i.nombre}</span>
            <span className="tnum text-steel-400">
              {i.cantidad} × {fmt(i.costoUnitario, c.moneda)}
            </span>
            <span className="tnum w-28 text-right font-bold text-white">{fmt(i.subtotal, c.moneda)}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-right text-sm text-steel-400">
        Total <b className="tnum text-white">{c.totalTexto}</b>
      </p>
      <h4 className="label mt-6">Pagos al proveedor</h4>
      {!data?.pagos.length ? (
        <p className="text-sm text-steel-500">Ninguno.</p>
      ) : (
        <div className="space-y-1.5">
          {data.pagos.map((p) => (
            <div key={p.id} className="flex items-center gap-3 text-sm">
              <span className="w-40 text-steel-400">{fechaHora(p.creadoEn)}</span>
              <span className="flex-1 text-steel-300">
                {p.metodo} · {p.registro}
              </span>
              <span className="tnum font-bold text-steel-100">{p.montoTexto}</span>
            </div>
          ))}
        </div>
      )}
      {c.nota && <p className="mt-6 rounded-xl bg-white/[0.03] p-3 text-sm text-steel-300">📝 {c.nota}</p>}
      {c.soporteId && (
        <a className="btn-ghost btn-sm mt-4" href={`${API}/archivos/${c.soporteId}?t=${encodeURIComponent(session.token ?? '')}`} target="_blank" rel="noreferrer">
          <FileImage className="h-4 w-4" /> Ver factura
        </a>
      )}
    </Drawer>
  );
}

// ═════════════ Conteo físico ═════════════

interface ConteoActual {
  id: number;
  creadoEn: string;
  nota: string | null;
  abrio: string;
  contados: number;
  productos: Array<{ id: number; nombre: string; categoria: string; codigoBarras: string | null; contado: number | null }>;
}
interface ConteoHist {
  id: number;
  estado: 'cerrado' | 'cancelado' | 'abierto';
  nota: string | null;
  creadoEn: string;
  cerradoEn: string | null;
  faltanteRef: number;
  sobranteRef: number;
  abrio: string;
  cerro: string | null;
  productos: number;
  conDiferencia: number;
}

function Conteo() {
  const qc = useQueryClient();
  const { data: actual, isLoading } = useQuery({ queryKey: ['conteo-actual'], queryFn: () => api<ConteoActual | null>('/inventario/conteos/actual') });
  const { data: historial } = useQuery({ queryKey: ['conteos'], queryFn: () => api<ConteoHist[]>('/inventario/conteos') });
  const [ver, setVer] = useState<ConteoHist | null>(null);
  const [nota, setNota] = useState('');
  const refrescar = () => ['conteo-actual', 'conteos', 'productos', 'inventario-resumen', 'kardex', 'catalogo'].forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
  const abrir = useMutation({
    mutationFn: () => api('/inventario/conteos', { body: { nota: nota || null } }),
    onSuccess: () => (setNota(''), refrescar()),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <Loading />;
  if (actual) return <Contando conteo={actual} onCambio={refrescar} onCerrado={(h) => setVer(h)} verHist={ver} cerrarHist={() => setVer(null)} />;

  return (
    <>
      <div className="card mb-5 flex flex-wrap items-center gap-4 p-5">
        <ClipboardCheck className="h-8 w-8 shrink-0 text-flame-500" />
        <div className="min-w-[240px] flex-1">
          <p className="font-display font-extrabold text-white">Conteo físico (ciego)</p>
          <p className="text-sm text-steel-400">Quien cuenta no ve lo que dice el sistema: solo anota lo que hay. Al terminar, el sistema compara, ajusta el stock y registra el faltante.</p>
        </div>
        <input className="input max-w-xs" placeholder="Nota (ej. conteo de fin de mes)" value={nota} onChange={(e) => setNota(e.target.value)} />
        <button className="btn-primary" disabled={abrir.isPending} onClick={() => abrir.mutate()}>
          <ClipboardCheck className="h-4 w-4" /> Empezar conteo
        </button>
      </div>
      <HistorialConteos historial={historial} onVer={setVer} />
      {ver && <DetalleConteo conteo={ver} onClose={() => setVer(null)} />}
    </>
  );
}

function HistorialConteos({ historial, onVer }: { historial?: ConteoHist[]; onVer: (c: ConteoHist) => void }) {
  const lista = (historial ?? []).filter((c) => c.estado !== 'abierto');
  return (
    <div className="card overflow-hidden">
      {!lista.length ? (
        <Empty icon={<History className="h-7 w-7" />} title="Todavía no hay conteos" hint="Hazlo cada cierto tiempo (semanal o mensual): así sabes si falta mercancía." />
      ) : (
        <table className="table-base">
          <thead>
            <tr>
              <th>Conteo</th>
              <th>Quién</th>
              <th>Productos</th>
              <th className="text-right">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id} className={cx(c.estado === 'cerrado' ? 'cursor-pointer' : 'opacity-50')} onClick={() => c.estado === 'cerrado' && onVer(c)}>
                <td>
                  <p className="font-bold text-steel-100">#{c.id}</p>
                  <p className="text-xs text-steel-500">
                    {fechaHora(c.cerradoEn ?? c.creadoEn)}
                    {c.nota && ` · ${c.nota}`}
                  </p>
                </td>
                <td className="text-steel-400">
                  {c.abrio}
                  {c.cerro && c.cerro !== c.abrio && ` → ${c.cerro}`}
                </td>
                <td className="text-steel-400">
                  {c.productos} contado(s){c.conDiferencia ? <span className="text-warn"> · {c.conDiferencia} con diferencia</span> : ''}
                </td>
                <td className="text-right">
                  {c.estado === 'cancelado' ? (
                    <span className="chip border-white/10 text-steel-500">Cancelado</span>
                  ) : c.faltanteRef > 0 ? (
                    <span className="chip border-bad/40 bg-bad/15 text-bad">Faltó {money(c.faltanteRef)}</span>
                  ) : c.sobranteRef > 0 ? (
                    <span className="chip border-sky-400/30 text-sky-300">Sobró {money(c.sobranteRef)}</span>
                  ) : (
                    <span className="chip border-ok/30 bg-ok/10 text-ok">Todo cuadra</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Contando({ conteo, onCambio, onCerrado, verHist, cerrarHist }: { conteo: ConteoActual; onCambio: () => void; onCerrado: (c: ConteoHist) => void; verHist: ConteoHist | null; cerrarHist: () => void }) {
  const [buscar, setBuscar] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [ultimo, setUltimo] = useState<{ nombre: string; contado: number } | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const anotar = useMutation({
    mutationFn: (b: { productoId: number; contado?: number; sumar?: number }) => api<{ productoId: number; contado: number }>(`/inventario/conteos/${conteo.id}/items`, { method: 'PUT', body: b }),
    onSuccess: (r) => {
      const p = conteo.productos.find((x) => x.id === r.productoId);
      if (p) setUltimo({ nombre: p.nombre, contado: r.contado });
      onCambio();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const cerrar = useMutation({
    mutationFn: () => api(`/inventario/conteos/${conteo.id}/cerrar`, { body: {} }),
    onSuccess: async () => {
      toast.success('Conteo cerrado: el inventario quedó con lo contado');
      setConfirmar(false);
      onCambio();
      const h = await api<ConteoHist[]>('/inventario/conteos');
      const c = h.find((x) => x.id === conteo.id);
      if (c) onCerrado(c);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancelar = useMutation({
    mutationFn: () => api(`/inventario/conteos/${conteo.id}/cancelar`, { body: {} }),
    onSuccess: () => (toast.success('Conteo cancelado: no se cambió nada'), onCambio()),
    onError: (e: Error) => toast.error(e.message),
  });

  const q = buscar.trim().toLowerCase();
  const lista = conteo.productos.filter((p) => !q || p.nombre.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q) || p.codigoBarras === buscar.trim());
  const pendientes = conteo.productos.length - conteo.contados;

  return (
    <>
      <div className="card mb-4 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-[220px] flex-1">
            <p className="font-display font-extrabold text-white">
              Conteo #{conteo.id} en curso <span className="ml-2 text-sm font-normal text-steel-500">empezó {hace(conteo.creadoEn)} · {conteo.abrio}</span>
            </p>
            <p className="text-sm text-steel-400">
              Llevas <b className="text-white">{conteo.contados}</b> de {conteo.productos.length} productos. Los que no cuentes no se tocan.
            </p>
          </div>
          <button className="btn-ghost" disabled={cancelar.isPending} onClick={() => confirm('¿Cancelar el conteo? No se cambia nada del inventario.') && cancelar.mutate()}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={!conteo.contados} onClick={() => setConfirmar(true)}>
            <ClipboardCheck className="h-4 w-4" /> Terminar y comparar
          </button>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-flame-500 transition-all" style={{ width: `${(conteo.contados / Math.max(conteo.productos.length, 1)) * 100}%` }} />
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_1fr]">
        <div className="relative">
          <ScanBarcode className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-flame-500" />
          <input
            ref={scanRef}
            className="input pl-12 text-lg"
            placeholder="Pasa cada unidad por el lector (suma 1)"
            autoFocus
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              const cod = e.currentTarget.value.trim();
              e.currentTarget.value = '';
              if (!cod) return;
              const p = conteo.productos.find((x) => x.codigoBarras === cod);
              if (!p) return void toast.error(`Ningún producto con el código ${cod}`);
              anotar.mutate({ productoId: p.id, sumar: 1 });
            }}
          />
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
          <input className="input pl-11" placeholder="Buscar producto o categoría" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </div>
      </div>
      {ultimo && (
        <p className="mb-3 rounded-xl border border-ok/25 bg-ok/[0.06] px-4 py-2 text-sm text-ok">
          ✓ {ultimo.nombre}: llevas <b>{ultimo.contado}</b>
        </p>
      )}

      <div className="card overflow-hidden">
        <table className="table-base">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="w-40">Contado</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id}>
                <td>
                  <p className="font-bold text-steel-100">{p.nombre}</p>
                  <p className="text-xs text-steel-500">
                    {p.categoria}
                    {p.codigoBarras && ` · ${p.codigoBarras}`}
                  </p>
                </td>
                <td>
                  <input
                    key={`${p.id}-${p.contado}`}
                    className={cx('input tnum py-2 text-center', p.contado != null && 'border-ok/40')}
                    inputMode="numeric"
                    placeholder="—"
                    defaultValue={p.contado ?? ''}
                    onBlur={(e) => {
                      const t = e.target.value.replace(/\D/g, '');
                      if (t === '' || Number(t) === p.contado) return;
                      anotar.mutate({ productoId: p.id, contado: Number(t) });
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmar && (
        <Modal
          title="Terminar conteo"
          size="sm"
          onClose={() => setConfirmar(false)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setConfirmar(false)}>
                Seguir contando
              </button>
              <button className="btn-primary" disabled={cerrar.isPending} onClick={() => cerrar.mutate()}>
                Terminar
              </button>
            </>
          }
        >
          <p className="text-steel-300">
            El stock de los <b className="text-white">{conteo.contados}</b> productos contados quedará igual a lo que contaste, y la diferencia se registra como faltante o sobrante.
          </p>
          {pendientes > 0 && <p className="mt-3 text-sm text-warn">{pendientes} producto(s) sin contar: esos no se tocan.</p>}
        </Modal>
      )}
      {verHist && <DetalleConteo conteo={verHist} onClose={cerrarHist} />}
    </>
  );
}

function DetalleConteo({ conteo, onClose }: { conteo: ConteoHist; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['conteo', conteo.id],
    queryFn: () => api<Array<{ productoId: number; nombre: string; categoria: string; esperado: number; contado: number; diferencia: number; valorTexto: string | null; conto: string | null }>>(`/inventario/conteos/${conteo.id}`),
  });
  return (
    <Modal title={`Conteo #${conteo.id}`} size="lg" onClose={onClose}>
      <div className="mb-4 flex flex-wrap gap-3">
        <span className="chip border-bad/40 bg-bad/10 text-bad">Faltó {money(conteo.faltanteRef)}</span>
        <span className="chip border-sky-400/30 text-sky-300">Sobró {money(conteo.sobranteRef)}</span>
        <span className="chip border-white/10 text-steel-400">{fechaHora(conteo.cerradoEn)}</span>
      </div>
      {!data ? (
        <Loading />
      ) : (
        <table className="table-base">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="text-right">Sistema</th>
              <th className="text-right">Contado</th>
              <th className="text-right">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {data.map((i) => (
              <tr key={i.productoId}>
                <td>
                  <p className="font-bold text-steel-100">{i.nombre}</p>
                  <p className="text-xs text-steel-500">{i.conto && `contó ${i.conto}`}</p>
                </td>
                <td className="tnum text-right text-steel-400">{i.esperado}</td>
                <td className="tnum text-right text-steel-200">{i.contado}</td>
                <td className={cx('tnum text-right font-bold', i.diferencia < 0 ? 'text-bad' : i.diferencia > 0 ? 'text-sky-300' : 'text-ok')}>
                  {i.diferencia > 0 ? `+${i.diferencia}` : i.diferencia === 0 ? '✓' : i.diferencia}
                  {i.valorTexto && <span className="block text-[11px] font-normal text-steel-500">{i.valorTexto}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

// ═════════════ Movimientos (kardex) ═════════════

function Movimientos() {
  const { data: productos } = useProductos();
  const [productoId, setProductoId] = useState<number | ''>('');
  const [tipo, setTipo] = useState('');
  const [desde, setDesde] = useState(sumarDias(hoyISO(), -7));
  const [hasta, setHasta] = useState(hoyISO());
  const { data, isLoading } = useQuery({
    queryKey: ['kardex', productoId, tipo, desde, hasta],
    queryFn: () =>
      api<Array<{ id: number; creadoEn: string; tipo: string; cantidad: number; stockResultante: number | null; referencia: string | null; producto: string; usuario: string | null }>>('/inventario/movimientos', {
        query: { productoId: productoId || undefined, tipo: tipo || undefined, desde, hasta },
      }),
  });
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Producto">
          <select className="input min-w-[220px]" value={productoId} onChange={(e) => setProductoId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Todos</option>
            {(productos ?? [])
              .filter((p) => p.controlaStock)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Tipo">
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(TIPOS_KARDEX).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Desde">
          <input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </Field>
        <Field label="Hasta">
          <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </Field>
      </div>
      <div className="card overflow-hidden">
        {isLoading ? (
          <Loading />
        ) : !data?.length ? (
          <Empty icon={<History className="h-7 w-7" />} title="Sin movimientos" hint="Cada unidad que entra o sale (venta, compra, devolución, ajuste, conteo) queda aquí con quién la movió." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Movimiento</th>
                  <th className="text-right">Unidades</th>
                  <th className="text-right">Quedó</th>
                </tr>
              </thead>
              <tbody>
                {data.map((k) => (
                  <tr key={k.id}>
                    <td className="whitespace-nowrap text-steel-400">{fechaHora(k.creadoEn)}</td>
                    <td className="font-bold text-steel-100">{k.producto}</td>
                    <td className="max-w-[340px]">
                      <p className={cx('text-sm font-bold', TIPOS_KARDEX[k.tipo]?.color)}>{TIPOS_KARDEX[k.tipo]?.label ?? k.tipo}</p>
                      <p className="truncate text-xs text-steel-500">
                        {k.referencia}
                        {k.usuario && ` · ${k.usuario}`}
                      </p>
                    </td>
                    <td className={cx('tnum text-right font-bold', k.cantidad < 0 ? 'text-bad' : 'text-ok')}>{k.cantidad > 0 ? `+${k.cantidad}` : k.cantidad}</td>
                    <td className="tnum text-right text-steel-300">{k.stockResultante ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ═════════════ Proveedores ═════════════

function Proveedores() {
  const { data, isLoading } = useProveedores();
  const [editar, setEditar] = useState<Proveedor | 'nuevo' | null>(null);
  return (
    <>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={() => setEditar('nuevo')}>
          <Plus className="h-4 w-4" /> Nuevo proveedor
        </button>
      </div>
      <div className="card overflow-hidden">
        {isLoading ? (
          <Loading />
        ) : !data?.length ? (
          <Empty icon={<Truck className="h-7 w-7" />} title="Sin proveedores" hint="Agrega a quienes te venden la mercancía (bebidas, suplementos…)." />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Contacto</th>
                <th>Compras</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className={cx(!p.activo && 'opacity-50')}>
                  <td>
                    <p className="font-bold text-steel-100">{p.nombre}</p>
                    <p className="text-xs text-steel-500">{p.documento ?? 'Sin RIF / NIT'}</p>
                  </td>
                  <td className="text-steel-400">{[p.contacto, p.telefono].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="text-steel-400">
                    {p.compras}
                    {p.ultimaCompra && <span className="text-xs text-steel-600"> · última {fecha(p.ultimaCompra)}</span>}
                  </td>
                  <td className="text-right">
                    <button className="btn-ghost btn-sm" onClick={() => setEditar(p)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editar && <ProveedorModal proveedor={editar === 'nuevo' ? undefined : editar} onClose={() => setEditar(null)} onDone={() => setEditar(null)} />}
    </>
  );
}

function ProveedorModal({ proveedor, onClose, onDone }: { proveedor?: Proveedor; onClose: () => void; onDone: (p: Proveedor) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ nombre: proveedor?.nombre ?? '', documento: proveedor?.documento ?? '', telefono: proveedor?.telefono ?? '', contacto: proveedor?.contacto ?? '', notas: proveedor?.notas ?? '', activo: proveedor?.activo ?? true });
  const m = useMutation({
    mutationFn: () => (proveedor ? api<Proveedor>(`/inventario/proveedores/${proveedor.id}`, { method: 'PUT', body: f }) : api<Proveedor>('/inventario/proveedores', { body: f })),
    onSuccess: (p) => {
      toast.success('Proveedor guardado');
      void qc.invalidateQueries({ queryKey: ['proveedores'] });
      onDone(p);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal
      title={proveedor ? 'Editar proveedor' : 'Nuevo proveedor'}
      onClose={onClose}
      footer={
        <button className="btn-primary" disabled={f.nombre.trim().length < 2 || m.isPending} onClick={() => m.mutate()}>
          Guardar
        </button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" className="sm:col-span-2">
          <input className="input" autoFocus value={f.nombre} maxLength={100} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        </Field>
        <Field label="RIF / NIT">
          <input className="input" value={f.documento} maxLength={30} onChange={(e) => setF({ ...f, documento: e.target.value })} />
        </Field>
        <Field label="Teléfono">
          <input className="input" value={f.telefono} maxLength={30} onChange={(e) => setF({ ...f, telefono: e.target.value })} />
        </Field>
        <Field label="Persona de contacto" className="sm:col-span-2">
          <input className="input" value={f.contacto} maxLength={80} onChange={(e) => setF({ ...f, contacto: e.target.value })} />
        </Field>
        <Field label="Notas" className="sm:col-span-2">
          <input className="input" value={f.notas} maxLength={300} onChange={(e) => setF({ ...f, notas: e.target.value })} placeholder="Ej. entrega los martes" />
        </Field>
        {proveedor && (
          <label className="flex items-center gap-2 text-sm font-bold text-steel-300">
            <input type="checkbox" className="h-4 w-4 accent-[#FF8A10]" checked={f.activo} onChange={(e) => setF({ ...f, activo: e.target.checked })} /> Activo
          </label>
        )}
      </div>
    </Modal>
  );
}
