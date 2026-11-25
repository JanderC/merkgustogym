import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Camera, Check, FileText, ScanFace, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EquipoEntrenadores, tipoCls, type FilaReporte, type Marcacion, type Permiso } from '../../components/EntrenadorGestion';
import { NominaEntrenadores } from '../../components/NominaEntrenadores';
import { cx, Empty, Field, Loading, Modal, PageHeader, Tabs } from '../../components/ui';
import { Paginacion, Th, useTabla } from '../../components/Tabla';
import { api } from '../../lib/api';
import { fecha, fechaHora, hoyISO, sumarDias } from '../../lib/format';
import { archivoUrl } from './Cierres';

export default function EntrenadoresAdmin() {
  const [tab, setTab] = useState<'equipo' | 'marcaciones' | 'permisos' | 'reporte' | 'pagos'>('equipo');
  const { data: pendientes } = useQuery({ queryKey: ['permisos', 'pendiente'], queryFn: () => api<Permiso[]>('/entrenadores/permisos', { query: { estado: 'pendiente' } }), refetchInterval: 30_000 });
  return (
    <div>
      <PageHeader title="Entrenadores" kicker="Personal">
        Regístralos aquí mismo. Entradas, salidas, retiros y permisos con foto; tardanzas, horas y su pago según el horario y las clases de cada uno.
      </PageHeader>
      <div className="mb-5 overflow-x-auto">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'equipo', label: 'Equipo y hoy' },
            { value: 'marcaciones', label: 'Marcaciones' },
            { value: 'permisos', label: `Permisos${pendientes?.length ? ` (${pendientes.length})` : ''}` },
            { value: 'reporte', label: 'Reporte' },
            { value: 'pagos', label: 'Pagos' },
          ]}
        />
      </div>
      {tab === 'equipo' && <EquipoEntrenadores />}
      {tab === 'marcaciones' && <Marcaciones />}
      {tab === 'permisos' && <Permisos />}
      {tab === 'reporte' && <Reporte />}
      {tab === 'pagos' && <NominaEntrenadores />}
    </div>
  );
}

