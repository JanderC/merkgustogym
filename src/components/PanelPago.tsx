/**
 * Panel de cobro multimoneda (USD · Bs · COP).
 *  • Cada línea tiene su precio en su moneda; el total se expresa en las tres
 *    con la tasa de cada par (regla de tres).
 *  • Un solo pago en la moneda que elija el cliente, mitad y mitad, o libre.
 *  • Cada pago cubre una FRACCIÓN del total (Bs 500 de Bs 1.000 = 50 %).
 *  • Vuelto en la moneda que se entregue. Pago parcial → queda debiendo.
 * El backend recalcula todo con su propia tasa: aquí solo se ayuda a la cajera.
 */
import { ArrowLeftRight, Banknote, Check, HandCoins, Plus, Wand2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { convertir, fmt, INFO, leerMonto, textoTablero, MONEDAS, redondear, redondearArriba, totales, type Moneda, type Tasas } from '../lib/monedas';
import type { MetodoPago } from '../lib/types';
import { cx, Toggle } from './ui';

export interface PagoPayload {
  pagos: Array<{ metodo: string; moneda: Moneda; monto: number; referencia: string | null }>;
  vuelto: { metodo: string; moneda: Moneda; monto: number } | null;
  pagoParcial: boolean;
}

interface Fila {
  id: number;
  moneda: Moneda;
  metodo: string;
  monto: string;
  referencia: string;
}

let uid = 1;
const TOLERANCIA = 0.0005; // fracción (0,05 %) por redondeos

export function PanelPago({
  lineas,
  metodos,
  tasas,
  onCobrar,
  cobrando,
  etiqueta = 'Cobrar',
  deshabilitado,
  permiteParcial,
}: {
  lineas: Array<{ monto: number; moneda: Moneda }>;
  metodos: MetodoPago[];
  tasas: Tasas;
  onCobrar: (p: PagoPayload) => void;
  cobrando?: boolean;
  etiqueta?: string;
  deshabilitado?: boolean;
  /** Solo con cliente identificado: lo que falte queda como deuda */
  permiteParcial?: boolean;
}) {
  const metodosDe = (m: Moneda) => metodos.filter((x) => x.monedas.includes(m));
  const primerMetodo = (m: Moneda, pref?: string) => (metodosDe(m).some((x) => x.codigo === pref) ? pref! : (metodosDe(m)[0]?.codigo ?? 'efectivo'));
  const clave = lineas.map((l) => `${l.monto}${l.moneda}`).join('|');
  const { exactos, cobrar } = useMemo(() => totales(lineas, tasas), [clave, tasas]); // eslint-disable-line react-hooks/exhaustive-deps
  // Moneda "natural" del ticket: la de la primera línea
  const monedaInicial = lineas[0]?.moneda ?? 'USD';

  const [modo, setModo] = useState<'simple' | 'combinado'>('simple');
  const [filas, setFilas] = useState<Fila[]>([{ id: uid++, moneda: monedaInicial, metodo: primerMetodo(monedaInicial), monto: '', referencia: '' }]);
  const [recibido, setRecibido] = useState('');
  const [parcial, setParcial] = useState(false);
  const [vueltoMoneda, setVueltoMoneda] = useState<Moneda>('COP');
  const [vueltoMetodo, setVueltoMetodo] = useState('efectivo');
  const simple = filas[0]!;
  useEffect(() => setRecibido(''), [clave, simple.moneda]);
  useEffect(() => {
    if (!permiteParcial) setParcial(false);
  }, [permiteParcial]);

  // Filas efectivas: en modo simple el monto es el total exacto (o lo recibido en efectivo)
  const filasEf = useMemo<Fila[]>(() => {
    if (modo === 'combinado') return filas;
    const r = leerMonto(recibido);
    const usaRecibido = r > 0 && (simple.metodo === 'efectivo' || parcial);
    return [{ ...simple, monto: String(usaRecibido ? r : cobrar[simple.moneda]) }];
  }, [modo, filas, recibido, simple, cobrar, parcial]);

  const fraccion = (f: Fila) => (exactos[f.moneda] > 0 ? leerMonto(f.monto) / exactos[f.moneda] : 0);
  const cubierto = filasEf.reduce((s, f) => s + fraccion(f), 0);
  const falta = 1 - cubierto;
  const sobra = cubierto - 1;
  const hayVuelto = sobra > TOLERANCIA;
  const vueltoMonto = hayVuelto ? redondear(sobra * exactos[vueltoMoneda], vueltoMoneda) : 0;
  const metodosVuelto = metodos.filter((m) => ['efectivo', 'pago_movil', 'nequi', 'bancolombia'].includes(m.codigo) && m.monedas.includes(vueltoMoneda));
  useEffect(() => {
    if (!metodosVuelto.some((m) => m.codigo === vueltoMetodo)) setVueltoMetodo(metodosVuelto[0]?.codigo ?? 'efectivo');
  }, [vueltoMoneda, metodosVuelto, vueltoMetodo]);

  const faltaRef = filasEf.some((f) => leerMonto(f.monto) > 0 && metodos.find((m) => m.codigo === f.metodo)?.pideReferencia && !f.referencia.trim());
  const cuadra = falta <= TOLERANCIA;
  const listo = (cuadra || parcial) && !faltaRef && (filasEf.some((f) => leerMonto(f.monto) > 0) || parcial);

  const setFila = (id: number, c: Partial<Fila>) =>
    setFilas((fs) => fs.map((f) => (f.id !== id ? f : { ...f, ...c, ...(c.moneda ? { metodo: primerMetodo(c.moneda, f.metodo) } : {}) })));

  const elegirMoneda = (m: Moneda) => {
    setModo('simple');
    setFilas((fs) => [{ ...fs[0]!, moneda: m, metodo: primerMetodo(m, fs[0]?.metodo), monto: '' }]);
  };
  const mitadYMitad = (a: Moneda, b: Moneda) => {
    setModo('combinado');
    setFilas([
      { id: uid++, moneda: a, metodo: primerMetodo(a), monto: String(redondearArriba(exactos[a] / 2, a)), referencia: '' },
      { id: uid++, moneda: b, metodo: primerMetodo(b), monto: String(redondearArriba(exactos[b] / 2, b)), referencia: '' },
    ]);
  };
  const completar = (id: number) => {
    const otras = filas.filter((f) => f.id !== id).reduce((s, f) => s + fraccion(f), 0);
    const fila = filas.find((f) => f.id === id)!;
    setFila(id, { monto: String(redondearArriba(Math.max(0, 1 - otras) * exactos[fila.moneda], fila.moneda)) });
  };

  const enviar = () =>
    onCobrar({
      pagos: filasEf
        .filter((f) => leerMonto(f.monto) > 0)
        .map((f) => ({ metodo: f.metodo, moneda: f.moneda, monto: redondear(leerMonto(f.monto), f.moneda), referencia: f.referencia.trim() || null })),
      vuelto: hayVuelto ? { metodo: vueltoMetodo, moneda: vueltoMoneda, monto: vueltoMonto } : null,
      pagoParcial: parcial && !cuadra,
    });

  return (
    <div className="space-y-4">
      {/* Total en las tres monedas: tocar una = el cliente paga todo en esa */}
      <div className="grid grid-cols-3 gap-2">
        {MONEDAS.map((m) => {
          const activa = modo === 'simple' && simple.moneda === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => elegirMoneda(m)}
              className={cx('rounded-2xl border p-3 text-left transition', activa ? 'border-flame-500 bg-flame-500/10 shadow-glow' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20')}
            >
              <span className="block text-[11px] font-bold uppercase tracking-wider text-steel-400">{INFO[m].corto}</span>
              <span className={cx('tnum mt-1 block font-display text-lg font-extrabold leading-tight', activa ? 'text-white' : 'text-steel-200')}>{fmt(cobrar[m], m)}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="mr-1 self-center text-[11px] font-bold uppercase tracking-wider text-steel-500">Combinar:</span>
        {(
          [
            ['VES', 'COP'],
            ['USD', 'VES'],
            ['USD', 'COP'],
          ] as Array<[Moneda, Moneda]>
        ).map(([a, b]) => (
          <button key={a + b} type="button" onClick={() => mitadYMitad(a, b)} className="chip cursor-pointer border-white/10 py-1 text-steel-300 hover:border-flame-500/40 hover:text-flame-300">
            ½ {INFO[a].simbolo} + ½ {INFO[b].simbolo}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setModo('combinado');
            setFilas((fs) => [...(modo === 'simple' ? filasEf : fs), { id: uid++, moneda: 'COP', metodo: primerMetodo('COP'), monto: '', referencia: '' }]);
          }}
          className="chip cursor-pointer border-white/10 py-1 text-steel-300 hover:border-flame-500/40 hover:text-flame-300"
        >
          <ArrowLeftRight className="h-3 w-3" /> Libre
        </button>
      </div>

      {modo === 'simple' ? (
        <div className="space-y-3 rounded-2xl border border-white/[0.06] p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-steel-500">Paga en {INFO[simple.moneda].nombre.toLowerCase()} con</p>
          <MetodoChips metodos={metodosDe(simple.moneda)} valor={simple.metodo} onChange={(c) => setFila(simple.id, { metodo: c })} />
          {(simple.metodo === 'efectivo' || parcial) && (
            <div className="flex items-center gap-3">
              <Banknote className="h-5 w-5 shrink-0 text-steel-500" />
              <input
                className="input tnum h-10"
                inputMode="decimal"
                placeholder={parcial ? `¿Cuánto abona ahora? (de ${fmt(cobrar[simple.moneda], simple.moneda)})` : `¿Con cuánto paga? (${fmt(cobrar[simple.moneda], simple.moneda)})`}
                value={recibido}
                onChange={(e) => setRecibido(e.target.value)}
              />
            </div>
          )}
          {metodos.find((m) => m.codigo === simple.metodo)?.pideReferencia && (
            <input className={cx('input h-10', !simple.referencia.trim() && 'border-warn/50')} placeholder="Número de referencia" value={simple.referencia} onChange={(e) => setFila(simple.id, { referencia: e.target.value })} />
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filas.map((f, i) => {
            const met = metodos.find((m) => m.codigo === f.metodo);
            const pct = Math.round(fraccion(f) * 100);
            return (
              <div key={f.id} className="space-y-2 rounded-2xl border border-white/[0.06] p-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-white/[0.06] text-xs font-bold text-steel-400">{i + 1}</span>
                  <div className="inline-flex rounded-lg bg-ink-950/60 p-0.5">
                    {MONEDAS.map((m) => (
                      <button key={m} type="button" onClick={() => setFila(f.id, { moneda: m })} className={cx('rounded-md px-2.5 py-1 text-xs font-bold', f.moneda === m ? 'bg-steel-200 text-ink-950' : 'text-steel-400')}>
                        {INFO[m].simbolo}
                      </button>
                    ))}
                  </div>
                  <input className="input tnum h-9 flex-1" inputMode="decimal" placeholder={`Monto en ${INFO[f.moneda].simbolo}`} value={f.monto} onChange={(e) => setFila(f.id, { monto: e.target.value })} />
                  <button type="button" title="Completar con lo que falta" onClick={() => completar(f.id)} className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.05] text-flame-400 hover:bg-flame-500/15">
                    <Wand2 className="h-4 w-4" />
                  </button>
                  {filas.length > 1 && (
                    <button type="button" onClick={() => setFilas((fs) => fs.filter((x) => x.id !== f.id))} className="text-steel-500 hover:text-bad">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <MetodoChips metodos={metodosDe(f.moneda)} valor={f.metodo} onChange={(c) => setFila(f.id, { metodo: c })} small />
                  {pct > 0 && <span className="tnum shrink-0 text-[11px] font-bold text-steel-500">{pct}%</span>}
                </div>
                {met?.pideReferencia && (
                  <input className={cx('input h-9', leerMonto(f.monto) > 0 && !f.referencia.trim() && 'border-warn/50')} placeholder={`Referencia ${met.nombre}`} value={f.referencia} onChange={(e) => setFila(f.id, { referencia: e.target.value })} />
                )}
              </div>
            );
          })}
          <button type="button" className="flex items-center gap-1.5 text-sm font-bold text-flame-400" onClick={() => setFilas((fs) => [...fs, { id: uid++, moneda: 'USD', metodo: primerMetodo('USD'), monto: '', referencia: '' }])}>
            <Plus className="h-4 w-4" /> Otra moneda o método
          </button>
        </div>
      )}

      {permiteParcial && (
        <div className="rounded-xl border border-white/[0.06]">
          <Toggle checked={parcial} onChange={setParcial} label="Paga una parte (queda debiendo)" hint="Lo que falte queda como deuda del cliente y se abona después" />
        </div>
      )}

      {/* Estado del cuadre */}
      {!cuadra ? (
        <div className={cx('rounded-xl border px-4 py-3 text-sm', parcial ? 'border-sky-400/30 bg-sky-400/[0.06]' : 'border-warn/30 bg-warn/[0.07]')}>
          <p className={cx('flex items-center gap-1.5 font-bold', parcial ? 'text-sky-300' : 'text-warn')}>
            {parcial && <HandCoins className="h-4 w-4" />} {parcial ? 'Queda debiendo' : 'Faltan'}
          </p>
          <p className="tnum text-steel-200">{MONEDAS.map((m) => fmt(redondearArriba(falta * exactos[m], m), m)).join('  ·  ')}</p>
        </div>
      ) : hayVuelto ? (
        <div className="space-y-2 rounded-xl border border-sky-400/30 bg-sky-400/[0.07] p-4">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sky-300">Vuelto a entregar</p>
            <p className="tnum font-wide text-2xl text-white">{fmt(vueltoMonto, vueltoMoneda)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-ink-950/60 p-0.5">
              {MONEDAS.map((m) => (
                <button key={m} type="button" onClick={() => setVueltoMoneda(m)} className={cx('rounded-md px-2.5 py-1 text-xs font-bold', vueltoMoneda === m ? 'bg-sky-300 text-ink-950' : 'text-steel-400')}>
                  {INFO[m].simbolo}
                </button>
              ))}
            </div>
            <MetodoChips metodos={metodosVuelto} valor={vueltoMetodo} onChange={setVueltoMetodo} small />
          </div>
        </div>
      ) : (
        listo && (
          <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-ok">
            <Check className="h-4 w-4" /> Pago completo
          </p>
        )
      )}

      <button type="button" className="btn-primary btn-xl w-full" disabled={!listo || cobrando || deshabilitado} onClick={enviar}>
        {cobrando ? 'Registrando…' : etiqueta}
      </button>
      <p className="text-center text-[11px] text-steel-600">
        Tasas en pesos: {textoTablero(tasas)} · $1 = Bs {(tasas.usdCop / tasas.vesCop).toLocaleString('es-VE', { maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

function MetodoChips({ metodos, valor, onChange, small }: { metodos: MetodoPago[]; valor: string; onChange: (c: string) => void; small?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {metodos.map((m) => (
        <button
          key={m.codigo}
          type="button"
          onClick={() => onChange(m.codigo)}
          className={cx('rounded-lg font-bold transition', small ? 'px-2.5 py-1 text-xs' : 'px-3 py-2 text-sm', valor === m.codigo ? 'bg-steel-200 text-ink-950' : 'bg-white/[0.04] text-steel-400 hover:text-steel-100')}
        >
          {m.nombre}
        </button>
      ))}
    </div>
  );
}

/** Precio en su moneda + equivalentes en las otras dos (texto pequeño). */
export function Precio({ monto, moneda, tasas, grande }: { monto: number; moneda: Moneda; tasas: Tasas | undefined; grande?: boolean }) {
  return (
    <span className="block">
      <span className={cx('tnum font-display font-extrabold text-flame-400', grande ? 'font-wide text-2xl' : 'text-lg')}>{fmt(monto, moneda)}</span>
      {tasas && (
        <span className="tnum block text-[11px] text-steel-500">
          {MONEDAS.filter((m) => m !== moneda)
            .map((m) => fmt(redondearArriba(convertir(monto, moneda, m, tasas), m), m))
            .join(' · ')}
        </span>
      )}
    </span>
  );
}

