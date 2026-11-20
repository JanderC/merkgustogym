/**
 * Enlace personal del cliente (lo envía su entrenador o la recepción por WhatsApp).
 * Abre su app sin pedir clave: sirve aunque la haya olvidado, y desde Cuenta puede crear una nueva.
 */
import { useQuery } from '@tanstack/react-query';
import { Flame } from 'lucide-react';
import { Navigate, useParams } from 'react-router-dom';
import { api, sesionCliente } from '../lib/api';

export default function Portal() {
  const { token = '' } = useParams();
  const { data, error } = useQuery({
    queryKey: ['enlace', token],
    queryFn: async () => {
      const r = await api<{ token: string; nombre: string }>('/cliente/enlace', { token: null, body: { token } });
      sesionCliente.save(r.token, { nombre: r.nombre });
      return r;
    },
    retry: false,
    staleTime: Infinity,
  });

  if (data) return <Navigate to="/cliente/app" replace />;
  if (error) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <img src="/logo-merkgusto.png" alt="" className="mx-auto mb-6 h-16 w-auto opacity-80" />
          <p className="font-wide text-xl text-white">Enlace no disponible</p>
          <p className="mx-auto mt-2 max-w-xs text-steel-400">{(error as Error).message}</p>
          <a href="/cliente" className="btn-primary mt-6 inline-flex">
            Entrar con mi cédula
          </a>
        </div>
      </div>
    );
  }
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <Flame className="h-10 w-10 animate-pulse text-flame-500" />
    </div>
  );
}
