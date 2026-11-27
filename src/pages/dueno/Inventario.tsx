/**
 * Inventario: compras a proveedores (con costo), conteo físico ciego,
 * movimientos de cada unidad (kardex) y proveedores.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Ban, Boxes, ClipboardCheck, FileImage, HandCoins, History, PackagePlus, Pencil, Plus, ScanBarcode, Search, Truck, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ProductosPanel, TIPOS_KARDEX } from '../../components/ProductosInventario';
import { Paginacion, Th, useTabla } from '../../components/Tabla';
import { Drawer, Empty, Field, Loading, Modal, NumInput, PageHeader, Stat, Tabs, cx } from '../../components/ui';
import { api, API, session } from '../../lib/api';
import { fecha, fechaHora, hace, hoyISO, money, sumarDias } from '../../lib/format';
import { useCatalogo } from '../../lib/hooks';
import { convertir, equivalentes, factor, fmt, INFO, leerMonto, MONEDAS, redondear, tasasDesdeTablero, textoTablero, type Moneda } from '../../lib/monedas';
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
  tasas: { usdCop: number; vesCop: number; fuente?: 'factura' | 'tablero' } | null;
  proveedor: string | null;
  registro: string;
  items: string[];
  totalTexto: string;
  saldoTexto: string;
}


const useProductos = () => useQuery({ queryKey: ['productos'], queryFn: () => api<Producto[]>('/productos') });
const useProveedores = () => useQuery({ queryKey: ['proveedores'], queryFn: () => api<Proveedor[]>('/inventario/proveedores') });

export default function Inventario() {
  const [params, setParams] = useSearchParams();
  // «Factura de proveedor» abre directo el formulario (con el código escaneado, si hay)
  const cargar = params.get('cargar') === '1' ? { codigo: params.get('codigo') ?? undefined } : null;
  const [tab, setTab] = useState<'productos' | 'compras' | 'conteo' | 'movimientos' | 'proveedores'>(cargar ? 'compras' : 'productos');
  const { data: r } = useQuery({ queryKey: ['inventario-resumen'], queryFn: () => api<Resumen>('/inventario/resumen') });
  return (
    <div>
      <PageHeader title="Inventario" kicker="Mercancía">
        Cada producto con lo que hay. <b className="text-steel-200">Entrada</b> cuando llega mercancía, <b className="text-steel-200">Salida</b> por merma y <b className="text-steel-200">Ajustar</b> con lo que hay en el estante. Todo queda en el historial.
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
            { value: 'productos', label: 'Productos' },
            { value: 'compras', label: 'Facturas de proveedor' },
            { value: 'conteo', label: 'Conteo físico' },
            { value: 'movimientos', label: 'Movimientos' },
            { value: 'proveedores', label: 'Proveedores' },
          ]}
        />
      </div>
      {tab === 'productos' && <ProductosPanel />}
      {tab === 'compras' && <Compras inicial={cargar} limpiar={() => setParams({}, { replace: true })} />}
      {tab === 'conteo' && <Conteo />}
      {tab === 'movimientos' && <Movimientos />}
      {tab === 'proveedores' && <Proveedores />}
    </div>
  );
}

const invalidarInventario = (qc: ReturnType<typeof useQueryClient>) => ['compras', 'productos', 'inventario-resumen', 'kardex', 'proveedores', 'catalogo', 'finanzas'].forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));

// ═════════════ Compras ═════════════

function Compras({ inicial, limpiar }: { inicial: { codigo?: string } | null; limpiar: () => void }) {
  const [desde, setDesde] = useState(sumarDias(hoyISO(), -30));
  const [hasta, setHasta] = useState(hoyISO());
  const [pendientes, setPendientes] = useState(false);
  const [nueva, setNueva] = useState<{ codigo?: string } | null>(inicial);
  const [ver, setVer] = useState<Compra | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['compras', desde, hasta, pendientes],
    queryFn: () => api<Compra[]>('/inventario/compras', { query: pendientes ? { pendientes: 1 } : { desde, hasta } }),
  });
  const vigentes = (data ?? []).filter((c) => c.estado !== 'anulada');
  const t = useTabla(
    data,
    {
      fecha: { label: 'Fecha', valor: (c) => `${c.fecha} ${String(c.id).padStart(8, '0')}` },
      proveedor: { label: 'Proveedor', valor: (c) => c.proveedor },
      factura: { label: 'Factura', valor: (c) => c.factura },
      estado: { label: 'Estado', valor: (c) => c.estado },
      total: { label: 'Total', valor: (c) => c.totalRef },
    },
    { id: 'compras', orden: { col: 'fecha', dir: 'desc' } },
  );
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
        <button className="btn-primary ml-auto" onClick={() => setNueva({})}>
          <Plus className="h-4 w-4" /> Cargar factura
        </button>
      </div>
      <div className="card overflow-hidden">
        {isLoading ? (
          <Loading />
        ) : !data?.length ? (
          <Empty icon={<Truck className="h-7 w-7" />} title="Sin compras en estas fechas" hint="Toda mercancía entra por aquí: carga la factura como viene (en $, Bs o pesos), crea los productos nuevos y fija su precio de venta." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th><Th t={t} col="fecha">Compra</Th></th>
                  <th><Th t={t} col="proveedor" /></th>
                  <th>Productos</th>
                  <th><Th t={t} col="estado" /></th>
                  <th className="text-right"><Th t={t} col="total" /></th>
                </tr>
              </thead>
              <tbody>
                {t.visibles.map((c) => (
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
            <Paginacion t={t} />
            <p className="border-t border-white/[0.06] px-5 py-3 text-right text-sm text-steel-400">
              Total comprado: <b className="tnum text-white">{money(vigentes.reduce((s, c) => s + c.totalRef, 0))}</b>
            </p>
          </div>
        )}
      </div>
      {nueva && <CompraModal codigoInicial={nueva.codigo} onClose={() => (setNueva(null), limpiar())} />}
      {ver && <CompraDrawer compra={ver} onClose={() => setVer(null)} />}
    </>
  );
}

interface Linea {
  key: string;
  /** Producto existente; vacío si nace con esta factura */
  productoId?: number;
  nombre: string;
  nuevo: boolean;
  categoria: string;
  codigoBarras: string;
  /** Moneda en la que se vende (la del producto) */
  monedaVenta: Moneda;
  cantidad: number;
  /** Costo unitario en la moneda de la factura, como lo escribe la persona */
  costo: string;
  /** Precio de venta en la moneda del producto */
  precio: string;
  precioActual?: number;
  stock?: number;
}

