import { Search, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClienteNuevo } from '../../components/ClienteNuevo';
import { Paginacion, Th, useTabla } from '../../components/Tabla';
import { SocioDrawer, useBuscarSocios } from '../../components/socios';
import { Avatar, BioBadge, Empty, Loading, PageHeader, Tabs, VigenciaBadge } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { fecha, hace } from '../../lib/format';

type Filtro = 'todos' | 'vigentes' | 'por_vencer' | 'vencidos' | 'sin_rostro' | 'inactivos';

export default function SociosPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const { data, isLoading } = useBuscarSocios(texto, filtro, 5000);
  const t = useTabla(
    data,
    {
      nombre: { label: 'Cliente', valor: (s) => `${s.nombre} ${s.apellido}` },
      codigo: { label: 'Código', valor: (s) => s.codigo },
      plan: { label: 'Plan', valor: (s) => s.plan },
      vence: { label: 'Vence', valor: (s) => s.vence },
      lector: { label: 'Lector', valor: (s) => s.bioEstado },
      visita: { label: 'Última visita', valor: (s) => s.ultimaVisita },
    },
    { id: 'clientes', orden: { col: 'nombre', dir: 'asc' } },
  );

  const filtros: Array<{ value: Filtro; label: string }> = [
    { value: 'todos', label: 'Todos' },
    { value: 'vigentes', label: 'Al día' },
    { value: 'por_vencer', label: 'Por vencer' },
    { value: 'vencidos', label: 'Vencidos' },
    { value: 'sin_rostro', label: 'Sin rostro' },
    ...(user?.rol === 'dueno' ? [{ value: 'inactivos' as Filtro, label: 'Inactivos' }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Clientes"
        kicker="Comunidad"
        actions={
          <button className="btn-primary" onClick={() => setNuevo(true)}>
            <UserPlus className="h-4 w-4" /> Nuevo cliente
          </button>
        }
      />
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
          <input className="input pl-11" placeholder="Nombre, cédula, teléfono o código" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <Tabs value={filtro} onChange={setFiltro} items={filtros} />
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <Loading />
        ) : !data?.length ? (
          <Empty icon={<Users className="h-7 w-7" />} title="No hay clientes aquí" hint={texto ? 'Prueba con otra búsqueda.' : 'Registra al primero con su foto para el lector facial.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>
                    <Th t={t} col="nombre" />
                  </th>
                  <th>
                    <Th t={t} col="plan" />
                  </th>
                  <th>
                    <Th t={t} col="vence">Estado</Th>
                  </th>
                  <th className="hidden md:table-cell">
                    <Th t={t} col="lector" />
                  </th>
                  <th className="hidden lg:table-cell">
                    <Th t={t} col="visita" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {t.visibles.map((s) => (
                  <tr key={s.id} className="cursor-pointer" onClick={() => setAbierto(s.id)}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar socioId={s.id} nombre={`${s.nombre} ${s.apellido}`} tieneFoto={s.tieneFoto} size={38} />
                        <div>
                          <p className="font-bold text-steel-100">
                            {s.nombre} {s.apellido}
                          </p>
                          <p className="text-xs text-steel-500">
                            #{s.codigo} {s.telefono && `· ${s.telefono}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p className="text-steel-200">{s.plan ?? '—'}</p>
                      {s.vence && <p className="text-xs text-steel-500">hasta {fecha(s.vence)}</p>}
                    </td>
                    <td>
                      <VigenciaBadge vence={s.vence} activo={s.activo} />
                    </td>
                    <td className="hidden md:table-cell">
                      <BioBadge estado={s.bioEstado} />
                    </td>
                    <td className="hidden text-steel-400 lg:table-cell">{hace(s.ultimaVisita)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Paginacion t={t} />
          </div>
        )}
      </div>
      {abierto && <SocioDrawer socioId={abierto} onClose={() => setAbierto(null)} onCobrar={(s) => nav(`/mostrador?cliente=${s.id}`)} />}
      {nuevo && <ClienteNuevo onClose={() => setNuevo(false)} />}
    </div>
  );
}
