import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useConfigPublica } from '../../components/TasaWidget';
import { cx, Field, Loading, Modal, PageHeader, Toggle } from '../../components/ui';
import { api } from '../../lib/api';
import { fechaHora } from '../../lib/format';
import { INFO, leerMonto, MONEDAS, textoTablero, type Moneda } from '../../lib/monedas';
import type { MetodoPago } from '../../lib/types';

interface Gym {
  nombre: string;
  slogan: string;
  direccion: string;
  telefono: string;
  horario: string;
  instagram: string;
  moneda: string;
}
interface Config {
  gym: Gym;
  caja: { fondo: Record<Moneda, number> };
  categorias: { egreso: string[]; ingreso: string[] };
  metodos: MetodoPago[];
  monedaRef: Moneda;
}

export default function Ajustes() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['config'], queryFn: () => api<Config>('/config') });
  const { data: pub } = useConfigPublica();
  const [gym, setGym] = useState<Gym | null>(null);
  const [fondo, setFondo] = useState<Record<Moneda, string>>({ USD: '', VES: '', COP: '' });
  const [pass, setPass] = useState({ actual: '', nueva: '' });
  const [nuevoMetodo, setNuevoMetodo] = useState(false);
  useEffect(() => {
    if (data && !gym) {
      setGym(data.gym);
      setFondo({ USD: String(data.caja.fondo?.USD || ''), VES: String(data.caja.fondo?.VES || ''), COP: String(data.caja.fondo?.COP || '') });
    }
  }, [data, gym]);

  const err = (e: Error) => toast.error(e.message);
  const recargar = () => ['config', 'catalogo'].forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
  const guardarGym = useMutation({ mutationFn: () => api('/config/gym', { method: 'PUT', body: gym }), onSuccess: () => (toast.success('Datos del gimnasio guardados'), recargar()), onError: err });
  const guardarCaja = useMutation({
    mutationFn: () => api('/config/caja', { method: 'PUT', body: { fondo: { USD: leerMonto(fondo.USD), VES: leerMonto(fondo.VES), COP: leerMonto(fondo.COP) } } }),
    onSuccess: () => toast.success('Fondo guardado (aplica desde el próximo turno)'),
    onError: err,
  });
  const metodo = useMutation({
    mutationFn: (m: Partial<MetodoPago> & { codigo: string }) => api(`/config/metodos/${m.codigo}`, { method: 'PUT', body: { activo: m.activo, pideReferencia: m.pideReferencia, monedas: m.monedas } }),
    onSuccess: recargar,
    onError: err,
  });
  const categorias = useMutation({ mutationFn: (c: Config['categorias']) => api('/config/categorias', { method: 'PUT', body: c }), onSuccess: () => (toast.success('Categorías guardadas'), recargar()), onError: err });
  const cambiarPass = useMutation({ mutationFn: () => api('/auth/cambiar-password', { body: pass }), onSuccess: () => (toast.success('Contraseña actualizada'), setPass({ actual: '', nueva: '' })), onError: err });

  if (!data || !gym) return <Loading />;
  const g = <K extends keyof Gym>(k: K, v: string) => setGym({ ...gym, [k]: v });

  return (
    <div>
      <PageHeader title="Ajustes" kicker="Configuración" />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <div className="card p-6">
            <p className="mb-1 font-display text-lg font-extrabold text-white">El gimnasio</p>
            <p className="mb-5 text-sm text-steel-500">Lo usa el asistente de WhatsApp para responder.</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nombre">
                <input className="input" value={gym.nombre} onChange={(e) => g('nombre', e.target.value)} />
              </Field>
              <Field label="Lema">
                <input className="input" value={gym.slogan} onChange={(e) => g('slogan', e.target.value)} />
              </Field>
              <Field label="Dirección" className="col-span-2">
                <input className="input" value={gym.direccion} onChange={(e) => g('direccion', e.target.value)} />
              </Field>
              <Field label="Horario" className="col-span-2">
                <input className="input" value={gym.horario} onChange={(e) => g('horario', e.target.value)} />
              </Field>
              <Field label="Teléfono">
                <input className="input" value={gym.telefono} onChange={(e) => g('telefono', e.target.value)} />
              </Field>
              <Field label="Instagram">
                <input className="input" value={gym.instagram} onChange={(e) => g('instagram', e.target.value)} placeholder="@merkgustogym" />
              </Field>
            </div>
            <div className="mt-5 flex justify-end">
              <button className="btn-primary" disabled={guardarGym.isPending} onClick={() => guardarGym.mutate()}>
                Guardar
              </button>
            </div>
          </div>

          <Link to="/panel/tasas" className="plate card-hover flex items-center gap-4 p-5 pt-6">
            <ArrowLeftRight className="h-6 w-6 text-flame-500" />
            <div className="flex-1">
              <p className="font-display font-extrabold text-white">Tasas del día</p>
              <p className="tnum text-sm text-steel-400">
                {pub ? `En pesos: ${textoTablero(pub.tasas)}` : '…'}
              </p>
              {pub?.tasasActualizadas && <p className="text-xs text-steel-500">Actualizada {fechaHora(pub.tasasActualizadas)}</p>}
            </div>
            <span className="text-sm font-bold text-flame-400">Abrir →</span>
          </Link>

          <CategoriasEditor valor={data.categorias} onGuardar={(c) => categorias.mutate(c)} />

          <div className="card p-6">
            <p className="mb-4 font-display text-lg font-extrabold text-white">Mi contraseña</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Actual">
                <input className="input" type="password" value={pass.actual} onChange={(e) => setPass({ ...pass, actual: e.target.value })} />
              </Field>
              <Field label="Nueva">
                <input className="input" type="password" value={pass.nueva} onChange={(e) => setPass({ ...pass, nueva: e.target.value })} />
              </Field>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="btn-primary" disabled={!pass.actual || pass.nueva.length < 6} onClick={() => cambiarPass.mutate()}>
                Cambiar
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <p className="mb-1 font-display text-lg font-extrabold text-white">Fondo de caja</p>
            <p className="mb-5 text-sm text-steel-500">El sencillo que recibe la cajera al abrir, en cada moneda. Se suma a lo esperado en efectivo de su cierre.</p>
            <div className="grid grid-cols-3 gap-3">
              {MONEDAS.map((m) => (
                <Field key={m} label={INFO[m].simbolo}>
                  <input className="input tnum" inputMode="decimal" placeholder="0" value={fondo[m]} onChange={(e) => setFondo((f) => ({ ...f, [m]: e.target.value }))} />
                </Field>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button className="btn-primary" onClick={() => guardarCaja.mutate()}>
                Guardar fondo
              </button>
            </div>
          </div>

          <div className="card p-6">
            <div className="mb-1 flex items-center justify-between">
              <p className="font-display text-lg font-extrabold text-white">Métodos de pago</p>
              <button className="btn-ghost btn-sm" onClick={() => setNuevoMetodo(true)}>
                <Plus className="h-4 w-4" /> Nuevo
              </button>
            </div>
            <p className="mb-4 text-sm text-steel-500">Toca las monedas que recibe cada método. Ej. Pago Móvil solo Bs, Nequi y Bancolombia solo COP, Zelle solo $.</p>
            <div className="divide-y divide-white/[0.04]">
              {data.metodos.map((m) => (
                <div key={m.codigo} className="py-2">
                  <div className="grid grid-cols-2">
                    <Toggle checked={!!m.activo} onChange={(v) => metodo.mutate({ codigo: m.codigo, activo: v })} label={m.nombre} />
                    <Toggle checked={m.pideReferencia} onChange={(v) => metodo.mutate({ codigo: m.codigo, pideReferencia: v })} label="Pide referencia" />
                  </div>
                  <div className="ml-3 flex gap-1.5">
                    {MONEDAS.map((mon) => {
                      const on = m.monedas.includes(mon);
                      return (
                        <button
                          key={mon}
                          type="button"
                          onClick={() => {
                            const nuevas = on ? m.monedas.filter((x) => x !== mon) : [...m.monedas, mon];
                            if (nuevas.length) metodo.mutate({ codigo: m.codigo, monedas: nuevas });
                          }}
                          className={cx('rounded-lg px-2.5 py-1 text-xs font-bold transition', on ? 'bg-flame-500/15 text-flame-300 ring-1 ring-flame-500/40' : 'bg-white/[0.03] text-steel-600')}
                        >
                          {INFO[mon].simbolo}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {nuevoMetodo && <NuevoMetodo onClose={() => setNuevoMetodo(false)} onDone={recargar} />}
    </div>
  );
}

function NuevoMetodo({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [nombre, setNombre] = useState('');
  const [monedas, setMonedas] = useState<Moneda[]>(['COP']);
  const [ref, setRef] = useState(true);
  const m = useMutation({
    mutationFn: () => api('/config/metodos', { body: { nombre, monedas, pideReferencia: ref } }),
    onSuccess: () => (toast.success(`Método ${nombre} creado`), onDone(), onClose()),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal
      title="Nuevo método de pago"
      size="sm"
      onClose={onClose}
      footer={
        <button className="btn-primary" disabled={nombre.trim().length < 2 || !monedas.length || m.isPending} onClick={() => m.mutate()}>
          Crear
        </button>
      }
    >
      <Field label="Nombre">
        <input className="input" autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Daviplata, Zinli, Banesco Panamá…" />
      </Field>
      <p className="label mt-4">Monedas que recibe</p>
      <div className="flex gap-2">
        {MONEDAS.map((mon) => (
          <button
            key={mon}
            onClick={() => setMonedas((x) => (x.includes(mon) ? x.filter((y) => y !== mon) : [...x, mon]))}
            className={cx('rounded-lg px-3 py-1.5 text-sm font-bold', monedas.includes(mon) ? 'bg-flame-500/15 text-flame-300 ring-1 ring-flame-500/40' : 'bg-white/[0.03] text-steel-500')}
          >
            {INFO[mon].nombre}
          </button>
        ))}
      </div>
      <div className="mt-3">
        <Toggle checked={ref} onChange={setRef} label="Pedir número de referencia al cobrar" />
      </div>
    </Modal>
  );
}

function CategoriasEditor({ valor, onGuardar }: { valor: Config['categorias']; onGuardar: (c: Config['categorias']) => void }) {
  const [c, setC] = useState(valor);
  const [nueva, setNueva] = useState({ egreso: '', ingreso: '' });
  useEffect(() => setC(valor), [valor]);
  const lado = (t: 'egreso' | 'ingreso', titulo: string) => (
    <div>
      <p className="label">{titulo}</p>
      <div className="flex flex-wrap gap-1.5">
        {c[t].map((x) => (
          <span key={x} className="chip border-white/10 py-1 text-steel-300">
            {x}
            <button onClick={() => setC({ ...c, [t]: c[t].filter((y) => y !== x) })} className="text-steel-500 hover:text-bad">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input className="input h-9" placeholder="Nueva categoría" value={nueva[t]} onChange={(e) => setNueva({ ...nueva, [t]: e.target.value })} />
        <button
          className="btn-ghost btn-sm"
          disabled={nueva[t].trim().length < 2}
          onClick={() => {
            setC({ ...c, [t]: [...c[t], nueva[t].trim()] });
            setNueva({ ...nueva, [t]: '' });
          }}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
  return (
    <div className="card p-6">
      <p className="mb-4 font-display text-lg font-extrabold text-white">Categorías de caja</p>
      <div className="space-y-5">
        {lado('egreso', 'Gastos')}
        {lado('ingreso', 'Ingresos')}
      </div>
      <div className="mt-4 flex justify-end">
        <button className="btn-primary" onClick={() => onGuardar(c)}>
          Guardar categorías
        </button>
      </div>
    </div>
  );
}
