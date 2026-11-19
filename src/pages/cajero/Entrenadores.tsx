import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Dumbbell, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { EntrenadorEditor, EquipoEntrenadores } from '../../components/EntrenadorGestion';
import { MarcarModal, PermisoModal, TarjetaEntrenador } from '../../components/entrenadores';
import { Empty, Loading, PageHeader, Tabs } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { EntrenadorHoy } from '../../lib/types';

/**
 * Recepción: cada entrenador marca su entrada, salida, retiro o regreso (kiosko).
 * El administrador (dueño / admin de caja) además los registra y gestiona aquí mismo.
 */
export default function EntrenadoresKiosko() {
  const { user } = useAuth();
  const gestion = user?.rol === 'dueno' || user?.rol === 'admin_caja';
  const { data, isLoading } = useQuery({ queryKey: ['entrenadores-hoy'], queryFn: () => api<EntrenadorHoy[]>('/entrenadores/hoy'), refetchInterval: 15_000 });
  const [sel, setSel] = useState<EntrenadorHoy | null>(null);
  const [permiso, setPermiso] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const [vista, setVista] = useState<'kiosko' | 'gestion'>('kiosko');
  const presentes = (data ?? []).filter((e) => e.estado === 'presente').length;
  return (
    <div>
      <PageHeader
        title="Entrenadores"
        kicker={`${presentes} en el gym ahora`}
        actions={
          <div className="flex gap-2">
            {vista === 'kiosko' && (
              <button className="btn-ghost" onClick={() => setPermiso(true)} disabled={!data?.length}>
                <CalendarClock className="h-4 w-4" /> Solicitar permiso
              </button>
            )}
            {gestion && vista === 'kiosko' && (
              <button className="btn-primary" onClick={() => setNuevo(true)}>
                <UserPlus className="h-4 w-4" /> Nuevo entrenador
              </button>
            )}
          </div>
        }
      >
        {vista === 'kiosko' ? 'Toca tu tarjeta, elige qué marcas, escribe tu PIN y deja que el lector tome tu foto.' : 'Registra, edita, marca a mano, da permisos y envía rostros al lector.'}
      </PageHeader>

      {gestion && (
        <div className="mb-5">
          <Tabs
            value={vista}
            onChange={setVista}
            items={[
              { value: 'kiosko', label: 'Marcar (kiosko)' },
              { value: 'gestion', label: 'Gestionar entrenadores' },
            ]}
          />
        </div>
      )}

      {vista === 'gestion' && gestion ? (
        <EquipoEntrenadores />
      ) : isLoading ? (
        <Loading />
      ) : !data?.length ? (
        gestion ? (
          <div className="plate flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-flame-500/10 text-flame-500">
              <Dumbbell className="h-8 w-8" />
            </div>
            <p className="font-wide text-xl text-white">Todavía no hay entrenadores</p>
            <p className="mt-2 max-w-md text-sm text-steel-400">Regístralos aquí: datos, PIN para marcar, horario y rostro para el lector.</p>
            <button className="btn-primary btn-xl mt-6" onClick={() => setNuevo(true)}>
              <UserPlus className="h-5 w-5" /> Nuevo entrenador
            </button>
          </div>
        ) : (
          <Empty icon={<Dumbbell className="h-7 w-7" />} title="No hay entrenadores registrados" hint="Pídele al administrador que los registre." />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((e) => (
            <TarjetaEntrenador key={e.id} e={e} onClick={() => setSel(e)} />
          ))}
        </div>
      )}
      {sel && <MarcarModal e={sel} onClose={() => setSel(null)} />}
      {permiso && data && <PermisoModal entrenadores={data} onClose={() => setPermiso(false)} />}
      {nuevo && <EntrenadorEditor e={null} onClose={() => setNuevo(false)} />}
    </div>
  );
}
