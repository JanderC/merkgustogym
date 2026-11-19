import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Catalogo, TurnoCiego } from './types';

export const useTurno = () =>
  useQuery({
    queryKey: ['turno'],
    queryFn: () => api<TurnoCiego | null>('/pos/turno'),
    refetchInterval: 30_000,
  });

export const useCatalogo = () =>
  useQuery({
    queryKey: ['catalogo'],
    queryFn: () => api<Catalogo>('/pos/catalogo'),
    staleTime: 60_000,
  });

export interface EstadoIntegraciones {
  wa: { estado: 'apagado' | 'conectando' | 'qr' | 'conectado' } | null;
  bio: { mode: string; online: boolean } | null;
}

export const useIntegraciones = (enabled: boolean) =>
  useQuery({
    queryKey: ['integraciones'],
    enabled,
    refetchInterval: 20_000,
    queryFn: async (): Promise<EstadoIntegraciones> => {
      const [wa, bio] = await Promise.all([
        api<EstadoIntegraciones['wa']>('/whatsapp/estado').catch(() => null),
        api<EstadoIntegraciones['bio']>('/biometric/status').catch(() => null),
      ]);
      return { wa, bio };
    },
  });
