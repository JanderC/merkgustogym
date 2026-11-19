import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Link2, Link2Off, MessageCircle, Send, Smartphone, Sparkles } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { cx, Field, Loading, PageHeader, Toggle } from '../../components/ui';
import { api } from '../../lib/api';
import { hora } from '../../lib/format';

interface Estado {
  estado: 'apagado' | 'conectando' | 'qr' | 'conectado';
  qr: string | null;
  telefono: string | null;
  ultimoError: string | null;
  habilitado: boolean;
  ia: boolean;
}
interface WaConfig {
  botActivo: boolean;
  numeroDueno: string;
  horaReporte: string;
  reporteDiario: boolean;
  avisoCierre: boolean;
  recordatorioVencimiento: boolean;
  diasRecordatorio: number;
  recordatorioClases: boolean;
  horasAntesClase: number;
  infoExtra: string;
}
interface Mensaje {
  id: number;
  direccion: 'entrante' | 'saliente';
  jid: string;
  nombre: string | null;
  texto: string;
  tipo: string;
  creadoEn: string;
}

/** Formato de WhatsApp: *negrita* y _cursiva_. */
function WaTexto({ texto }: { texto: string }) {
  const partes: ReactNode[] = [];
  texto.split('\n').forEach((linea, i) => {
    const html = linea.split(/(\*[^*]+\*|_[^_]+_)/g).map((p, j) =>
      p.startsWith('*') && p.endsWith('*') && p.length > 2 ? <b key={j}>{p.slice(1, -1)}</b> : p.startsWith('_') && p.endsWith('_') && p.length > 2 ? <i key={j}>{p.slice(1, -1)}</i> : p,
    );
    partes.push(
      <span key={i} className="block min-h-[1em]">
        {html}
      </span>,
    );
  });
  return <>{partes}</>;
}