function Marcaciones() {
  const qc = useQueryClient();
  const [desde, setDesde] = useState(sumarDias(hoyISO(), -6));
  const [hasta, setHasta] = useState(hoyISO());
  const [foto, setFoto] = useState<number | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['marcaciones', desde, hasta], queryFn: () => api<Marcacion[]>('/entrenadores/marcaciones', { query: { desde, hasta } }) });
  const t = useTabla(
    data,
    {
      entrenador: { label: 'Entrenador', valor: (m) => m.entrenador },
      tipo: { label: 'Marcó', valor: (m) => m.tipo },
      cuando: { label: 'Cuándo', valor: (m) => m.fechaHora },
      origen: { label: 'Detalle', valor: (m) => m.origen },
    },
    { id: 'marcaciones', orden: { col: 'cuando', dir: 'desc' } },
  );
  const anular = useMutation({
    mutationFn: (id: number) => api(`/entrenadores/marcaciones/${id}/anular`, { body: {} }),
    onSuccess: () => (toast.success('Marcación anulada'), void qc.invalidateQueries({ queryKey: ['marcaciones'] })),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div>
      <div className="mb-4 flex gap-3">
        <Field label="Desde">
          <input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </Field>
        <Field label="Hasta">
          <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </Field>
      </div>
      <div className="card overflow-x-auto">
        {isLoading ? (
          <Loading />
        ) : !data?.length ? (
          <Empty icon={<Camera className="h-7 w-7" />} title="Sin marcaciones" />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Foto</th>
                <th><Th t={t} col="entrenador" /></th>
                <th><Th t={t} col="tipo" /></th>
                <th><Th t={t} col="cuando" /></th>
                <th><Th t={t} col="origen" /></th>
                <th />
              </tr>
            </thead>
            <tbody>
              {t.visibles.map((m) => (
                <tr key={m.id} className={cx(m.anulada && 'opacity-40 line-through')}>
                  <td>
                    {m.fotoId ? (
                      <button onClick={() => setFoto(m.fotoId)}>
                        <img src={archivoUrl(m.fotoId)} alt="" className="h-12 w-12 rounded-xl object-cover" />
                      </button>
                    ) : (
                      <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/[0.03] text-steel-600">{m.origen === 'lector' ? <ScanFace className="h-5 w-5" /> : '—'}</span>
                    )}
                  </td>
                  <td className="font-bold text-steel-100">{m.entrenador}</td>
                  <td className={cx('font-bold capitalize', tipoCls[m.tipo])}>{m.tipo}</td>
                  <td className="text-steel-400">{fechaHora(m.fechaHora)}</td>
                  <td className="text-xs text-steel-400">
                    {m.origen === 'lector' ? 'Lector facial' : m.origen === 'manual' ? `Manual · ${m.registradoPor ?? ''}` : 'Kiosko'}
                    {m.nota && <span className="block text-steel-300">“{m.nota}”</span>}
                    {(m.minutosTarde ?? 0) > 5 && <span className="block text-warn">{m.minutosTarde} min tarde</span>}
                    {(m.minutosTarde ?? 0) < -5 && <span className="block text-warn">salió {-(m.minutosTarde ?? 0)} min antes</span>}
                  </td>
                  <td className="text-right">
                    {!m.anulada && (
                      <button className="rounded-lg p-1.5 text-steel-500 hover:bg-bad/10 hover:text-bad" title="Anular" onClick={() => anular.mutate(m.id)}>
                        <Ban className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Paginacion t={t} />
      </div>
      {foto && (
        <Modal title="Foto de la marcación" size="sm" onClose={() => setFoto(null)}>
          <img src={archivoUrl(foto)} alt="" className="w-full rounded-2xl" />
        </Modal>
      )}
    </div>
  );
}

function Permisos() {
  const qc = useQueryClient();
  const [estado, setEstado] = useState<'pendiente' | 'todos'>('pendiente');
  const { data, isLoading } = useQuery({ queryKey: ['permisos', estado], queryFn: () => api<Permiso[]>('/entrenadores/permisos', { query: { estado } }) });
  const t = useTabla(
    data,
    {
      desde: { label: 'Fecha', valor: (p) => p.desde },
      entrenador: { label: 'Entrenador', valor: (p) => p.entrenador },
      tipo: { label: 'Tipo', valor: (p) => p.tipo },
      estado: { label: 'Estado', valor: (p) => p.estado },
    },
    { id: 'permisos', orden: { col: 'desde', dir: 'desc' }, porPagina: 10 },
  );
  const resolver = useMutation({
    mutationFn: (a: { id: number; estado: 'aprobado' | 'rechazado' }) => api(`/entrenadores/permisos/${a.id}/resolver`, { body: { estado: a.estado } }),
    onSuccess: (_r, a) => (toast.success(a.estado === 'aprobado' ? 'Permiso aprobado' : 'Permiso rechazado'), void qc.invalidateQueries({ queryKey: ['permisos'] })),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div>
      <div className="mb-4">
        <Tabs
          value={estado}
          onChange={setEstado}
          items={[
            { value: 'pendiente', label: 'Pendientes' },
            { value: 'todos', label: 'Todos' },
          ]}
        />
      </div>
      {isLoading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty icon={<FileText className="h-7 w-7" />} title="No hay permisos" />
      ) : (
        <>
        <div className="grid gap-4 md:grid-cols-2">
          {t.visibles.map((p) => (
            <div key={p.id} className="plate p-5 pt-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-extrabold text-white">{p.entrenador}</p>
                  <p className="text-xs uppercase tracking-wider text-flame-400">{p.tipo}</p>
                </div>
                <span className={cx('chip', p.estado === 'pendiente' ? 'border-warn/30 text-warn' : p.estado === 'aprobado' ? 'border-ok/30 text-ok' : 'border-bad/30 text-bad')}>{p.estado}</span>
              </div>
              <p className="mt-3 text-sm text-steel-300">
                {fechaHora(p.desde)} → {fechaHora(p.hasta)}
              </p>
              <p className="mt-2 text-sm text-steel-400">“{p.motivo}”</p>
              {p.soporteId && (
                <a href={archivoUrl(p.soporteId)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-flame-400">
                  <FileText className="h-4 w-4" /> Ver soporte
                </a>
              )}
              {p.estado === 'pendiente' ? (
                <div className="mt-4 flex gap-2">
                  <button className="btn-ok btn-sm flex-1" onClick={() => resolver.mutate({ id: p.id, estado: 'aprobado' })}>
                    <Check className="h-4 w-4" /> Aprobar
                  </button>
                  <button className="btn-danger btn-sm flex-1" onClick={() => resolver.mutate({ id: p.id, estado: 'rechazado' })}>
                    <X className="h-4 w-4" /> Rechazar
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-xs text-steel-500">
                  {p.resueltoPor} · {fechaHora(p.resueltoEn)}
                </p>
              )}
            </div>
          ))}
        </div>
        <Paginacion t={t} className="card mt-4" />
        </>
      )}
    </div>
  );
}

function Reporte() {
  const [desde, setDesde] = useState(hoyISO().slice(0, 8) + '01');
  const [hasta, setHasta] = useState(hoyISO());
  const { data, isLoading } = useQuery({ queryKey: ['reporte-ent', desde, hasta], queryFn: () => api<FilaReporte[]>('/entrenadores/reporte', { query: { desde, hasta } }) });
  const t = useTabla(
    data,
    {
      nombre: { label: 'Entrenador', valor: (r) => r.nombre },
      dias: { label: 'Días', valor: (r) => r.diasTrabajados },
      horas: { label: 'Horas', valor: (r) => r.horas },
      tardanzas: { label: 'Tardanzas', valor: (r) => r.tardanzas },
      salidas: { label: 'Salidas antes', valor: (r) => r.salidasTempranas },
      retiros: { label: 'Retiros', valor: (r) => r.retiros },
      permisos: { label: 'Permisos', valor: (r) => r.diasPermiso },
      ausencias: { label: 'Ausencias', valor: (r) => r.ausencias },
    },
    { id: 'reporte-entrenadores', orden: { col: 'nombre', dir: 'asc' } },
  );
  return (
    <div>
      <div className="mb-4 flex gap-3">
        <Field label="Desde">
          <input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </Field>
        <Field label="Hasta">
          <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </Field>
      </div>
      <div className="card overflow-x-auto">
        {isLoading ? (
          <Loading />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th><Th t={t} col="nombre" /></th>
                <th className="text-right"><Th t={t} col="dias" /></th>
                <th className="text-right"><Th t={t} col="horas" /></th>
                <th className="text-right"><Th t={t} col="tardanzas" /></th>
                <th className="text-right"><Th t={t} col="salidas" /></th>
                <th className="text-right"><Th t={t} col="retiros" /></th>
                <th className="text-right"><Th t={t} col="permisos" /></th>
                <th className="text-right"><Th t={t} col="ausencias" /></th>
              </tr>
            </thead>
            <tbody>
              {t.visibles.map((r) => (
                <tr key={r.id}>
                  <td className="font-bold text-steel-100">{r.nombre}</td>
                  <td className="tnum text-right">{r.diasTrabajados}</td>
                  <td className="tnum text-right font-bold text-white">{r.horas}</td>
                  <td className={cx('tnum text-right', r.tardanzas ? 'text-warn' : 'text-steel-500')}>
                    {r.tardanzas}
                    {r.minutosTarde > 0 && <span className="block text-[11px]">{r.minutosTarde} min</span>}
                  </td>
                  <td className={cx('tnum text-right', r.salidasTempranas ? 'text-warn' : 'text-steel-500')}>{r.salidasTempranas}</td>
                  <td className="tnum text-right text-steel-300">{r.retiros}</td>
                  <td className="tnum text-right text-sky-300">{r.diasPermiso}</td>
                  <td className={cx('tnum text-right', r.ausencias ? 'font-bold text-bad' : 'text-steel-500')} title={r.fechasAusencia.map((f) => fecha(f)).join(', ')}>
                    {r.ausencias}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Paginacion t={t} />
      </div>
    </div>
  );
}
