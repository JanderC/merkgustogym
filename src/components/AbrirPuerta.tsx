import { useMutation } from '@tanstack/react-query';
import { DoorOpen } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { Field, Modal } from './ui';

/** Apertura manual de la puerta: siempre con motivo (queda en auditoría con quién la hizo). */
export function AbrirPuerta() {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const cerrar = () => {
    setAbierto(false);
    setMotivo('');
  };
  const abrir = useMutation({
    mutationFn: () => api('/lector/abrir-puerta', { body: { motivo } }),
    onSuccess: () => {
      toast.success('Puerta abierta');
      cerrar();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <button className="btn-ghost btn-sm" onClick={() => setAbierto(true)}>
        <DoorOpen className="h-4 w-4" /> Abrir puerta
      </button>
      {abierto && (
        <Modal
          title="Abrir puerta"
          size="sm"
          onClose={cerrar}
          footer={
            <button className="btn-primary" disabled={motivo.trim().length < 4 || abrir.isPending} onClick={() => abrir.mutate()}>
              <DoorOpen className="h-4 w-4" /> Abrir
            </button>
          }
        >
          <Field label="Motivo" hint="Queda registrado con tu usuario">
            <input className="input" autoFocus maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. visita del técnico" />
          </Field>
        </Modal>
      )}
    </>
  );
}
