/**
 * Foto del rostro TOMADA POR EL LECTOR FACIAL (en recepción no hay cámara).
 * El sistema le pide al lector Hikvision que capture: el equipo muestra
 * "mire a la cámara", toma la foto y la devuelve. Esa misma foto es la que
 * se registra en el lector para reconocer a la persona.
 * "Subir archivo" queda como respaldo (foto enviada por WhatsApp, etc.).
 */
import { useMutation } from '@tanstack/react-query';
import { ImageUp, Loader2, RefreshCw, ScanFace, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { cx } from './ui';

const MAX_BYTES = 190 * 1024; // el lector admite ~200 KB
const LADO = 480;

/** Recorta al centro en cuadrado y comprime JPEG bajo el límite del lector (solo para archivos subidos). */
function aJpeg(src: CanvasImageSource, w: number, h: number): string {
  const c = document.createElement('canvas');
  c.width = LADO;
  c.height = LADO;
  const ctx = c.getContext('2d')!;
  const lado = Math.min(w, h);
  ctx.drawImage(src, (w - lado) / 2, (h - lado) / 2, lado, lado, 0, 0, LADO, LADO);
  let q = 0.9;
  let url = c.toDataURL('image/jpeg', q);
  while (url.length * 0.75 > MAX_BYTES && q > 0.4) {
    q -= 0.08;
    url = c.toDataURL('image/jpeg', q);
  }
  return url;
}

export function FotoCaptura({ value, onChange, etiqueta = 'Tomar foto con el lector' }: { value: string | null; onChange: (v: string | null) => void; etiqueta?: string }) {
  const capturar = useMutation({
    mutationFn: () => api<{ foto: string; origen: 'lector' | 'simulado' }>('/lector/capturar-rostro', { body: {} }),
    onSuccess: (r) => {
      onChange(r.foto);
      toast.success(r.origen === 'simulado' ? 'Foto tomada (lector simulado)' : 'Foto tomada por el lector');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const subir = (f: File | undefined) => {
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      onChange(aJpeg(img, img.naturalWidth, img.naturalHeight));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => toast.error('Imagen no válida');
    img.src = URL.createObjectURL(f);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={cx('relative aspect-square w-full max-w-[260px] overflow-hidden rounded-3xl border-2 bg-ink-950', capturar.isPending ? 'border-flame-500' : 'border-white/10')}>
        {capturar.isPending ? (
          <div className="grid h-full w-full place-items-center p-6 text-center">
            <div>
              <ScanFace className="mx-auto mb-3 h-14 w-14 animate-pulse text-flame-500" />
              <p className="font-display text-lg font-extrabold text-white">Mira al lector</p>
              <p className="mt-1 text-xs text-steel-400">De frente, sin gorra ni lentes oscuros</p>
              <Loader2 className="mx-auto mt-3 h-5 w-5 animate-spin text-flame-500" />
            </div>
          </div>
        ) : value ? (
          <img src={value} alt="Rostro" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center p-6 text-center text-sm text-steel-500">
            <div>
              <ScanFace className="mx-auto mb-2 h-10 w-10 text-steel-600" />
              Párate frente al lector facial y toca el botón
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="btn-primary btn-sm" onClick={() => capturar.mutate()} disabled={capturar.isPending}>
          {value ? <RefreshCw className="h-4 w-4" /> : <ScanFace className="h-4 w-4" />} {value ? 'Repetir con el lector' : etiqueta}
        </button>
        <label className="btn-ghost btn-sm cursor-pointer" title="Respaldo: subir una foto existente">
          <ImageUp className="h-4 w-4" /> Subir archivo
          <input type="file" accept="image/*" className="hidden" onChange={(e) => subir(e.target.files?.[0])} />
        </label>
        {value && !capturar.isPending && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => onChange(null)} title="Quitar foto">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
