import { useMutation } from '@tanstack/react-query';
import { DoorOpen } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { Field, Modal } from './ui';

/** Motivos de un toque: abren al instante, sin escribir ni registrar al cliente. */
const RAPIDOS = ['Rutina', 'Visita', 'Proveedor o técnico', 'Personal del gimnasio'];

/** Apertura manual de la puerta: siempre con motivo (queda en auditoría con quién la hizo). */
export function AbrirPuerta() {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const cerrar = () => {
    setAbierto(false);
    setMotivo('');
  };
  const abrir = useMutation({
    mutationFn: (m: string) => api('/lector/abrir-puerta', { body: { motivo: m } }),
    onSuccess: (_r, m) => {
      toast.success(`Puerta abierta · ${m}`);
      cerrar();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <button className="btn-ghost btn-sm" onClick={() => setAbierto(true)}>
        <DoorOpen className="h-4 w-4 text-flame-400" /> Abrir puerta
      </button>
      {abierto && (
        <Modal
          title="Abrir puerta"
          size="sm"
          onClose={cerrar}
          footer={
            <button className="btn-ghost" disabled={motivo.trim().length < 4 || abrir.isPending} onClick={() => abrir.mutate(motivo.trim())}>
              <DoorOpen className="h-4 w-4" /> Abrir con este motivo
            </button>
          }
        >
          <p className="label">Toca el motivo y abre al instante</p>
          <div className="grid grid-cols-2 gap-2">
            {RAPIDOS.map((m) => (
              <button key={m} className={m === 'Rutina' ? 'btn-primary btn-xl col-span-2' : 'btn-ghost'} disabled={abrir.isPending} onClick={() => abrir.mutate(m)}>
                {m === 'Rutina' && <DoorOpen className="h-5 w-5" />} {m}
              </button>
            ))}
          </div>
          <Field label="Otro motivo" hint="Queda registrado con tu usuario" className="mt-5">
            <input className="input" maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. cliente olvidó su rostro" />
          </Field>
        </Modal>
      )}
    </>
  );
}
