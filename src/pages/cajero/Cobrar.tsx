import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, CalendarCheck, CheckCircle2, HandCoins, Keyboard, Minus, Package, Plus, Power, Receipt, Search, ShoppingBag, Trash2, UserPlus, UserRound, Users, X, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ClienteNuevo, EstadoLector, type VentaHecha } from '../../components/ClienteNuevo';
import { PanelPago, Precio, type PagoPayload } from '../../components/PanelPago';
import { SocioPicker } from '../../components/socios';
import { Avatar, cx, Empty, Loading, Modal, Tabs } from '../../components/ui';
import { api } from '../../lib/api';
import { duracion, fecha, hora } from '../../lib/format';
import { MovimientoModal } from './MiTurno';
import { useCatalogo, useTurno } from '../../lib/hooks';
import { fmt, type Moneda } from '../../lib/monedas';
import type { Deuda, Plan, Producto, SocioDetalle, SocioLista } from '../../lib/types';

interface ClienteSel {
  id: string;
  nombre: string;
  codigo: number;
  tieneFoto: boolean;
  vence: string | null;
}
type Linea = {
  key: string;
  tipo: 'membresia' | 'producto' | 'abono';
  id: number;
  nombre: string;
  precio: number;
  moneda: Moneda;
  cantidad: number;
  stock?: number;
  controla?: boolean;
  color?: string;
  personas?: number;
  acompanantes?: Array<{ id: string; nombre: string }>;
  desde?: 'continuar' | 'hoy';
};

