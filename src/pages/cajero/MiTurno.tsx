import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, EyeOff, HandCoins, ImageUp, Lock, Receipt, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { cx, Empty, Field, Loading, Modal, PageHeader, Tabs } from '../../components/ui';
import { api } from '../../lib/api';
import { duracion, fechaHora, hora } from '../../lib/format';
import { useCatalogo, useTurno } from '../../lib/hooks';
import { INFO, leerMonto, MONEDAS, type Moneda } from '../../lib/monedas';
import { AbrirTurno } from './Cobrar';

export default function MiTurno() {
  const { data: turno, isLoading } = useTurno();
  const [cerrar, setCerrar] = useState(false);
  const [mov, setMov] = useState<null | 'egreso' | 'ingreso'>(null);
  const [cerrado, setCerrado] = useState<null | { numero: number; abiertoEn: string; cerradoEn: string; operaciones: number }>(null);

  if (isLoading) return <Loading />;
  if (cerrado) {
    return (
      <div className="mx-auto mt-10 max-w-xl text-center">
        <div className="plate px-8 pb-10 pt-12">
          <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-ok/10 text-ok">
            <HandCoins className="h-10 w-10" />
          </div>
          <h2 className="font-wide text-3xl text-white">Turno #{cerrado.numero} cerrado</h2>
          <p className="mx-auto mt-3 max-w-sm text-steel-300">Entrega el dinero y los comprobantes. El detalle del cierre le llega al dueño.</p>
          <p className="mt-6 text-sm text-steel-500">
            {fechaHora(cerrado.abiertoEn)} → {hora(cerrado.cerradoEn)} · {cerrado.operaciones} operación(es)
          </p>
          <button className="btn-ghost mx-auto mt-8" onClick={() => setCerrado(null)}>
            Listo
          </button>
        </div>
      </div>
    );
  }
  if (!turno) return <AbrirTurno />;

  return (
    <div>
      <PageHeader
        title={`Mi turno #${turno.numero}`}
        kicker="Turno abierto"
        actions={
          <>
            <button className="btn-ghost" onClick={() => setMov('egreso')}>
              <ArrowUpCircle className="h-4 w-4 text-bad" /> Registrar gasto
            </button>
            <button className="btn-ghost" onClick={() => setMov('ingreso')}>
              <ArrowDownCircle className="h-4 w-4 text-ok" /> Ingreso
            </button>
            <button className="btn-primary" onClick={() => setCerrar(true)}>
              <Lock className="h-4 w-4" /> Cerrar turno
            </button>
          </>
        }
      >
        Abierto a las {hora(turno.abiertoEn)} · lleva {duracion(turno.abiertoEn)} · {turno.operaciones} operación(es)
      </PageHeader>

      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-steel-400">
        <EyeOff className="h-4 w-4 shrink-0 text-flame-500" /> Aquí ves lo que vendiste y los gastos que registraste. El cuadre lo revisa administración al recibir tu cierre.
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="card overflow-hidden">
          <div className="border-b border-white/[0.06] px-5 py-3">
            <p className="font-display font-extrabold text-white">Ventas</p>
          </div>
          {turno.ventas.length === 0 ? (
            <Empty icon={<Receipt className="h-7 w-7" />} title="Aún no has vendido nada" hint="Cada cobro aparecerá aquí." />
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {turno.ventas.map((v) => (
                <div key={v.id} className={cx('flex items-start gap-4 px-5 py-4', v.estado === 'anulada' && 'opacity-50')}>
                  <div className="w-24 shrink-0">
                    <p className="tnum font-bold text-steel-200">{hora(v.creadoEn)}</p>
                    <p className="text-xs text-steel-600">#{v.numero}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cx('font-bold text-steel-100', v.estado === 'anulada' && 'line-through')}>{v.items.join(' · ')}</p>
                    <p className="text-xs text-steel-500">
                      {v.socio ?? 'Cliente ocasional'}
                      {v.quedoDebiendo && <span className="ml-2 text-warn">· quedó debiendo</span>}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {v.estado === 'anulada' ? (
                      <span className="chip border-bad/30 text-bad">Anulada</span>
                    ) : (
                      v.metodos.map((m) => (
                        <span key={m} className="chip border-white/10 text-steel-400">
                          {m}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-white/[0.06] px-5 py-3">
            <p className="font-display font-extrabold text-white">Gastos e ingresos de caja</p>
          </div>
          {turno.movimientos.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-steel-500">Si pagas algo con el dinero de la caja (botellones, limpieza…), regístralo aquí para que tu cierre cuadre.</p>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {turno.movimientos.map((m) => (
                <div key={m.id} className={cx('flex items-center gap-3 px-5 py-3', m.anulado && 'opacity-40 line-through')}>
                  {m.tipo === 'egreso' ? <ArrowUpCircle className="h-5 w-5 shrink-0 text-bad" /> : <ArrowDownCircle className="h-5 w-5 shrink-0 text-ok" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-steel-100">{m.concepto}</p>
                    <p className="text-xs text-steel-500">
                      {m.categoria} · {m.metodo} · {hora(m.creadoEn)}
                    </p>
                  </div>
                  <span className={cx('tnum font-bold', m.tipo === 'egreso' ? 'text-bad' : 'text-ok')}>
                    {m.tipo === 'egreso' ? '−' : '+'}
                    {m.montoTexto}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {mov && <MovimientoModal tipo={mov} onClose={() => setMov(null)} />}
      {cerrar && (
        <CerrarTurnoModal
          onClose={() => setCerrar(false)}
          onDone={(r) => {
            setCerrar(false);
            setCerrado(r);
          }}
        />
      )}
    </div>
  );
}

/** Registrar gasto o ingreso de caja (lo usan cajera y administración). */
export function MovimientoModal({ tipo: tipoInicial, onClose, endpoint = '/pos/movimientos', onDone }: { tipo: 'egreso' | 'ingreso'; onClose: () => void; endpoint?: string; onDone?: () => void }) {
  const qc = useQueryClient();
  const { data: cat } = useCatalogo();
  const [tipo, setTipo] = useState(tipoInicial);
  const [f, setF] = useState({ categoria: '', concepto: '', metodo: 'efectivo', moneda: 'COP' as Moneda, monto: '', referencia: '' });
  const [comprobante, setComprobante] = useState<string | null>(null);
  const categorias = cat?.categorias[tipo] ?? [];
  const metodos = (cat?.metodos ?? []).filter((m) => m.monedas.includes(f.moneda));
  const m = useMutation({
    mutationFn: () => api(endpoint, { body: { tipo, ...f, categoria: f.categoria || categorias[0], monto: leerMonto(f.monto), comprobante } }),
    onSuccess: () => {
      toast.success(tipo === 'egreso' ? 'Gasto registrado' : 'Ingreso registrado');
      ['turno', 'movimientos', 'finanzas'].forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
      onDone?.();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const subir = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return toast.error('El archivo pesa más de 4 MB');
    const r = new FileReader();
    r.onload = () => setComprobante(String(r.result));
    r.readAsDataURL(file);
  };
  return (
    <Modal
      title={tipo === 'egreso' ? 'Registrar gasto de caja' : 'Registrar ingreso de caja'}
      onClose={onClose}
      footer={
        <button className="btn-primary" disabled={m.isPending || f.concepto.trim().length < 3 || leerMonto(f.monto) <= 0} onClick={() => m.mutate()}>
          Registrar
        </button>
      }
    >
      <div className="mb-4">
        <Tabs
          value={tipo}
          onChange={(t) => (setTipo(t), setF({ ...f, categoria: '' }))}
          items={[
            { value: 'egreso', label: 'Gasto (sale dinero)' },
            { value: 'ingreso', label: 'Ingreso (entra dinero)' },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Categoría">
          <select className="input" value={f.categoria || categorias[0]} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
            {categorias.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Moneda">
          <Tabs value={f.moneda} onChange={(mo) => setF({ ...f, moneda: mo, metodo: (cat?.metodos ?? []).find((x) => x.monedas.includes(mo))?.codigo ?? 'efectivo' })} items={MONEDAS.map((x) => ({ value: x, label: INFO[x].simbolo }))} />
        </Field>
        <Field label="Concepto" className="col-span-2">
          <input className="input" value={f.concepto} onChange={(e) => setF({ ...f, concepto: e.target.value })} placeholder={tipo === 'egreso' ? 'Ej. pago de 5 botellones de agua' : 'Ej. sencillo que dejó el dueño'} />
        </Field>
        <Field label={`Monto (${INFO[f.moneda].simbolo})`}>
          <input className="input tnum text-lg" inputMode="decimal" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} />
        </Field>
        <Field label="Cómo">
          <select className="input" value={f.metodo} onChange={(e) => setF({ ...f, metodo: e.target.value })}>
            {metodos.map((x) => (
              <option key={x.codigo} value={x.codigo}>
                {x.nombre}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Referencia (opcional)">
          <input className="input" value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value })} />
        </Field>
        <Field label="Comprobante (foto o PDF)">
          <label className="btn-ghost w-full cursor-pointer">
            <ImageUp className="h-4 w-4" /> {comprobante ? 'Cambiar archivo' : 'Adjuntar'}
            <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => subir(e.target.files?.[0])} />
          </label>
        </Field>
        {comprobante?.startsWith('data:image') && <img src={comprobante} alt="Comprobante" className="col-span-2 max-h-48 rounded-xl object-contain" />}
      </div>
    </Modal>
  );
}

function CerrarTurnoModal({ onClose, onDone }: { onClose: () => void; onDone: (r: { numero: number; abiertoEn: string; cerradoEn: string; operaciones: number }) => void }) {
  const qc = useQueryClient();
  const { data: cat } = useCatalogo();
  const [montos, setMontos] = useState<Record<string, string>>({});
  const [nota, setNota] = useState('');
  const [confirmo, setConfirmo] = useState(false);
  const m = useMutation({
    mutationFn: () =>
      api<{ numero: number; abiertoEn: string; cerradoEn: string; operaciones: number }>('/pos/turno/cerrar', {
        body: {
          declaraciones: Object.entries(montos)
            .map(([k, v]) => {
              const [metodo, moneda] = k.split('|') as [string, Moneda];
              return { metodo, moneda, monto: leerMonto(v) };
            })
            .filter((d) => d.monto > 0),
          nota: nota || null,
        },
      }),
    onSuccess: (r) => {
      toast.success('Turno cerrado');
      void qc.invalidateQueries({ queryKey: ['turno'] });
      onDone(r);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal
      title="Cerrar turno"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Seguir trabajando
          </button>
          <button className="btn-primary" disabled={!confirmo || m.isPending} onClick={() => m.mutate()}>
            <Lock className="h-4 w-4" /> {m.isPending ? 'Cerrando…' : 'Cerrar y entregar'}
          </button>
        </>
      }
    >
      <div className="mb-5 flex gap-3 rounded-xl border border-flame-500/20 bg-flame-500/[0.06] p-4 text-sm text-steel-300">
        <ShieldCheck className="h-5 w-5 shrink-0 text-flame-500" />
        <p>Cuenta el dinero de cada moneda por separado y escribe cuánto entregas. Para transferencias, escribe lo que viste entrar. Deja en blanco lo que no tengas: el sistema compara y se lo informa a administración.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {MONEDAS.map((mon) => {
          const mets = (cat?.metodos ?? []).filter((mt) => mt.monedas.includes(mon));
          if (!mets.length) return null;
          return (
            <div key={mon} className="rounded-2xl border border-white/[0.06] p-4">
              <p className="mb-3 font-display font-extrabold text-white">{INFO[mon].nombre}</p>
              <div className="space-y-3">
                {mets.map((mt) => {
                  const k = `${mt.codigo}|${mon}`;
                  return (
                    <Field key={k} label={mt.nombre}>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-steel-500">{INFO[mon].simbolo}</span>
                        <input className="input tnum pl-12" inputMode="decimal" placeholder={mon === 'COP' ? '0' : '0,00'} value={montos[k] ?? ''} onChange={(e) => setMontos((p) => ({ ...p, [k]: e.target.value }))} />
                      </div>
                    </Field>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <Field label="Nota (opcional)" className="mt-4">
        <textarea className="input" rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. un pago móvil pendiente por confirmar…" />
      </Field>
      <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-xl bg-white/[0.03] p-3 text-sm font-bold text-steel-200">
        <input type="checkbox" className="h-5 w-5 accent-[#FF8A10]" checked={confirmo} onChange={(e) => setConfirmo(e.target.checked)} />
        Conté el dinero y lo entrego
      </label>
    </Modal>
  );
}
