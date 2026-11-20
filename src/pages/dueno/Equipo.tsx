import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, LockKeyhole, Pencil, ShieldCheck, UserPlus } from 'lucide-react';
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
  tienePin?: boolean;
}

/** Código de supervisor: lo escribe en la caja para autorizar una devolución. */
function PinModal({ u, onClose }: { u: Usuario; onClose: () => void }) {
  const qc = useQueryClient();
  const [pin, setPin] = useState('');
  const [rep, setRep] = useState('');
  const m = useMutation({
    mutationFn: (valor: string) => api(`/usuarios/${u.id}/pin`, { method: 'PUT', body: { pin: valor } }),
    onSuccess: (_r, valor) => {
      toast.success(valor ? `Código de autorización guardado para ${u.nombre}` : 'Código quitado');
      void qc.invalidateQueries({ queryKey: ['usuarios'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const ok = /^\d{4,8}$/.test(pin) && pin === rep;
  return (
    <Modal
      title={`Código de supervisor · ${u.nombre}`}
      size="sm"
      onClose={onClose}
      footer={
        <div className="flex w-full justify-between gap-2">
          {u.tienePin ? (
            <button className="btn-ghost text-bad" disabled={m.isPending} onClick={() => m.mutate('')}>
              Quitar código
            </button>
          ) : (
            <span />
          )}
          <button className="btn-primary" disabled={!ok || m.isPending} onClick={() => m.mutate(pin)}>
            Guardar código
          </button>
        </div>
      }
    >
      <p className="mb-4 text-sm text-steel-400">
        Con este código {u.nombre} autoriza las <b className="text-steel-100">devoluciones</b> en caja. Es distinto a su contraseña, de 4 a 8 números, y no se lo debe dar a las cajeras.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Código nuevo">
          <input className="input pin tnum text-center text-xl tracking-[0.5em]" type="password" inputMode="numeric" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} autoFocus />
        </Field>
        <Field label="Repítelo">
          <input className="input pin tnum text-center text-xl tracking-[0.5em]" type="password" inputMode="numeric" maxLength={8} value={rep} onChange={(e) => setRep(e.target.value.replace(/\D/g, ''))} />
        </Field>
      </div>
      {rep.length >= 4 && pin !== rep && <p className="mt-2 text-xs text-warn">Los códigos no coinciden</p>}
    </Modal>
  );
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
  const [pinDe, setPinDe] = useState<Usuario | null>(null);
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
                {u.rol !== 'cajero' && (
                  <button
                    className={cx('chip mt-2 cursor-pointer py-1', u.tienePin ? 'border-ok/30 text-ok hover:bg-ok/10' : 'border-warn/40 text-warn hover:bg-warn/10')}
                    onClick={() => setPinDe(u)}
                  >
                    <LockKeyhole className="h-3 w-3" /> {u.tienePin ? 'Autoriza devoluciones' : 'Asignar código de supervisor'}
                  </button>
                )}
              </div>
              <button className="rounded-lg p-2 text-steel-500 hover:text-white" onClick={() => setEdit(u)}>
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      {edit !== undefined && <UsuarioModal u={edit} onClose={() => setEdit(undefined)} />}
      {pinDe && <PinModal u={pinDe} onClose={() => setPinDe(null)} />}
    </div>
  );
}
