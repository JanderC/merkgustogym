import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, ShieldCheck, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Avatar, cx, Field, Loading, Modal, PageHeader, Toggle } from '../../components/ui';
import { api } from '../../lib/api';
import { hace } from '../../lib/format';

interface Usuario {
  id: string;
  nombre: string;
  usuario: string;
  rol: 'dueno' | 'admin_caja' | 'cajero';
  telefono: string | null;
  activo: boolean;
  ultimoAcceso: string | null;
}

function UsuarioModal({ u, onClose }: { u: Usuario | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ nombre: u?.nombre ?? '', usuario: u?.usuario ?? '', telefono: u?.telefono ?? '', rol: u?.rol ?? 'cajero', activo: u?.activo ?? true, password: '' });
  const m = useMutation({
    mutationFn: () => {
      const body = { ...f, password: f.password || undefined, telefono: f.telefono || null };
      return u ? api(`/usuarios/${u.id}`, { method: 'PUT', body }) : api('/usuarios', { body });
    },
    onSuccess: () => {
      toast.success('Guardado');
      void qc.invalidateQueries({ queryKey: ['usuarios'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal title={u ? `Editar a ${u.nombre}` : 'Nueva persona del equipo'} onClose={onClose} footer={<button className="btn-primary" disabled={m.isPending || f.nombre.length < 2 || f.usuario.length < 3 || (!u && f.password.length < 4)} onClick={() => m.mutate()}>Guardar</button>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nombre" className="col-span-2">
          <input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        </Field>
        <Field label="Usuario (para entrar)">
          <input className="input" value={f.usuario} onChange={(e) => setF({ ...f, usuario: e.target.value.toLowerCase().replace(/\s/g, '') })} />
        </Field>
        <Field label={u ? 'Nueva contraseña (opcional)' : 'Contraseña'} hint="Mínimo 4 caracteres; puede ser un PIN">
          <input className="input" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </Field>
        <Field label="Teléfono">
          <input className="input" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} />
        </Field>
        <Field label="Rol">
          <select className="input" value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value as Usuario['rol'] })}>
            <option value="cajero">Recepción / cajera (caja ciega)</option>
            <option value="admin_caja">Administrador de caja (ve ventas, cierres y finanzas)</option>
            <option value="dueno">Dueño (ve y configura todo)</option>
          </select>
        </Field>
        {u && (
          <div className="col-span-2">
            <Toggle checked={f.activo} onChange={(v) => setF({ ...f, activo: v })} label="Puede entrar al sistema" />
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function Equipo() {
  const [edit, setEdit] = useState<Usuario | null | undefined>(undefined);
  const { data, isLoading } = useQuery({ queryKey: ['usuarios'], queryFn: () => api<Usuario[]>('/usuarios') });
  return (
    <div>
      <PageHeader
        title="Equipo"
        kicker="Accesos"
        actions={
          <button className="btn-primary" onClick={() => setEdit(null)}>
            <UserPlus className="h-4 w-4" /> Agregar
          </button>
        }
      >
        La recepción cobra, registra clientes y entradas, pero nunca ve montos acumulados, cierres ni reportes.
      </PageHeader>
      {isLoading ? (
        <Loading />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.map((u) => (
            <div key={u.id} className={cx('plate flex items-center gap-4 p-5 pt-7', !u.activo && 'opacity-50')}>
              <Avatar nombre={u.nombre} size={52} ring={u.rol === 'dueno' ? 'flame' : undefined} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-extrabold text-white">{u.nombre}</p>
                <p className="text-sm text-steel-400">@{u.usuario}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-steel-500">
                  {u.rol === 'dueno' ? <ShieldCheck className="h-3.5 w-3.5 text-flame-500" /> : <KeyRound className="h-3.5 w-3.5" />}
                  {u.rol === 'dueno' ? 'Dueño' : u.rol === 'admin_caja' ? 'Admin. de caja' : 'Recepción'} · entró {hace(u.ultimoAcceso)}
                </p>
              </div>
              <button className="rounded-lg p-2 text-steel-500 hover:text-white" onClick={() => setEdit(u)}>
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      {edit !== undefined && <UsuarioModal u={edit} onClose={() => setEdit(undefined)} />}
    </div>
  );
}