const CATEGORIAS = ['Bebidas', 'Suplementos', 'Snacks', 'Lácteos', 'Accesorios', 'Ropa', 'General'];
const textoNum = (n: number, m: Moneda) => (n ? String(redondear(n, m)).replace('.', ',') : '');
const MARGENES = [30, 50, 100];

/**
 * Cargar factura de compra: el único camino por el que entra mercancía.
 * Se escribe como viene en el papel (en $, Bs o pesos); el sistema convierte
 * el costo a la moneda de venta con la tasa de la factura, crea los productos
 * nuevos y deja el precio de venta listo para caja (que cobra en las tres monedas).
 */
function CompraModal({ onClose, codigoInicial }: { onClose: () => void; codigoInicial?: string }) {
  const qc = useQueryClient();
  const { data: cat } = useCatalogo();
  const { data: productos } = useProductos();
  const { data: proveedores } = useProveedores();
  const [proveedorId, setProveedorId] = useState<number | ''>('');
  const [nuevoProv, setNuevoProv] = useState(false);
  const [factura, setFactura] = useState('');
  const [fechaC, setFechaC] = useState(hoyISO());
  const [moneda, setMoneda] = useState<Moneda>('USD');
  const [tasaDolar, setTasaDolar] = useState<string | null>(null);
  const [tasaBs, setTasaBs] = useState<string | null>(null);
  const [lineas, setLineas] = useState<Linea[]>(() => (codigoInicial ? [lineaNueva('', codigoInicial)] : []));
  const [ultima, setUltima] = useState<string | null>(lineas[0]?.key ?? null);
  const [buscar, setBuscar] = useState('');
  const [totalPapel, setTotalPapel] = useState('');
  const [pagada, setPagada] = useState(true);
  const [metodo, setMetodo] = useState('efectivo');
  const [abono, setAbono] = useState('');
  const [nota, setNota] = useState('');
  const [soporte, setSoporte] = useState<string | null>(null);
  const buscarRef = useRef<HTMLInputElement>(null);

  // Tasa de la factura: la del día, o la que se escriba si se pagó a otra
  const dia = cat?.tasas;
  const dolar = tasaDolar === null ? (dia?.usdCop ?? 0) : leerMonto(tasaDolar);
  const bs = tasaBs === null ? (dia?.vesCop ?? 0) : leerMonto(tasaBs);
  const t = dolar > 0 && bs > 0 ? tasasDesdeTablero(dolar, bs) : null;
  const tasaEditada = !!dia && (dolar !== dia.usdCop || bs !== dia.vesCop);
  const usaTasa = moneda !== 'COP' || lineas.some((l) => l.monedaVenta !== moneda);

  const total = redondear(lineas.reduce((s, l) => s + l.cantidad * leerMonto(l.costo), 0), moneda);
  const papel = leerMonto(totalPapel);
  const cuadra = totalPapel.trim() !== '' && redondear(papel, moneda) === total;
  const metodos = (cat?.metodos ?? []).filter((m) => m.monedas.includes(moneda));
  const metodoOk = metodos.some((m) => m.codigo === metodo) ? metodo : (metodos[0]?.codigo ?? 'efectivo');

  const sugeridos = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    if (!q) return [];
    return (productos ?? []).filter((p) => p.activo !== false && p.controlaStock && !lineas.some((l) => l.productoId === p.id) && (p.nombre.toLowerCase().includes(q) || p.codigoBarras === buscar.trim())).slice(0, 6);
  }, [buscar, productos, lineas]);

  function lineaNueva(nombre: string, codigo = ''): Linea {
    return { key: `n${Date.now()}${Math.random()}`, nombre, nuevo: true, categoria: 'General', codigoBarras: codigo, monedaVenta: 'COP', cantidad: 1, costo: '', precio: '' };
  }
  const poner = (l: Linea) => {
    setLineas((ls) => [...ls, l]);
    setUltima(l.key);
    setBuscar('');
  };
  const agregar = (p: Producto) => {
    const ya = lineas.find((l) => l.productoId === p.id);
    if (ya) {
      setLineas((ls) => ls.map((l) => (l.key === ya.key ? { ...l, cantidad: l.cantidad + 1 } : l)));
      setBuscar('');
      return;
    }
    poner({ key: `p${p.id}`, productoId: p.id, nombre: p.nombre, nuevo: false, categoria: p.categoria, codigoBarras: p.codigoBarras ?? '', monedaVenta: p.moneda, cantidad: 1, costo: '', precio: textoNum(Number(p.precio), p.moneda), precioActual: Number(p.precio), stock: p.stock });
  };
  const crear = () => {
    const txt = buscar.trim();
    if (!txt) return;
    // Lo que sale de la pistola (solo números/letras sin espacios, largo) es un código; lo demás, el nombre
    poner(/^[0-9]{6,}$/.test(txt) ? lineaNueva('', txt) : lineaNueva(txt));
  };
  const cambiar = (key: string, c: Partial<Linea>) => setLineas((ls) => ls.map((x) => (x.key === key ? { ...x, ...c } : x)));

  // Revisión de cada línea: lo que falta o está mal se dice con palabras
  const revision = lineas.map((l) => {
    const costoU = leerMonto(l.costo);
    const costoVenta = t ? convertir(costoU, moneda, l.monedaVenta, t) : 0;
    const precio = leerMonto(l.precio);
    let error: string | null = null;
    if (l.nuevo && l.nombre.trim().length < 2) error = 'Escribe el nombre';
    else if (l.cantidad < 1) error = 'Cantidad';
    else if (costoU <= 0) error = 'Escribe el costo de la factura';
    else if (precio <= 0) error = 'Ponle precio de venta';
    else if (precio < redondear(costoVenta, l.monedaVenta)) error = 'El precio de venta está por debajo del costo';
    return { costoU, costoVenta, precio, error, margen: precio > 0 && costoVenta > 0 ? Math.round(((precio - costoVenta) / precio) * 100) : null };
  });
  const errores = revision.filter((r) => r.error).length;

  const m = useMutation({
    mutationFn: () =>
      api<{ id: number; totalTexto: string; saldoTexto: string; saldo: number; creados: string[] }>('/inventario/compras', {
        body: {
          proveedorId: proveedorId || null,
          factura: factura.trim() || null,
          fecha: fechaC,
          moneda,
          tasa: tasaEditada ? { dolar, bs } : null,
          totalFactura: papel,
          items: lineas.map((l) => ({
            productoId: l.nuevo ? null : l.productoId,
            nuevo: l.nuevo ? { nombre: l.nombre.trim(), categoria: l.categoria.trim() || 'General', codigoBarras: l.codigoBarras.trim() || null, moneda: l.monedaVenta } : null,
            cantidad: l.cantidad,
            costoUnitario: leerMonto(l.costo),
            precioVenta: leerMonto(l.precio),
          })),
          pago: pagada ? { metodo: metodoOk, monto: abono ? leerMonto(abono) : null } : null,
          nota: nota || null,
          soporte,
        },
      }),
    onSuccess: (r) => {
      toast.success(`Factura cargada (compra #${r.id}): ${r.totalTexto}`, {
        description: [r.creados.length ? `Productos nuevos: ${r.creados.join(', ')}` : null, r.saldo > 0 ? `Queda debiendo ${r.saldoTexto} al proveedor` : 'La mercancía ya está en el inventario y a la venta'].filter(Boolean).join(' · '),
      });
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
  const listo = lineas.length > 0 && errores === 0 && cuadra && !!t && !m.isPending;
  const falta = !lineas.length ? 'Agrega los productos de la factura' : errores ? `Revisa ${errores} línea(s)` : !t ? 'Escribe la tasa' : totalPapel.trim() === '' ? 'Escribe el total de la factura' : !cuadra ? 'El total no cuadra con la factura' : null;

  return (
    <Modal
      title="Cargar factura de compra"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto self-center text-sm text-steel-400">
            {falta ? <span className="text-warn">{falta}</span> : <span className="text-ok">Todo cuadra</span>}
          </span>
          <button className="btn-primary" disabled={!listo} onClick={() => m.mutate()}>
            <PackagePlus className="h-4 w-4" /> Guardar factura y sumar al inventario
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
          <input className="input" value={factura} maxLength={40} onChange={(e) => setFactura(e.target.value)} placeholder="Si tiene número" />
        </Field>
        <Field label="Fecha de la factura">
          <input type="date" className="input" max={hoyISO()} value={fechaC} onChange={(e) => setFechaC(e.target.value)} />
        </Field>
      </div>

      {/* 1. Moneda y tasa */}
      <div className="mt-5 rounded-2xl border border-white/[0.06] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-bold text-steel-200">¿En qué moneda viene la factura?</p>
          <Tabs value={moneda} onChange={setMoneda} items={MONEDAS.map((x) => ({ value: x, label: `${INFO[x].simbolo} ${INFO[x].corto}` }))} />
        </div>
        {usaTasa && (
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Dólar: pesos por $1">
              <input className={cx('input tnum', tasaDolar !== null && 'border-flame-500/50')} inputMode="decimal" value={tasaDolar ?? textoNum(dia?.usdCop ?? 0, 'VES')} onChange={(e) => setTasaDolar(e.target.value)} />
            </Field>
            <Field label="Bs: pesos por Bs 1">
              <input className={cx('input tnum', tasaBs !== null && 'border-flame-500/50')} inputMode="decimal" value={tasaBs ?? textoNum(dia?.vesCop ?? 0, 'VES')} onChange={(e) => setTasaBs(e.target.value)} />
            </Field>
            {tasaEditada ? (
              <button className="btn-ghost btn-sm mb-1" onClick={() => (setTasaDolar(null), setTasaBs(null))}>
                Usar la del día
              </button>
            ) : (
              <span className="mb-3 text-xs text-steel-500">Tasa del día</span>
            )}
            <p className="text-xs text-steel-500 sm:col-span-3">
              Con esta tasa se pasa el costo a la moneda en que se vende. Si la factura se pagó a otra tasa, escríbela: queda guardada en la compra.
            </p>
          </div>
        )}
      </div>

      {/* 2. Productos */}
      <div className="relative mt-5">
        <ScanBarcode className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
        <input
          ref={buscarRef}
          className="input pl-11"
          placeholder="Escanea o escribe el producto: si no existe, se crea aquí"
          value={buscar}
          autoFocus={!codigoInicial}
          onChange={(e) => setBuscar(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const exacto = (productos ?? []).find((p) => p.codigoBarras && p.codigoBarras === buscar.trim());
            if (exacto) agregar(exacto);
            else if (sugeridos[0]) agregar(sugeridos[0]);
            else crear();
          }}
        />
        {buscar.trim() && (
          <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-white/10 bg-ink-850 shadow-card">
            {sugeridos.map((p) => (
              <button key={p.id} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-white/[0.05]" onClick={() => agregar(p)}>
                <span className="flex-1 font-bold text-steel-100">{p.nombre}</span>
                <span className="text-xs text-steel-500">
                  stock {p.stock} · vende a {fmt(Number(p.precio), p.moneda)}
                </span>
              </button>
            ))}
            <button className="flex w-full items-center gap-2 border-t border-white/[0.06] px-4 py-2.5 text-left text-sm font-bold text-flame-300 hover:bg-white/[0.05]" onClick={crear}>
              <Plus className="h-4 w-4" /> Crear producto nuevo: «{buscar.trim()}»
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-3">
        {lineas.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-steel-500">Agrega los productos tal como vienen en la factura.</p>}
        {lineas.map((l, i) => {
          const r = revision[i];
          return (
            <div key={l.key} className={cx('rounded-2xl border p-4', r.error ? 'border-warn/30' : 'border-white/[0.08]')}>
              <div className="grid grid-cols-[1fr_auto] gap-3 sm:grid-cols-[1fr_90px_130px_110px_28px] sm:items-end">
                <div className="min-w-0">
                  {l.nuevo ? (
                    <Field label="Producto nuevo">
                      <input className="input" autoFocus={ultima === l.key && !l.nombre} maxLength={100} value={l.nombre} placeholder="Ej. Yogurt griego 150 g" onChange={(e) => cambiar(l.key, { nombre: e.target.value })} />
                    </Field>
                  ) : (
                    <>
                      <p className="truncate font-bold text-steel-100">{l.nombre}</p>
                      <p className="text-xs text-steel-500">Hay {l.stock ?? 0} · quedarán {(l.stock ?? 0) + l.cantidad}</p>
                    </>
                  )}
                </div>
                <button className="self-start text-steel-500 hover:text-bad sm:hidden" onClick={() => setLineas((ls) => ls.filter((x) => x.key !== l.key))}>
                  <X className="h-4 w-4" />
                </button>
                <Field label="Cantidad">
                  <NumInput className="py-2 text-center" value={l.cantidad} min={1} max={100000} onChange={(n) => cambiar(l.key, { cantidad: n })} />
                </Field>
                <Field label={`Costo c/u (${INFO[moneda].simbolo})`}>
                  <input className="input tnum py-2" autoFocus={ultima === l.key && !l.nuevo} inputMode="decimal" value={l.costo} placeholder="1,10" onChange={(e) => cambiar(l.key, { costo: e.target.value })} />
                </Field>
                <div className="text-right">
                  <p className="label">Subtotal</p>
                  <p className="tnum py-2 text-sm font-bold text-steel-200">{fmt(l.cantidad * r.costoU, moneda)}</p>
                </div>
                <button className="hidden pb-3 text-steel-500 hover:text-bad sm:block" onClick={() => setLineas((ls) => ls.filter((x) => x.key !== l.key))}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              {l.nuevo && (
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Field label="Categoría">
                    <input className="input py-2" list="cats-compra" value={l.categoria} maxLength={40} onChange={(e) => cambiar(l.key, { categoria: e.target.value })} />
                  </Field>
                  <Field label="Código de barras">
                    <input className="input tnum py-2" value={l.codigoBarras} maxLength={40} placeholder="Pásalo por la pistola" onChange={(e) => cambiar(l.key, { codigoBarras: e.target.value.replace(/\s/g, '') })} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} />
                  </Field>
                  <Field label="Se vende en">
                    <select className="input py-2" value={l.monedaVenta} onChange={(e) => cambiar(l.key, { monedaVenta: e.target.value as Moneda })}>
                      {MONEDAS.map((x) => (
                        <option key={x} value={x}>
                          {INFO[x].nombre}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}

              {/* Conversión y salida de venta */}
              <div className="mt-3 grid gap-3 rounded-xl bg-white/[0.025] p-3 sm:grid-cols-[1fr_1.2fr] sm:items-center">
                <div className="text-sm">
                  <p className="text-steel-400">
                    Costo en {INFO[l.monedaVenta].corto.toLowerCase()}:{' '}
                    <b className="tnum text-white">{r.costoU > 0 && t ? fmt(redondear(r.costoVenta, l.monedaVenta), l.monedaVenta) : '—'}</b>
                  </p>
                  {r.costoU > 0 && t && moneda !== l.monedaVenta && (
                    <p className="tnum text-[11px] text-steel-500">
                      {fmt(r.costoU, moneda)} × {(factor(moneda, l.monedaVenta, t)).toLocaleString('es-VE', { maximumFractionDigits: 4 })}
                    </p>
                  )}
                  {r.costoVenta > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {MARGENES.map((g) => (
                        <button key={g} className="chip border-white/10 py-0.5 text-[11px] text-steel-300 hover:border-flame-500/50" onClick={() => cambiar(l.key, { precio: textoNum(sugerido(r.costoVenta, g, l.monedaVenta), l.monedaVenta) })}>
                          +{g}%
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <Field label={`Precio de venta (${INFO[l.monedaVenta].simbolo})`}>
                    <input className={cx('input tnum text-lg', r.error === 'El precio de venta está por debajo del costo' && 'border-bad/60')} inputMode="decimal" value={l.precio} placeholder="Precio en caja" onChange={(e) => cambiar(l.key, { precio: e.target.value })} />
                  </Field>
                  {r.precio > 0 && cat && (
                    <p className="mt-1 text-[11px] text-steel-500">
                      En caja también: {equivalentes(r.precio, l.monedaVenta, cat.tasas)}
                      {r.margen !== null && <span className={cx('ml-1 font-bold', r.margen < 0 ? 'text-bad' : 'text-ok')}>· ganancia {r.margen}%</span>}
                    </p>
                  )}
                  {!l.nuevo && l.precioActual !== undefined && r.precio > 0 && redondear(r.precio, l.monedaVenta) !== l.precioActual && (
                    <p className="mt-1 text-[11px] font-bold text-flame-300">Cambia el precio: antes {fmt(l.precioActual, l.monedaVenta)}</p>
                  )}
                </div>
              </div>
              {r.error && <p className="mt-2 text-xs font-bold text-warn">{r.error}</p>}
            </div>
          );
        })}
        <datalist id="cats-compra">
          {CATEGORIAS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      {/* 3. Total contra el papel */}
      {lineas.length > 0 && (
        <div className={cx('mt-4 grid gap-3 rounded-2xl border p-4 sm:grid-cols-[1fr_1fr] sm:items-end', !totalPapel.trim() ? 'border-white/[0.08]' : cuadra ? 'border-ok/40 bg-ok/[0.05]' : 'border-bad/40 bg-bad/[0.05]')}>
          <div>
            <p className="label">Suman las líneas</p>
            <p className="tnum font-wide text-2xl text-white">{fmt(total, moneda)}</p>
            {t && moneda !== 'COP' && <p className="tnum text-xs text-steel-500">≈ {fmt(redondear(convertir(total, moneda, 'COP', t), 'COP'), 'COP')}</p>}
          </div>
          <div>
            <Field label={`Total que dice la factura (${INFO[moneda].simbolo})`}>
              <input className="input tnum text-lg" inputMode="decimal" value={totalPapel} placeholder="Ej. 36,30" onChange={(e) => setTotalPapel(e.target.value)} />
            </Field>
            {totalPapel.trim() && (
              <p className={cx('mt-1 text-xs font-bold', cuadra ? 'text-ok' : 'text-bad')}>
                {cuadra ? '✓ Cuadra con la factura' : `No cuadra: diferencia de ${fmt(Math.abs(redondear(papel - total, moneda)), moneda)}`}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 4. Pago al proveedor */}
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
          <input className="input" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} placeholder="Ej. vendedor Nigut" />
        </Field>
        <Field label="Foto de la factura">
          <label className={cx('btn-ghost cursor-pointer', soporte && 'border-ok/40 text-ok')}>
            <FileImage className="h-4 w-4" /> {soporte ? 'Foto lista · cambiar' : 'Adjuntar'}
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

/** Precio sugerido: costo + margen, redondeado hacia arriba (pesos a la centena). */
function sugerido(costo: number, margen: number, m: Moneda) {
  const bruto = costo * (1 + margen / 100);
  if (m === 'COP') return Math.ceil(bruto / 100) * 100;
  return Math.ceil(bruto * 100) / 100;
}

function CompraDrawer({ compra: c, onClose }: { compra: Compra; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: cat } = useCatalogo();
  const { data } = useQuery({ queryKey: ['compra', c.id], queryFn: () => api<{ items: Array<{ id: number; nombre: string; cantidad: number; costoUnitario: number; subtotal: number; productoNuevo: boolean; costoTexto: string | null; precioTexto: string | null; precioAnteriorTexto: string | null }>; pagos: Array<{ id: number; metodo: string; montoTexto: string; creadoEn: string; registro: string }> }>(`/inventario/compras/${c.id}`) });
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
          <div key={i.id} className="rounded-xl bg-white/[0.02] px-4 py-2.5 text-sm">
            <div className="flex items-center gap-3">
              <span className="flex-1 font-bold text-steel-100">
                {i.nombre}
                {i.productoNuevo && <span className="chip ml-2 border-flame-500/30 py-0 text-[10px] text-flame-300">Nuevo</span>}
              </span>
              <span className="tnum text-steel-400">
                {i.cantidad} × {fmt(i.costoUnitario, c.moneda)}
              </span>
              <span className="tnum w-28 text-right font-bold text-white">{fmt(i.subtotal, c.moneda)}</span>
            </div>
            {(i.costoTexto || i.precioTexto) && (
              <p className="tnum mt-1 text-xs text-steel-500">
                {i.costoTexto && `Costo ${i.costoTexto} c/u`}
                {i.precioTexto && ` · se vende a ${i.precioTexto}`}
                {i.precioAnteriorTexto && <span className="text-flame-300"> (antes {i.precioAnteriorTexto})</span>}
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-right text-sm text-steel-400">
        Total <b className="tnum text-white">{c.totalTexto}</b>
      </p>
      {c.tasas && c.moneda !== 'COP' && (
        <p className="mt-1 text-right text-xs text-steel-500">
          Convertido con {textoTablero(c.tasas as never)} {c.tasas.fuente === 'factura' ? '(tasa de la factura)' : '(tasa del día)'}
        </p>
      )}
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
  const t = useTabla(
    lista,
    {
      fecha: { label: 'Fecha', valor: (c) => c.cerradoEn ?? c.creadoEn },
      quien: { label: 'Quién', valor: (c) => c.abrio },
      productos: { label: 'Productos', valor: (c) => c.productos },
      faltante: { label: 'Faltante', valor: (c) => c.faltanteRef },
    },
    { id: 'conteos', orden: { col: 'fecha', dir: 'desc' } },
  );
  return (
    <div className="card overflow-hidden">
      {!lista.length ? (
        <Empty icon={<History className="h-7 w-7" />} title="Todavía no hay conteos" hint="Hazlo cada cierto tiempo (semanal o mensual): así sabes si falta mercancía." />
      ) : (
        <table className="table-base">
          <thead>
            <tr>
              <th><Th t={t} col="fecha">Conteo</Th></th>
              <th><Th t={t} col="quien" /></th>
              <th><Th t={t} col="productos" /></th>
              <th className="text-right"><Th t={t} col="faltante">Resultado</Th></th>
            </tr>
          </thead>
          <tbody>
            {t.visibles.map((c) => (
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
      <Paginacion t={t} />
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
  const t = useTabla(
    lista,
    {
      nombre: { label: 'Producto', valor: (p) => p.nombre },
      categoria: { label: 'Categoría', valor: (p) => p.categoria },
      contado: { label: 'Contado', valor: (p) => p.contado },
    },
    { id: 'contando', orden: { col: 'nombre', dir: 'asc' }, porPagina: 50 },
  );

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
              <th><Th t={t} col="nombre" /></th>
              <th className="w-40">
                <Th t={t} col="contado" />
              </th>
            </tr>
          </thead>
          <tbody>
            {t.visibles.map((p) => (
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
        <Paginacion t={t} />
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
  const t = useTabla(
    data,
    {
      nombre: { label: 'Producto', valor: (i) => i.nombre },
      esperado: { label: 'Sistema', valor: (i) => i.esperado },
      contado: { label: 'Contado', valor: (i) => i.contado },
      diferencia: { label: 'Diferencia', valor: (i) => i.diferencia },
    },
    { id: 'conteo-detalle', orden: { col: 'diferencia', dir: 'asc' } },
  );
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
              <th><Th t={t} col="nombre" /></th>
              <th className="text-right"><Th t={t} col="esperado" /></th>
              <th className="text-right"><Th t={t} col="contado" /></th>
              <th className="text-right"><Th t={t} col="diferencia" /></th>
            </tr>
          </thead>
          <tbody>
            {t.visibles.map((i) => (
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
      <Paginacion t={t} />
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
  const t = useTabla(
    data,
    {
      fecha: { label: 'Fecha', valor: (k) => `${k.creadoEn} ${String(k.id).padStart(10, '0')}` },
      producto: { label: 'Producto', valor: (k) => k.producto },
      tipo: { label: 'Movimiento', valor: (k) => TIPOS_KARDEX[k.tipo]?.label ?? k.tipo },
      cantidad: { label: 'Unidades', valor: (k) => k.cantidad },
      quedo: { label: 'Quedó', valor: (k) => k.stockResultante },
    },
    { id: 'kardex', orden: { col: 'fecha', dir: 'desc' } },
  );
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
                  <th><Th t={t} col="fecha" /></th>
                  <th><Th t={t} col="producto" /></th>
                  <th><Th t={t} col="tipo" /></th>
                  <th className="text-right"><Th t={t} col="cantidad" /></th>
                  <th className="text-right"><Th t={t} col="quedo" /></th>
                </tr>
              </thead>
              <tbody>
                {t.visibles.map((k) => (
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
            <Paginacion t={t} />
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
  const t = useTabla(
    data,
    {
      nombre: { label: 'Proveedor', valor: (p) => p.nombre },
      contacto: { label: 'Contacto', valor: (p) => p.contacto ?? p.telefono },
      compras: { label: 'Compras', valor: (p) => p.compras },
      ultima: { label: 'Última compra', valor: (p) => p.ultimaCompra },
    },
    { id: 'proveedores', orden: { col: 'nombre', dir: 'asc' } },
  );
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
                <th><Th t={t} col="nombre" /></th>
                <th><Th t={t} col="contacto" /></th>
                <th><Th t={t} col="compras" /></th>
                <th />
              </tr>
            </thead>
            <tbody>
              {t.visibles.map((p) => (
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
        <Paginacion t={t} />
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
