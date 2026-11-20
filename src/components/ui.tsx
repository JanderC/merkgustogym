import clsx from 'clsx';
import { Loader2, ScanFace, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { fotoUrl } from '../lib/api';
import { diasHasta, fecha, iniciales, money } from '../lib/format';
import type { BioEstado } from '../lib/types';

export const cx = clsx;

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('animate-spin text-flame-500', className ?? 'h-5 w-5')} />;
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-steel-400">
      <Spinner /> {label}
    </div>
  );
}

export function Empty({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.04] text-steel-500">{icon}</div>}
      <p className="font-display text-lg font-bold text-steel-200">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-steel-500">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, kicker, actions, children }: { title: string; kicker?: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {kicker && <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-flame-500">{kicker}</p>}
        <h1 className="font-wide text-2xl text-white md:text-[28px]">{title}</h1>
        {children && <div className="mt-1 text-sm text-steel-400">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-steel-500">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-start gap-4 rounded-xl p-3 text-left transition hover:bg-white/[0.03]">
      <span className={cx('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-flame-500' : 'bg-ink-600')}>
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
      <span>
        <span className="block text-sm font-bold text-steel-100">{label}</span>
        {hint && <span className="block text-xs text-steel-500">{hint}</span>}
      </span>
    </button>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: Array<{ value: T; label: ReactNode }> }) {
  return (
    <div className="inline-flex rounded-xl border border-white/[0.06] bg-ink-950/60 p-1">
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={cx(
            'rounded-lg px-3.5 py-1.5 text-[13px] font-bold transition',
            value === it.value ? 'bg-flame-500 text-ink-950' : 'text-steel-400 hover:text-steel-100',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function Overlay({ onClose, children, side }: { onClose: () => void; children: ReactNode; side?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return createPortal(
    <div className={cx('fixed inset-0 z-50 flex bg-black/70 backdrop-blur-sm', side ? 'justify-end' : 'items-center justify-center p-4')} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      {children}
    </div>,
    document.body,
  );
}

export function Modal({ title, onClose, children, footer, size = 'md' }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <Overlay onClose={onClose}>
      <div className={cx('plate flex max-h-[92vh] w-full animate-pop flex-col', size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl')}>
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-6 pb-4 pt-6">
          <h3 className="font-wide text-lg text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-steel-500 hover:bg-white/5 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-white/[0.06] px-6 py-4">{footer}</div>}
      </div>
    </Overlay>
  );
}

export function Drawer({ title, subtitle, onClose, children, footer }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <Overlay onClose={onClose} side>
      <div className="flex h-full w-full max-w-2xl animate-slidein flex-col border-l border-white/[0.06] bg-ink-900">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-5">
          <div>
            <h3 className="font-wide text-xl text-white">{title}</h3>
            {subtitle && <div className="mt-1 text-sm text-steel-400">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-steel-500 hover:bg-white/5 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.06] px-6 py-4">{footer}</div>}
      </div>
    </Overlay>
  );
}

export function Avatar({ socioId, nombre, tieneFoto, size = 40, bust, ring, token }: { socioId?: string | null; nombre: string; tieneFoto?: boolean | null; size?: number; bust?: string | number; ring?: 'ok' | 'bad' | 'flame'; token?: string | null }) {
  const [err, setErr] = useState(false);
  const ringCls = ring === 'ok' ? 'ring-ok' : ring === 'bad' ? 'ring-bad' : ring === 'flame' ? 'ring-flame-500' : 'ring-white/10';
  return (
    <div className={cx('relative shrink-0 overflow-hidden rounded-full bg-ink-700 ring-2', ringCls)} style={{ width: size, height: size }}>
      {socioId && tieneFoto && !err ? (
        <img src={fotoUrl(socioId, bust, token === undefined ? undefined : token)} alt="" className="h-full w-full object-cover" onError={() => setErr(true)} />
      ) : (
        <div className="grid h-full w-full place-items-center font-display font-extrabold text-steel-300" style={{ fontSize: size * 0.36 }}>
          {iniciales(nombre)}
        </div>
      )}
    </div>
  );
}

export function VigenciaBadge({ vence, activo = true }: { vence: string | null; activo?: boolean }) {
  if (!activo) return <span className="chip border-steel-500/30 text-steel-500">Inactivo</span>;
  const d = diasHasta(vence);
  if (d === null) return <span className="chip border-steel-500/30 text-steel-400">Sin plan</span>;
  if (d < 0) return <span className="chip border-bad/30 bg-bad/10 text-bad">Vencido</span>;
  if (d <= 3) return <span className="chip border-warn/30 bg-warn/10 text-warn">{d === 0 ? 'Vence hoy' : `${d + 1} días`}</span>;
  return (
    <span className="chip border-ok/30 bg-ok/10 text-ok" title={`Hasta ${fecha(vence)}`}>
      Al día
    </span>
  );
}

const bioMap: Record<BioEstado, { t: string; c: string }> = {
  sincronizado: { t: 'Rostro OK', c: 'border-ok/30 text-ok' },
  pendiente: { t: 'Enviando', c: 'border-warn/30 text-warn' },
  error: { t: 'Error lector', c: 'border-bad/30 text-bad' },
  sin_rostro: { t: 'Sin rostro', c: 'border-steel-500/30 text-steel-500' },
};
export function BioBadge({ estado }: { estado: BioEstado }) {
  const m = bioMap[estado];
  return (
    <span className={cx('chip', m.c)}>
      <ScanFace className="h-3 w-3" /> {m.t}
    </span>
  );
}

export function Stat({ label, value, hint, icon, accent }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; accent?: boolean }) {
  return (
    <div className={cx('plate p-5 pt-6', accent && 'border-flame-500/25 from-flame-500/[0.09]')}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-steel-400">{label}</p>
        {icon && <span className={cx(accent ? 'text-flame-500' : 'text-steel-500')}>{icon}</span>}
      </div>
      <p className="tnum mt-3 font-wide text-[28px] leading-none text-white">{value}</p>
      {hint && <p className="mt-2 text-xs text-steel-500">{hint}</p>}
    </div>
  );
}

export function Diferencia({ n, declaro = true, abierto }: { n: number; declaro?: boolean; abierto?: boolean }) {
  if (abierto) return <span className="chip border-flame-500/30 text-flame-400">En curso</span>;
  if (!declaro) return <span className="chip border-warn/30 bg-warn/10 text-warn">Sin declarar</span>;
  if (n === 0) return <span className="chip border-ok/30 bg-ok/10 text-ok">Cuadrado</span>;
  const f = money(Math.abs(n));
  return n < 0 ? <span className="chip border-bad/40 bg-bad/15 text-bad">Falta {f}</span> : <span className="chip border-sky-400/30 bg-sky-400/10 text-sky-300">Sobra {f}</span>;
}

/**
 * Campo numérico que SÍ se puede borrar: mientras escribes guarda el texto tal cual
 * (vacío incluido) y solo al salir del campo aplica mínimo/máximo.
 */
export function NumInput({ value, onChange, min, max, className, decimal, placeholder }: { value: number; onChange: (n: number) => void; min?: number; max?: number; className?: string; decimal?: boolean; placeholder?: string }) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => {
    if (txt !== '' && Number(txt.replace(',', '.')) !== value) setTxt(String(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const limitar = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  return (
    <input
      className={cx('input tnum', className)}
      inputMode={decimal ? 'decimal' : 'numeric'}
      placeholder={placeholder}
      value={txt}
      onChange={(e) => {
        const t = e.target.value.replace(decimal ? /[^\d.,-]/g : /[^\d-]/g, '');
        setTxt(t);
        const n = Number(t.replace(',', '.'));
        if (t !== '' && t !== '-' && Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => {
        const n = Number(txt.replace(',', '.'));
        const final = limitar(txt === '' || !Number.isFinite(n) ? (min ?? 0) : n);
        setTxt(String(final));
        onChange(final);
      }}
    />
  );
}
