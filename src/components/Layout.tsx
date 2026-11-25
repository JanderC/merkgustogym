import { ArrowLeftRight, Award, BarChart3, Boxes, CalendarClock, CalendarDays, ClipboardList, DoorOpen, Dumbbell, Gauge, KeyRound, LogOut, Menu, MessageCircle, Monitor, Radio, Receipt, ScanFace, Settings, ShoppingCart, Store, Timer, UserCog, Users, Vault, Wallet, Warehouse, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { duracion } from '../lib/format';
import { useIntegraciones, useTurno } from '../lib/hooks';
import { TasaWidget } from './TasaWidget';
import { cx } from './ui';

function CuentaMenu({ compact }: { compact?: boolean }) {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div className="flex items-center gap-3">
      {!compact && (
        <div className="text-right leading-tight">
          <p className="text-sm font-bold text-steel-100">{user.nombre}</p>
          <p className="text-[11px] uppercase tracking-wider text-steel-500">{user.rol === 'dueno' ? 'Dueño' : user.rol === 'admin_caja' ? 'Admin. de caja' : 'Recepción'}</p>
        </div>
      )}
      <button onClick={logout} className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] text-steel-400 transition hover:border-bad/40 hover:text-bad" title="Salir">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

// ═════════════════════════ MOSTRADOR (cajeras) ═════════════════════════
const mostradorNav = [
  { to: '/mostrador', label: 'Cobrar', icon: ShoppingCart, end: true },
  { to: '/mostrador/entradas', label: 'Entradas', icon: DoorOpen },
  { to: '/mostrador/clientes', label: 'Clientes', icon: Users },
  { to: '/mostrador/membresias', label: 'Membresías', icon: CalendarClock },
  { to: '/mostrador/personalizados', label: 'Personalizados', icon: Award },
  { to: '/mostrador/clases', label: 'Clases', icon: CalendarDays },
  { to: '/mostrador/entrenadores', label: 'Entrenadores', icon: Dumbbell },
  { to: '/mostrador/turno', label: 'Mi turno', icon: Timer },
];

export function MostradorLayout() {
  const { user } = useAuth();
  const { data: turno } = useTurno();
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center gap-4 px-4 md:px-6">
          <img src="/logo-full.png" alt="Merkgusto" className="h-10 w-auto" />
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {mostradorNav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cx('flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold transition', isActive ? 'bg-flame-500 text-ink-950 shadow-glow' : 'text-steel-400 hover:bg-white/[0.04] hover:text-steel-100')
                }
              >
                <n.icon className="h-[18px] w-[18px]" /> {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <TasaWidget />
            {turno ? (
              <span className="chip hidden border-ok/30 bg-ok/10 py-1 text-ok sm:inline-flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" /> Turno #{turno.numero} · {duracion(turno.abiertoEn)}
              </span>
            ) : (
              <span className="chip hidden border-warn/30 bg-warn/10 py-1 text-warn sm:inline-flex">Sin turno abierto</span>
            )}
            {user?.rol !== 'cajero' && (
              <NavLink to="/panel" className="btn-ghost btn-sm">
                <Gauge className="h-4 w-4" /> Panel
              </NavLink>
            )}
            <CuentaMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 pb-28 pt-6 md:px-6 md:pb-10">
        <Outlet />
      </main>
      {/* Navegación táctil inferior en tablets/teléfonos */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/[0.06] bg-ink-950/95 backdrop-blur md:hidden">
        {mostradorNav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('flex flex-col items-center gap-1 py-3 text-[11px] font-bold', isActive ? 'text-flame-500' : 'text-steel-500')}>
            <n.icon className="h-5 w-5" /> {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

// ═════════════════════════ PANEL (dueño) ═════════════════════════
type ItemNav = { to: string; label: string; icon: typeof Gauge; end?: boolean; soloDueno?: boolean };
const panelNav: Array<{ grupo: string; items: ItemNav[] }> = [
  {
    grupo: 'Dinero',
    items: [
      { to: '/panel', label: 'Resumen', icon: Gauge, end: true },
      { to: '/panel/caja-en-vivo', label: 'Caja en vivo', icon: Radio },
      { to: '/panel/cierres', label: 'Cierres de caja', icon: Vault },
      { to: '/panel/finanzas', label: 'Finanzas', icon: Wallet },
      { to: '/panel/ventas', label: 'Ventas', icon: Receipt },
      { to: '/panel/tasas', label: 'Tasas del día', icon: ArrowLeftRight },
      { to: '/panel/reportes', label: 'Reportes', icon: BarChart3 },
    ],
  },
  {
    grupo: 'Gimnasio',
    items: [
      { to: '/panel/clientes', label: 'Clientes', icon: Users },
      { to: '/panel/membresias', label: 'Membresías', icon: CalendarClock },
      { to: '/panel/personalizados', label: 'Personalizados', icon: Award },
      { to: '/panel/clases', label: 'Clases', icon: CalendarDays },
      { to: '/panel/asistencia', label: 'Asistencia', icon: ClipboardList },
      { to: '/panel/entrenadores', label: 'Entrenadores', icon: Dumbbell },
      { to: '/panel/catalogo', label: 'Planes y productos', icon: Boxes, soloDueno: true },
      { to: '/panel/inventario', label: 'Inventario', icon: Warehouse },
    ],
  },
  {
    grupo: 'Automatización',
    items: [
      { to: '/panel/whatsapp', label: 'WhatsApp', icon: MessageCircle, soloDueno: true },
      { to: '/panel/biometrico', label: 'Lector facial', icon: ScanFace, soloDueno: true },
    ],
  },
  {
    grupo: 'Administración',
    items: [
      { to: '/panel/equipo', label: 'Equipo', icon: UserCog, soloDueno: true },
      { to: '/panel/ajustes', label: 'Ajustes', icon: Settings, soloDueno: true },
    ],
  },
];

function Luz({ ok, label, warn }: { ok: boolean; warn?: boolean; label: ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-xs text-steel-400">
      <span className={cx('h-2 w-2 rounded-full', ok ? 'bg-ok shadow-[0_0_8px] shadow-ok' : warn ? 'bg-warn' : 'bg-bad')} /> {label}
    </span>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const esDueno = user?.rol === 'dueno';
  const { data } = useIntegraciones(esDueno);
  const wa = data?.wa?.estado;
  const bio = data?.bio;
  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pb-6 pt-7">
        <img src="/logo-full.png" alt="Merkgusto" className="w-36" />
        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.3em] text-steel-600">Centro de mando</p>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3">
        {panelNav
          .map((g) => ({ ...g, items: g.items.filter((i) => esDueno || !i.soloDueno) }))
          .filter((g) => g.items.length)
          .map((g) => (
          <div key={g.grupo}>
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-steel-600">{g.grupo}</p>
            {g.items.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cx(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                    isActive ? 'bg-flame-500/10 text-flame-400' : 'text-steel-400 hover:bg-white/[0.03] hover:text-steel-100',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-flame-500" />}
                    <n.icon className="h-[18px] w-[18px]" /> {n.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="space-y-3 border-t border-white/[0.06] p-4">
        {esDueno && <div className="space-y-1.5 rounded-xl bg-white/[0.02] p-3">
          <Luz ok={wa === 'conectado'} warn={wa === 'qr' || wa === 'conectando'} label={`WhatsApp ${wa === 'conectado' ? 'conectado' : wa === 'qr' ? 'esperando QR' : 'desconectado'}`} />
          <Luz ok={!!bio?.online} warn={bio?.mode === 'mock'} label={`Lector ${bio?.mode === 'mock' ? 'simulado' : bio?.mode === 'disabled' ? 'apagado' : bio?.online ? 'en línea' : 'sin conexión'}`} />
        </div>}
        <div className="grid grid-cols-2 gap-2">
          <NavLink to="/mostrador" className="btn-ghost btn-sm">
            <Store className="h-4 w-4" /> Mostrador
          </NavLink>
          <a href="/pantalla" target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
            <Monitor className="h-4 w-4" /> Pantalla
          </a>
        </div>
      </div>
    </div>
  );
}

export function PanelLayout() {
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-white/[0.06] bg-ink-950/60 lg:block">
        <Sidebar />
      </aside>
      {menu && (
        <div className="fixed inset-0 z-50 bg-black/70 lg:hidden" onClick={() => setMenu(false)}>
          <aside className="h-full w-72 bg-ink-950" onClick={(e) => e.stopPropagation()}>
            <Sidebar onNavigate={() => setMenu(false)} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-ink-950/80 px-4 backdrop-blur-xl md:px-8">
          <button className="rounded-lg p-2 text-steel-400 lg:hidden" onClick={() => setMenu(!menu)}>
            {menu ? <X /> : <Menu />}
          </button>
          <p className="hidden items-center gap-2 text-xs text-steel-500 sm:flex">
            <KeyRound className="h-3.5 w-3.5 text-flame-500" /> Vista de administración · la recepción no ve montos ni cierres
          </p>
          <div className="ml-auto flex items-center gap-3">
            <TasaWidget />
            <CuentaMenu />
          </div>
        </header>
        <main key={loc.pathname} className="mx-auto w-full max-w-[1400px] flex-1 animate-rise px-4 py-8 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