export function AbrirTurno() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => api('/pos/turno/abrir', { body: {} }),
    onSuccess: () => {
      toast.success('Turno abierto. ¡Buen día de trabajo!');
      void qc.invalidateQueries({ queryKey: ['turno'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="mx-auto mt-10 max-w-xl text-center">
      <div className="plate px-8 pb-10 pt-12">
        <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-flame-500/10 text-flame-500">
          <Power className="h-10 w-10" />
        </div>
        <h2 className="font-wide text-3xl text-white">Abre tu turno</h2>
        <p className="mx-auto mt-3 max-w-sm text-steel-400">Todo lo que cobres quedará en tu turno. Al terminar lo cierras y entregas el dinero.</p>
        <button className="btn-primary btn-xl mx-auto mt-8 w-full max-w-xs" disabled={m.isPending} onClick={() => m.mutate()}>
          {m.isPending ? 'Abriendo…' : 'Abrir turno'}
        </button>
      </div>
    </div>
  );
}

export default function Cobrar() {
  const qc = useQueryClient();
  const { data: turno, isLoading: cargandoTurno } = useTurno();
  const { data: cat } = useCatalogo();
  const [params, setParams] = useSearchParams();
  const [cliente, setCliente] = useState<ClienteSel | null>(null);
  const [tab, setTab] = useState<'planes' | 'tienda'>('planes');
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [nuevo, setNuevo] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('Todas');
  const [elegirAcomp, setElegirAcomp] = useState<Plan | null>(null);
  const [exito, setExito] = useState<(VentaHecha & { cliente: ClienteSel | null }) | null>(null);
  const buscarRef = useRef<HTMLInputElement>(null);
  const clienteRef = useRef<HTMLDivElement>(null);
  const [mov, setMov] = useState<null | 'ingreso' | 'egreso'>(null);

  // Atajos: F2 cliente · F3 producto · F8 gasto · F9 ingreso
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        clienteRef.current?.querySelector('input')?.focus();
      } else if (e.key === 'F3') {
        e.preventDefault();
        setTab('tienda');
        setTimeout(() => buscarRef.current?.focus(), 50);
      } else if (e.key === 'F8') {
        e.preventDefault();
        setMov('egreso');
      } else if (e.key === 'F9') {
        e.preventDefault();
        setMov('ingreso');
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // Ficha del cliente elegido: vigencia (para renovar) y deudas (para abonar)
  const { data: ficha } = useQuery({ queryKey: ['socio', cliente?.id], enabled: !!cliente, queryFn: () => api<SocioDetalle>(`/socios/${cliente!.id}`) });
  const vigente = ficha?.vigencia.vigente ?? false;

  const ponerPlan = (p: Plan, acompanantes: Array<{ id: string; nombre: string }> = []) =>
    setLineas((ls) => [
      ...ls.filter((l) => l.tipo !== 'membresia'),
      { key: `m${p.id}`, tipo: 'membresia', id: p.id, nombre: `Plan ${p.nombre}`, precio: p.precio, moneda: p.moneda, cantidad: 1, color: p.color, personas: p.personas, acompanantes, desde: 'continuar' },
    ]);

  // ?cliente=ID[&plan=ID] → preselecciona (viene de "Renovar" en la ficha)
  const clienteParam = params.get('cliente');
  const planParam = params.get('plan');
  const { data: pre } = useQuery({ queryKey: ['socio', clienteParam], enabled: !!clienteParam, queryFn: () => api<SocioDetalle>(`/socios/${clienteParam}`) });
  useEffect(() => {
    if (!pre || !cat || !clienteParam) return;
    setCliente({ id: pre.id, nombre: `${pre.nombre} ${pre.apellido}`.trim(), codigo: pre.codigo, tieneFoto: !!pre.foto, vence: pre.vigencia.hasta ?? pre.vigencia.ultimaFin });
    const p = cat.planes.find((x) => x.id === Number(planParam));
    if (p && p.personas === 1) ponerPlan(p);
    params.delete('cliente');
    params.delete('plan');
    setParams(params, { replace: true });
  }, [pre, cat]); // eslint-disable-line react-hooks/exhaustive-deps

  const rapidos = useMemo(() => (cat?.masVendidos ?? []).map((id) => cat?.productos.find((p) => p.id === id)).filter((p): p is Producto => !!p), [cat]);
  const categorias = useMemo(() => ['Todas', ...new Set((cat?.productos ?? []).map((p) => p.categoria))], [cat]);
  const productos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (cat?.productos ?? []).filter((p) => (categoria === 'Todas' || p.categoria === categoria) && (!q || p.nombre.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q)));
  }, [cat, busqueda, categoria]);

  const addPlan = (p: Plan) => {
    if (!cliente) {
      toast.warning('Primero busca o registra al cliente', { description: 'El plan se carga a un cliente para activar su rostro en el lector.' });
      return;
    }
    if (p.personas > 1) setElegirAcomp(p);
    else ponerPlan(p);
  };
  const addProducto = (p: Producto) =>
    setLineas((ls) => {
      const ex = ls.find((l) => l.key === `p${p.id}`);
      if (ex) {
        if (p.controlaStock && ex.cantidad >= p.stock) {
          toast.warning(`Solo quedan ${p.stock}`);
          return ls;
        }
        return ls.map((l) => (l.key === ex.key ? { ...l, cantidad: l.cantidad + 1 } : l));
      }
      return [...ls, { key: `p${p.id}`, tipo: 'producto', id: p.id, nombre: p.nombre, precio: p.precio, moneda: p.moneda, cantidad: 1, stock: p.stock, controla: p.controlaStock }];
    });
  const addAbono = (d: Deuda) =>
    setLineas((ls) => (ls.some((l) => l.key === `a${d.id}`) ? ls : [...ls, { key: `a${d.id}`, tipo: 'abono', id: d.id, nombre: `Abono: ${d.concepto}`, precio: Number(d.saldo), moneda: d.moneda, cantidad: 1 }]));
  const cambiarCant = (key: string, d: number) =>
    setLineas((ls) =>
      ls.map((l) => (l.key === key ? { ...l, cantidad: Math.max(0, l.controla && l.stock !== undefined ? Math.min(l.stock, l.cantidad + d) : l.cantidad + d) } : l)).filter((l) => l.cantidad > 0),
    );
  const quitar = (key: string) => setLineas((ls) => ls.filter((l) => l.key !== key));
  const limpiar = () => {
    setLineas([]);
    setCliente(null);
  };

  const cobrar = useMutation({
    mutationFn: (p: PagoPayload) =>
      api<VentaHecha>('/pos/ventas', {
        body: {
          socioId: cliente?.id ?? null,
          items: lineas.map((l) =>
            l.tipo === 'membresia'
              ? { tipo: 'membresia', id: l.id, acompanantes: l.acompanantes?.map((a) => a.id), desde: l.desde }
              : l.tipo === 'abono'
                ? { tipo: 'abono', deudaId: l.id, monto: l.precio }
                : { tipo: 'producto', id: l.id, cantidad: l.cantidad },
          ),
          ...p,
        },
      }),
    onSuccess: (r) => {
      setExito({ ...r, cliente });
      limpiar();
      ['turno', 'catalogo', 'socios', 'socio'].forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (cargandoTurno) return <Loading />;
  if (!turno) return <AbrirTurno />;

  const lineasPago = lineas.map((l) => ({ monto: l.precio * l.cantidad, moneda: l.moneda }));
  const plan = lineas.find((l) => l.tipo === 'membresia');
  const deudas = ficha?.deudas ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_460px]">
      {/* ── Catálogo ── */}
      <section className="min-w-0 space-y-5">
        {/* Barra del turno: lo que lleva (sin montos: caja ciega) e ingresos/gastos a un toque */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
          <span className="relative mr-1 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ok" />
          </span>
          <p className="text-sm text-steel-300">
            <b className="text-white">Turno #{turno.numero}</b> · {duracion(turno.abiertoEn)} · <b className="text-white">{turno.operaciones}</b> venta(s)
            {turno.ventas[0] && <span className="text-steel-500"> · última {hora(turno.ventas[0].creadoEn)}</span>}
          </p>
          <div className="ml-auto flex flex-wrap gap-2">
            <button className="btn-ghost btn-sm" onClick={() => setMov('ingreso')} title="F9">
              <ArrowDownCircle className="h-4 w-4 text-ok" /> Ingreso
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setMov('egreso')} title="F8">
              <ArrowUpCircle className="h-4 w-4 text-bad" /> Gasto
            </button>
            <Link to="/mostrador/turno" className="btn-ghost btn-sm">
              <Receipt className="h-4 w-4" /> Mi turno
            </Link>
          </div>
        </div>

        {rapidos.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-steel-500">
              <Zap className="h-3.5 w-3.5 text-flame-500" /> Venta rápida
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {rapidos.map((p) => {
                const agotado = p.controlaStock && p.stock <= 0;
                const enCarro = lineas.find((l) => l.key === `p${p.id}`)?.cantidad;
                return (
                  <button
                    key={p.id}
                    disabled={agotado}
                    onClick={() => addProducto(p)}
                    className={cx('relative shrink-0 rounded-2xl border px-4 py-2.5 text-left transition disabled:opacity-40', enCarro ? 'border-flame-500/60 bg-flame-500/[0.08]' : 'border-white/[0.08] hover:border-white/25')}
                  >
                    <p className="max-w-[10rem] truncate text-sm font-bold text-steel-100">{p.nombre}</p>
                    <p className="tnum text-xs text-flame-300">{fmt(p.precio, p.moneda)}</p>
                    {enCarro && <span className="absolute -right-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-flame-500 px-1 text-xs font-extrabold text-ink-950">{enCarro}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {cliente ? (
          <div className="plate p-4 pt-5">
            <div className="flex items-center gap-4">
              <Avatar socioId={cliente.id} nombre={cliente.nombre} tieneFoto={cliente.tieneFoto} size={52} ring={vigente ? 'ok' : 'flame'} />
              <div className="flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-flame-500">Cobrando a</p>
                <p className="font-display text-xl font-extrabold text-white">{cliente.nombre}</p>
                <p className="text-xs text-steel-500">
                  #{cliente.codigo} ·{' '}
                  {ficha?.vigencia.congelada
                    ? 'membresía congelada'
                    : vigente
                      ? `${ficha?.vigencia.plan} hasta ${fecha(ficha?.vigencia.hasta)}`
                      : ficha?.vigencia.ultimaFin
                        ? `venció el ${fecha(ficha.vigencia.ultimaFin)}`
                        : 'sin plan'}
                </p>
              </div>
              <button className="btn-ghost btn-sm" onClick={() => (setCliente(null), setLineas((l) => l.filter((x) => x.tipo === 'producto')))}>
                <X className="h-4 w-4" /> Cambiar
              </button>
            </div>
            {deudas.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-sky-400/25 bg-sky-400/[0.06] px-3 py-2">
                <HandCoins className="h-4 w-4 text-sky-300" />
                <span className="text-sm text-sky-200">Tiene deudas pendientes:</span>
                {deudas.map((d) => (
                  <button key={d.id} onClick={() => addAbono(d)} className="chip cursor-pointer border-sky-400/30 py-1 text-sky-200 hover:bg-sky-400/15">
                    + Cobrar {fmt(Number(d.saldo), d.moneda)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-3">
            <div className="flex-1" ref={clienteRef}>
              <SocioPicker
                onPick={(s) => setCliente({ id: s.id, nombre: `${s.nombre} ${s.apellido}`.trim(), codigo: s.codigo, tieneFoto: s.tieneFoto, vence: s.vence })}
                onNuevo={(t) => setNuevo(t)}
                placeholder="¿A quién le cobras? (F2) — opcional en la tienda"
              />
            </div>
            <button className="btn-primary h-14 rounded-2xl px-5" onClick={() => setNuevo('')}>
              <UserPlus className="h-5 w-5" /> Nuevo cliente
            </button>
          </div>
        )}

        <Tabs
          value={tab}
          onChange={(t) => {
            setTab(t);
            if (t === 'tienda') setTimeout(() => buscarRef.current?.focus(), 50);
          }}
          items={[
            { value: 'planes', label: 'Planes' },
            { value: 'tienda', label: 'Tienda' },
          ]}
        />

        {tab === 'planes' ? (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {cat?.planes.map((p) => {
              const sel = lineas.some((l) => l.key === `m${p.id}`);
              return (
                <button key={p.id} onClick={() => addPlan(p)} className={cx('plate card-hover p-5 pt-7 text-left', sel && 'border-flame-500/60 ring-2 ring-flame-500/40', !cliente && 'opacity-60')}>
                  <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl" style={{ background: p.color }} />
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-lg font-extrabold text-white">{p.nombre}</p>
                    {p.personas > 1 && (
                      <span className="chip border-flame-500/30 text-flame-300">
                        <Users className="h-3 w-3" /> {p.personas}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-steel-500">
                    {p.duracion} {p.descripcion && `· ${p.descripcion}`}
                  </p>
                  {!p.accesoLector && <p className="mt-1 text-[11px] font-bold text-steel-400">Entra por recepción (sin lector)</p>}
                  <div className="mt-4">
                    <Precio monto={p.precio} moneda={p.moneda} tasas={cat.tasas} grande />
                  </div>
                  {sel && <CheckCircle2 className="absolute bottom-4 right-4 h-6 w-6 text-flame-500" />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
              <input
                ref={buscarRef}
                className="input pl-11"
                placeholder="Buscar producto… (Enter agrega si hay uno solo)"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && productos.length === 1) {
                    addProducto(productos[0]!);
                    setBusqueda('');
                  }
                }}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categorias.map((c) => (
                <button key={c} onClick={() => setCategoria(c)} className={cx('rounded-full px-3.5 py-1.5 text-xs font-bold transition', categoria === c ? 'bg-flame-500 text-ink-950' : 'bg-white/[0.04] text-steel-400 hover:text-steel-100')}>
                  {c}
                </button>
              ))}
            </div>
            {productos.length === 0 ? (
              <Empty icon={<ShoppingBag className="h-7 w-7" />} title="No hay productos" hint={busqueda ? 'Prueba con otra palabra.' : 'El dueño los agrega en Planes y productos.'} />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {productos.map((p) => {
                  const agotado = p.controlaStock && p.stock <= 0;
                  const enCarro = lineas.find((l) => l.key === `p${p.id}`)?.cantidad;
                  return (
                    <button key={p.id} disabled={agotado} onClick={() => addProducto(p)} className={cx('card card-hover relative flex flex-col p-4 text-left disabled:opacity-40', enCarro && 'border-flame-500/50 bg-flame-500/[0.04]')}>
                      <div className="mb-3 flex items-center justify-between">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.04] text-steel-400">
                          <Package className="h-4 w-4" />
                        </span>
                        {p.controlaStock && (
                          <span className={cx('chip', agotado ? 'border-bad/30 text-bad' : p.stock <= 5 ? 'border-warn/30 text-warn' : 'border-white/10 text-steel-500')}>{agotado ? 'Agotado' : `${p.stock} und`}</span>
                        )}
                      </div>
                      <p className="line-clamp-2 min-h-[2.5rem] font-bold leading-tight text-steel-100">{p.nombre}</p>
                      <p className="mb-2 text-[11px] text-steel-600">{p.categoria}</p>
                      <Precio monto={p.precio} moneda={p.moneda} tasas={cat?.tasas} />
                      {enCarro && <span className="absolute -right-2 -top-2 grid h-7 min-w-7 place-items-center rounded-full bg-flame-500 px-1.5 text-sm font-extrabold text-ink-950 shadow-glow">{enCarro}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Ticket + cobro ── */}
      <aside className="lg:sticky lg:top-[96px] lg:self-start">
        <div className="plate flex max-h-[calc(100vh-120px)] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-dashed border-white/10 px-5 pb-4 pt-6">
            <p className="font-wide text-lg text-white">Ticket</p>
            {lineas.length > 0 && (
              <button className="text-xs font-bold text-steel-500 hover:text-bad" onClick={limpiar}>
                Vaciar
              </button>
            )}
          </div>
          <div className="overflow-y-auto">
            <div className="min-h-[90px] space-y-1 px-3 py-3">
              {lineas.length === 0 && (
                <div className="px-2 py-4">
                  <p className="text-center text-sm text-steel-500">Toca un plan o producto para agregarlo</p>
                  <p className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-steel-600">
                    <Keyboard className="h-3.5 w-3.5" /> <span><b className="text-steel-400">F2</b> cliente</span> <span><b className="text-steel-400">F3</b> producto</span> <span><b className="text-steel-400">F8</b> gasto</span> <span><b className="text-steel-400">F9</b> ingreso</span>
                  </p>
                  {turno.ventas.length > 0 && (
                    <div className="mt-4 space-y-1 border-t border-dashed border-white/10 pt-3">
                      <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-steel-600">Tus últimas ventas</p>
                      {turno.ventas.slice(0, 4).map((v) => (
                        <p key={v.id} className={cx('flex justify-between gap-3 px-1 text-xs', v.estado === 'anulada' ? 'text-steel-600 line-through' : 'text-steel-400')}>
                          <span className="truncate">
                            #{v.numero} {v.items.join(', ')}
                          </span>
                          <span className="tnum shrink-0">{hora(v.creadoEn)}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {lineas.map((l) => (
                <div key={l.key} className="rounded-xl px-2 py-2 hover:bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    {l.tipo === 'membresia' ? (
                      <CalendarCheck className="h-5 w-5 shrink-0" style={{ color: l.color }} />
                    ) : l.tipo === 'abono' ? (
                      <HandCoins className="h-5 w-5 shrink-0 text-sky-300" />
                    ) : (
                      <Package className="h-5 w-5 shrink-0 text-steel-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-steel-100">{l.nombre}</p>
                      <p className="tnum text-xs text-steel-500">
                        {fmt(l.precio, l.moneda)} {l.cantidad > 1 && `× ${l.cantidad} = ${fmt(l.precio * l.cantidad, l.moneda)}`}
                      </p>
                    </div>
                    {l.tipo === 'producto' ? (
                      <div className="flex items-center gap-1">
                        <button className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.05] hover:bg-white/10" onClick={() => cambiarCant(l.key, -1)}>
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="tnum w-7 text-center font-bold">{l.cantidad}</span>
                        <button className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.05] hover:bg-white/10" onClick={() => cambiarCant(l.key, 1)}>
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button className="rounded-lg p-2 text-steel-500 hover:text-bad" onClick={() => quitar(l.key)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {l.acompanantes && l.acompanantes.length > 0 && <p className="ml-8 mt-1 text-xs text-steel-400">+ {l.acompanantes.map((a) => a.nombre).join(', ')}</p>}
                  {l.tipo === 'membresia' && vigente && (
                    <div className="ml-8 mt-2 inline-flex rounded-lg bg-ink-950/60 p-0.5 text-[11px] font-bold">
                      {(['continuar', 'hoy'] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() => setLineas((ls) => ls.map((x) => (x.key === l.key ? { ...x, desde: d } : x)))}
                          className={cx('rounded-md px-2.5 py-1', l.desde === d ? 'bg-flame-500 text-ink-950' : 'text-steel-400')}
                        >
                          {d === 'continuar' ? `Seguir desde ${fecha(ficha?.vigencia.hasta)}` : 'Empezar hoy'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {lineas.length > 0 && cat && (
              <div className="border-t border-dashed border-white/10 px-4 py-4">
                <PanelPago
                  lineas={lineasPago}
                  metodos={cat.metodos}
                  tasas={cat.tasas}
                  permiteParcial={!!cliente && lineas.some((l) => l.tipo !== 'abono')}
                  cobrando={cobrar.isPending}
                  etiqueta="Cobrar"
                  onCobrar={(p) => cobrar.mutate(p)}
                />
                {!cliente && (
                  <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-steel-500">
                    <UserRound className="h-3.5 w-3.5" /> Venta sin cliente registrado (ocasional)
                  </p>
                )}
                {plan?.desde === 'hoy' && <p className="mt-2 text-center text-xs text-warn">La membresía actual se reemplaza y la nueva empieza hoy.</p>}
              </div>
            )}
          </div>
        </div>
      </aside>

      {mov && <MovimientoModal tipo={mov} onClose={() => setMov(null)} onDone={() => void qc.invalidateQueries({ queryKey: ['turno'] })} />}
      {nuevo !== null && <ClienteNuevo nombreInicial={nuevo} onClose={() => setNuevo(null)} />}

      {elegirAcomp && cliente && (
        <Acompanantes
          plan={elegirAcomp}
          titular={cliente}
          onClose={() => setElegirAcomp(null)}
          onListo={(acomp) => {
            ponerPlan(elegirAcomp, acomp);
            setElegirAcomp(null);
          }}
        />
      )}

      {exito && (
        <Modal
          title="Venta registrada"
          size="sm"
          onClose={() => setExito(null)}
          footer={
            <button className="btn-primary w-full" autoFocus onClick={() => setExito(null)}>
              Nueva venta
            </button>
          }
        >
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-ok" />
            <p className="mt-3 text-sm text-steel-400">Ticket #{exito.numero}</p>
            {exito.cliente && <p className="mt-1 font-bold text-steel-100">{exito.cliente.nombre}</p>}
          </div>
          {exito.vuelto && <p className="mt-4 rounded-xl border border-sky-400/30 bg-sky-400/[0.08] p-3 text-center text-lg font-bold text-sky-300">Entrega de vuelto: {exito.vuelto.texto}</p>}
          {exito.deuda && <p className="mt-3 rounded-xl border border-warn/30 bg-warn/[0.07] p-3 text-center text-sm text-warn">Quedó debiendo {exito.deuda.texto}</p>}
          <div className="mt-4 space-y-1 rounded-xl bg-white/[0.03] p-4 text-sm">
            {exito.items.map((it, i) => (
              <p key={i} className="flex justify-between gap-3 text-steel-300">
                <span>
                  {it.descripcion} {it.cantidad > 1 && `×${it.cantidad}`}
                </span>
                <span className="tnum">{it.precio}</span>
              </p>
            ))}
          </div>
          {exito.membresias.map((m, i) => (
            <p key={i} className="mt-3 rounded-xl border border-ok/20 bg-ok/[0.06] p-3 text-center text-sm text-ok">
              {m.plan}
              {m.personas > 1 && ` (${m.personas} personas)`}: del {fecha(m.fechaInicio)} al {fecha(m.fechaFin)}
            </p>
          ))}
          {exito.membresias.length > 0 && exito.cliente && (
            <div className="mt-3">
              <EstadoLector socioId={exito.cliente.id} />
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

/** Elegir acompañantes de un plan grupal (Promo Dúo, familiar…). */
function Acompanantes({ plan, titular, onClose, onListo }: { plan: Plan; titular: ClienteSel; onClose: () => void; onListo: (a: Array<{ id: string; nombre: string }>) => void }) {
  const [sel, setSel] = useState<Array<{ id: string; nombre: string }>>([]);
  const faltan = plan.personas - 1 - sel.length;
  const agregar = (s: SocioLista) => {
    if (s.id === titular.id || sel.some((x) => x.id === s.id)) return toast.warning('Esa persona ya está en el plan');
    if (faltan <= 0) return;
    setSel((x) => [...x, { id: s.id, nombre: `${s.nombre} ${s.apellido}`.trim() }]);
  };
  return (
    <Modal
      title={`${plan.nombre}: ${plan.personas} personas`}
      onClose={onClose}
      footer={
        <button className="btn-primary" disabled={faltan !== 0} onClick={() => onListo(sel)}>
          Listo
        </button>
      }
    >
      <p className="mb-4 text-sm text-steel-400">
        Titular: <b className="text-steel-100">{titular.nombre}</b>. Elige {plan.personas - 1} acompañante(s); cada uno queda con su propia membresía y su rostro en el lector.
      </p>
      {faltan > 0 && <SocioPicker onPick={agregar} placeholder="Buscar acompañante (debe estar registrado)" />}
      <div className="mt-4 space-y-2">
        {sel.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-2.5">
            <span className="font-bold text-steel-100">{s.nombre}</span>
            <button className="text-steel-500 hover:text-bad" onClick={() => setSel((x) => x.filter((y) => y.id !== s.id))}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