export default function WhatsApp() {
  const qc = useQueryClient();
  const { data: est } = useQuery({ queryKey: ['wa-estado'], queryFn: () => api<Estado>('/whatsapp/estado'), refetchInterval: (q) => (q.state.data?.estado === 'conectado' ? 15000 : 2500) });
  const { data: cfgAll } = useQuery({ queryKey: ['config'], queryFn: () => api<{ whatsapp: WaConfig }>('/config') });
  const { data: preview, refetch: recargarPreview } = useQuery({ queryKey: ['wa-preview'], queryFn: () => api<{ texto: string }>('/whatsapp/reporte/preview') });
  const { data: mensajes } = useQuery({ queryKey: ['wa-mensajes'], queryFn: () => api<Mensaje[]>('/whatsapp/mensajes'), refetchInterval: 8000 });
  const [cfg, setCfg] = useState<WaConfig | null>(null);
  useEffect(() => {
    if (cfgAll && !cfg) setCfg(cfgAll.whatsapp);
  }, [cfgAll, cfg]);

  const accion = (path: string, ok: string) => ({
    mutationFn: () => api(path, { body: {} }),
    onSuccess: () => {
      toast.success(ok);
      void qc.invalidateQueries({ queryKey: ['wa-estado'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const conectar = useMutation(accion('/whatsapp/conectar', 'Generando código QR…'));
  const desconectar = useMutation(accion('/whatsapp/desconectar', 'WhatsApp desvinculado'));
  const enviar = useMutation(accion('/whatsapp/reporte/enviar', 'Reporte enviado a tu WhatsApp'));
  const guardar = useMutation({
    mutationFn: () => api('/config/whatsapp', { method: 'PUT', body: cfg }),
    onSuccess: () => {
      toast.success('Automatización guardada');
      void qc.invalidateQueries({ queryKey: ['config'] });
      void recargarPreview();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!est || !cfg) return <Loading />;
  const set = <K extends keyof WaConfig>(k: K, v: WaConfig[K]) => setCfg({ ...cfg, [k]: v });

  return (
    <div>
      <PageHeader title="WhatsApp" kicker="Automatización">
        Responde solo a los clientes y te manda cada cierre de caja y el reporte del día.
      </PageHeader>
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          {/* Conexión */}
          <div className="plate p-6 pt-8">
            <div className="flex items-start gap-5">
              <div className={cx('grid h-14 w-14 shrink-0 place-items-center rounded-2xl', est.estado === 'conectado' ? 'bg-ok/15 text-ok' : 'bg-white/[0.04] text-steel-500')}>
                <Smartphone className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <p className="font-wide text-xl text-white">
                  {est.estado === 'conectado' ? 'Conectado' : est.estado === 'qr' ? 'Escanea el código' : est.estado === 'conectando' ? 'Conectando…' : 'Desconectado'}
                </p>
                <p className="text-sm text-steel-400">
                  {est.estado === 'conectado'
                    ? `Número +${est.telefono}`
                    : est.estado === 'qr'
                      ? 'WhatsApp → Dispositivos vinculados → Vincular un dispositivo'
                      : (est.ultimoError ?? 'Vincula el WhatsApp del gimnasio para empezar')}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-steel-500">
                  <Sparkles className="h-3.5 w-3.5 text-flame-500" /> {est.ia ? 'Respuestas con IA (Groq)' : 'Respuestas automáticas por palabras clave · agrega GROQ_API_KEY para IA'}
                </p>
              </div>
              {est.estado === 'conectado' || est.estado === 'qr' ? (
                <button className="btn-ghost btn-sm" onClick={() => desconectar.mutate()}>
                  <Link2Off className="h-4 w-4" /> Desvincular
                </button>
              ) : (
                <button className="btn-primary btn-sm" disabled={!est.habilitado || conectar.isPending || est.estado === 'conectando'} onClick={() => conectar.mutate()}>
                  <Link2 className="h-4 w-4" /> Conectar
                </button>
              )}
            </div>
            {est.estado === 'qr' && est.qr && (
              <div className="mt-6 flex justify-center">
                <img src={est.qr} alt="QR de WhatsApp" className="w-64 rounded-2xl bg-white p-3" />
              </div>
            )}
          </div>

          {/* Automatización */}
          <div className="card p-6">
            <p className="mb-4 font-display text-lg font-extrabold text-white">Qué hace solo</p>
            <Field label="Tu WhatsApp (dueño)" hint="Aquí llegan cierres y reportes. Desde este número puedes escribir “reporte” para recibirlo al instante.">
              <input className="input" value={cfg.numeroDueno} onChange={(e) => set('numeroDueno', e.target.value)} placeholder="0414-1234567" />
            </Field>
            <div className="mt-3 divide-y divide-white/[0.04]">
              <Toggle checked={cfg.botActivo} onChange={(v) => set('botActivo', v)} label="Responder a los clientes" hint="Precios, horarios, ubicación y vencimiento de su plan" />
              <Toggle checked={cfg.avisoCierre} onChange={(v) => set('avisoCierre', v)} label="Avisarme cada cierre de caja" hint="Con lo esperado, lo entregado y la diferencia" />
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Toggle checked={cfg.reporteDiario} onChange={(v) => set('reporteDiario', v)} label="Reporte diario" hint="Personas que entraron, ventas y cierres" />
                </div>
                <input type="time" className="input w-40" value={cfg.horaReporte} onChange={(e) => set('horaReporte', e.target.value)} />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Toggle checked={cfg.recordatorioVencimiento} onChange={(v) => set('recordatorioVencimiento', v)} label="Recordar vencimientos a los clientes" hint="Un mensaje amable días antes de que venza su plan" />
                </div>
                <select className="input w-44" value={cfg.diasRecordatorio} onChange={(e) => set('diasRecordatorio', Number(e.target.value))}>
                  {[0, 1, 2, 3, 5, 7].map((d) => (
                    <option key={d} value={d}>
                      {d === 0 ? 'El mismo día' : `${d} día(s) antes`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Toggle
                    checked={cfg.recordatorioClases ?? true}
                    onChange={(v) => set('recordatorioClases', v)}
                    label="Recordar las clases a los inscritos"
                    hint="CrossFit, funcional, bailoterapia… con hora, entrenador y qué se trabaja. Las de antes de las 9 AM se recuerdan la noche anterior. Si se cancela, se les avisa."
                  />
                </div>
                <select className="input w-44" value={cfg.horasAntesClase ?? 3} onChange={(e) => set('horasAntesClase', Number(e.target.value))}>
                  {[1, 2, 3, 4, 6, 12, 24].map((h) => (
                    <option key={h} value={h}>
                      {h} hora(s) antes
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Field label="Lo que el asistente debe saber" className="mt-4" hint="Promociones vigentes, clases, servicios, reglas… Los precios se toman solos de tus planes.">
              <textarea className="input" rows={4} value={cfg.infoExtra} onChange={(e) => set('infoExtra', e.target.value)} placeholder="Ej. Clases de spinning lunes y miércoles 7 PM. Estacionamiento gratis. Inscripción sin costo este mes." />
            </Field>
            <div className="mt-4 flex justify-end">
              <button className="btn-primary" disabled={guardar.isPending} onClick={() => guardar.mutate()}>
                Guardar
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Vista previa */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <p className="font-display font-extrabold text-white">Así te llega el reporte de hoy</p>
              <button className="btn-primary btn-sm" disabled={est.estado !== 'conectado' || !cfg.numeroDueno || enviar.isPending} onClick={() => enviar.mutate()}>
                <Send className="h-4 w-4" /> Enviar ahora
              </button>
            </div>
            <div className="bg-[#0B141A] p-5" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.03) 1px, transparent 1px)', backgroundSize: '18px 18px' }}>
              <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-sm bg-[#005C4B] px-4 py-3 text-[14px] leading-relaxed text-[#E9EDEF] shadow">
                {preview ? <WaTexto texto={preview.texto} /> : '…'}
                <p className="mt-1 text-right text-[11px] text-white/50">{cfg.horaReporte} ✓✓</p>
              </div>
            </div>
          </div>

          {/* Conversaciones */}
          <div className="card overflow-hidden">
            <div className="border-b border-white/[0.06] px-5 py-4">
              <p className="font-display font-extrabold text-white">Últimos mensajes</p>
            </div>
            <div className="max-h-[480px] space-y-2 overflow-y-auto p-4">
              {!mensajes?.length && <p className="py-8 text-center text-sm text-steel-500">Aún no hay mensajes.</p>}
              {mensajes?.map((m) => (
                <div key={m.id} className={cx('flex', m.direccion === 'saliente' ? 'justify-end' : 'justify-start')}>
                  <div className={cx('max-w-[85%] rounded-2xl px-3.5 py-2 text-sm', m.direccion === 'saliente' ? 'rounded-tr-sm bg-flame-500/15 text-steel-100' : 'rounded-tl-sm bg-white/[0.05] text-steel-200')}>
                    <p className="mb-0.5 flex items-center gap-1.5 text-[11px] font-bold text-steel-500">
                      {m.direccion === 'saliente' ? m.tipo === 'bot' ? <Bot className="h-3 w-3" /> : <Send className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />}
                      {m.direccion === 'entrante' ? (m.nombre ?? m.jid.split('@')[0]) : m.tipo === 'bot' ? 'Asistente' : m.tipo === 'reporte' ? 'Reporte' : m.tipo === 'aviso' ? 'Recordatorio' : 'Enviado'}
                      <span className="font-normal">· {hora(m.creadoEn)}</span>
                    </p>
                    <div className="line-clamp-6 whitespace-pre-wrap">{m.texto}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
