/**
 * Devolución de productos en caja. La cajera arma la devolución, pero solo se
 * registra cuando el SUPERVISOR escribe su código (dueño o administrador de caja).
 * El dinero sale de la caja de la cajera y la mercancía vuelve al inventario si
 * está en buen estado.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, LockKeyhole, Minus, Plus, Search, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { fecha, hora } from '../lib/format';
import { useCatalogo } from '../lib/hooks';
import { convertir, fmt, INFO, MONEDAS, redondear, type Moneda } from '../lib/monedas';
import { cx, Field, Modal, Toggle } from './ui';

interface ItemTicket {
  ventaItemId: number;
  descripcion: string;
  cantidad: number;
  devuelto: number;
  disponible: number;
  moneda: Moneda;
  precioUnitario: number;
  precioTexto: string;
}
interface Ticket {
  id: string;
  numero: number;
  creadoEn: string;
  cajero: string;
  socio: string | null;
  conDeuda: boolean;
  items: ItemTicket[];
}
interface Hecha {
  ticket: number;
  autorizadoPor: string;
  metodo: string;
  montoTexto: string;
  reingresaStock: boolean;
  items: Array<{ descripcion: string; cantidad: number; subtotal: string }>;
}

const MOTIVOS = ['Producto dañado', 'Producto vencido', 'Se equivocó de producto', 'Cobrado de más', 'El cliente no lo quiso'];
const METODOS = ['efectivo', 'pago_movil', 'nequi', 'bancolombia'];

export function DevolucionModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: cat } = useCatalogo();
  const [numero, setNumero] = useState('');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [cant, setCant] = useState<Record<number, number>>({});
  const [motivo, setMotivo] = useState('');
  const [reingresa, setReingresa] = useState(true);
  const [moneda, setMoneda] = useState<Moneda>('COP');
  const [metodo, setMetodo] = useState('efectivo');
  const [pin, setPin] = useState('');
  const [hecha, setHecha] = useState<Hecha | null>(null);

  const buscar = useMutation({
    mutationFn: (n: string) => api<Ticket>(`/pos/devoluciones/ticket/${encodeURIComponent(n.replace(/\D/g, ''))}`),
    onSuccess: (t) => {
      setTicket(t);
      setCant({});
      setMoneda(t.items[0]?.moneda ?? 'COP');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const metodos = (cat?.metodos ?? []).filter((m) => METODOS.includes(m.codigo) && m.monedas.includes(moneda));
  const metodoOk = metodos.some((m) => m.codigo === metodo) ? metodo : (metodos[0]?.codigo ?? 'efectivo');
  const elegidos = (ticket?.items ?? []).filter((i) => (cant[i.ventaItemId] ?? 0) > 0);
  const monto = useMemo(() => {
    if (!cat) return 0;
    return redondear(elegidos.reduce((s, i) => s + convertir(i.precioUnitario * (cant[i.ventaItemId] ?? 0), i.moneda, moneda, cat.tasas), 0), moneda);
  }, [elegidos, cant, moneda, cat]);

  const devolver = useMutation({
    mutationFn: () =>
      api<Hecha>('/pos/devoluciones', {
        body: {
          ventaId: ticket!.id,
          items: elegidos.map((i) => ({ ventaItemId: i.ventaItemId, cantidad: cant[i.ventaItemId] })),
          metodo: metodoOk,
          moneda,
          motivo: motivo.trim(),
          reingresaStock: reingresa,
          pin,
        },
      }),
    onSuccess: (r) => {
      setHecha(r);
      ['turno', 'catalogo', 'productos'].forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e: Error) => {
      setPin('');
      toast.error(e.message);
    },
  });

  if (hecha) {
    return (
      <Modal
        title="Devolución autorizada"
        size="sm"
        onClose={onClose}
        footer={
          <button className="btn-primary w-full" autoFocus onClick={onClose}>
            Listo
          </button>
        }
      >
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-ok" />
          <p className="mt-2 text-sm text-steel-400">
            Ticket #{hecha.ticket} · autorizó <b className="text-steel-100">{hecha.autorizadoPor}</b>
          </p>
        </div>
        <p className="mt-4 rounded-xl border border-sky-400/30 bg-sky-400/[0.08] p-3 text-center text-lg font-bold text-sky-300">
          Entrega al cliente: {hecha.montoTexto} <span className="text-sm font-semibold text-sky-200/80">({hecha.metodo})</span>
        </p>
        <div className="mt-3 space-y-1 rounded-xl bg-white/[0.03] p-4 text-sm">
          {hecha.items.map((it, i) => (
            <p key={i} className="flex justify-between gap-3 text-steel-300">
              <span>
                {it.descripcion} {it.cantidad > 1 && `×${it.cantidad}`}
              </span>
              <span className="tnum">{it.subtotal}</span>
            </p>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-steel-500">{hecha.reingresaStock ? 'La mercancía volvió al inventario.' : 'La mercancía NO vuelve al inventario (dañada o vencida).'}</p>
      </Modal>
    );
  }

  const listo = !!ticket && elegidos.length > 0 && motivo.trim().length >= 4 && pin.length >= 4 && !devolver.isPending;

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <Undo2 className="h-5 w-5 text-flame-400" /> Devolución de productos
        </span>
      }
      onClose={onClose}
      footer={
        ticket && (
          <button className="btn-primary" disabled={!listo} onClick={() => devolver.mutate()}>
            <LockKeyhole className="h-4 w-4" /> {devolver.isPending ? 'Verificando…' : 'Autorizar y devolver'}
          </button>
        )
      }
    >
      {/* 1. Ticket */}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (numero.trim()) buscar.mutate(numero);
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
          <input className="input tnum pl-11 text-lg" inputMode="numeric" placeholder="Número del ticket (ej. 154)" value={numero} onChange={(e) => setNumero(e.target.value)} autoFocus />
        </div>
        <button className="btn-ghost" disabled={!numero.trim() || buscar.isPending}>
          Buscar
        </button>
      </form>
      {!ticket && <p className="mt-2 text-xs text-steel-500">Escribe el número que aparece en el ticket del cliente.</p>}

      {ticket && (
        <div className="mt-5 space-y-5">
          <p className="text-sm text-steel-400">
            Ticket <b className="text-white">#{ticket.numero}</b> del {fecha(ticket.creadoEn)} {hora(ticket.creadoEn)} · cobró {ticket.cajero}
            {ticket.socio && <> · {ticket.socio}</>}
          </p>
          {ticket.conDeuda && <p className="rounded-xl border border-warn/30 bg-warn/[0.07] p-3 text-sm text-warn">Este ticket tiene saldo pendiente del cliente. La administración debe resolverlo primero.</p>}

          {/* 2. Qué devuelve */}
          {ticket.items.length === 0 ? (
            <p className="rounded-xl bg-white/[0.03] p-4 text-center text-sm text-steel-400">Este ticket no tiene productos de la tienda. Los planes los anula la administración.</p>
          ) : (
            <div className="space-y-1.5">
              {ticket.items.map((i) => {
                const c = cant[i.ventaItemId] ?? 0;
                const set = (n: number) => setCant((x) => ({ ...x, [i.ventaItemId]: Math.max(0, Math.min(i.disponible, n)) }));
                return (
                  <div key={i.ventaItemId} className={cx('flex items-center gap-3 rounded-xl border px-3 py-2.5', c > 0 ? 'border-flame-500/50 bg-flame-500/[0.05]' : 'border-white/[0.06]')}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-steel-100">{i.descripcion}</p>
                      <p className="tnum text-xs text-steel-500">
                        {i.precioTexto} · vendidos {i.cantidad}
                        {i.devuelto > 0 && <span className="text-warn"> · ya devueltos {i.devuelto}</span>}
                      </p>
                    </div>
                    {i.disponible > 0 ? (
                      <div className="flex items-center gap-1">
                        <button className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.05] hover:bg-white/10" onClick={() => set(c - 1)}>
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="tnum w-7 text-center font-bold">{c}</span>
                        <button className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.05] hover:bg-white/10" onClick={() => set(c + 1)}>
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="chip border-white/10 text-steel-500">Devuelto</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {elegidos.length > 0 && (
            <>
              {/* 3. Por qué */}
              <Field label="Motivo">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {MOTIVOS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMotivo(m);
                        setReingresa(!/dañado|vencido/i.test(m));
                      }}
                      className={cx('rounded-full px-3 py-1 text-xs font-bold transition', motivo === m ? 'bg-flame-500 text-ink-950' : 'bg-white/[0.04] text-steel-400 hover:text-steel-100')}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <input className="input" placeholder="O escribe el motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} />
              </Field>
              <div className="rounded-xl border border-white/[0.06]">
                <Toggle checked={reingresa} onChange={setReingresa} label="Vuelve al inventario" hint="Apágalo si el producto está dañado o vencido (no se puede volver a vender)" />
              </div>

              {/* 4. Cuánto y cómo se devuelve */}
              <div className="space-y-3 rounded-2xl border border-sky-400/25 bg-sky-400/[0.05] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-sky-300">Se devuelve</p>
                  <p className="tnum font-wide text-2xl text-white">{fmt(monto, moneda)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-lg bg-ink-950/60 p-0.5">
                    {MONEDAS.map((m) => (
                      <button key={m} type="button" onClick={() => setMoneda(m)} className={cx('rounded-md px-2.5 py-1 text-xs font-bold', moneda === m ? 'bg-sky-300 text-ink-950' : 'text-steel-400')}>
                        {INFO[m].simbolo}
                      </button>
                    ))}
                  </div>
                  {metodos.map((m) => (
                    <button key={m.codigo} type="button" onClick={() => setMetodo(m.codigo)} className={cx('rounded-lg px-2.5 py-1 text-xs font-bold', metodoOk === m.codigo ? 'bg-steel-200 text-ink-950' : 'bg-white/[0.04] text-steel-400')}>
                      {m.nombre}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-steel-500">Sale de tu caja y se descuenta en tu cierre.</p>
              </div>

              {/* 5. Supervisor */}
              <div className="rounded-2xl border border-flame-500/30 bg-flame-500/[0.05] p-4">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-flame-300">
                  <LockKeyhole className="h-4 w-4" /> Código del supervisor
                </p>
                <input
                  className="input pin tnum text-center text-2xl tracking-[0.6em]"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={8}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && listo && devolver.mutate()}
                />
                <p className="mt-2 text-[11px] text-steel-500">Lo escribe el dueño o el administrador de caja. Queda registrado quién autorizó.</p>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
