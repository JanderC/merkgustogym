import { FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { descargar } from '../lib/api';
import { Spinner } from './ui';

/** Botón "Descargar Excel" para pasarle el reporte a la administradora. */
export function BotonExcel({ path, query, nombre, label = 'Descargar Excel', className = 'btn-ghost' }: { path: string; query?: Record<string, unknown>; nombre?: string; label?: string; className?: string }) {
  const [cargando, setCargando] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={cargando}
      onClick={async () => {
        setCargando(true);
        try {
          await descargar(path, query, nombre);
          toast.success('Excel descargado');
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setCargando(false);
        }
      }}
    >
      {cargando ? <Spinner className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4 text-ok" />} {label}
    </button>
  );
}
