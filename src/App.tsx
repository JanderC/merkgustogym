import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { MostradorLayout, PanelLayout } from './components/Layout';
import type { Rol } from './lib/api';
import { useAuth } from './lib/auth';
import EntrenadoresKiosko from './pages/cajero/Entrenadores';
import EntrenadoresAdmin from './pages/dueno/Entrenadores';
import Finanzas from './pages/dueno/Finanzas';
import TasasPage from './pages/dueno/Tasas';
import Login from './pages/Login';
import Pantalla from './pages/Pantalla';
import Cobrar from './pages/cajero/Cobrar';
import Entradas from './pages/cajero/Entradas';
import MiTurno from './pages/cajero/MiTurno';
import SociosPage from './pages/cajero/Socios';
import Membresias from './pages/cajero/Membresias';
import Clases from './pages/cajero/Clases';
import Asistencia from './pages/dueno/Asistencia';
import Ajustes from './pages/dueno/Ajustes';
import Biometrico from './pages/dueno/Biometrico';
import Catalogo from './pages/dueno/Catalogo';
import Cierres from './pages/dueno/Cierres';
import CajaEnVivo from './pages/dueno/CajaEnVivo';
import Equipo from './pages/dueno/Equipo';
import Reportes from './pages/dueno/Reportes';
import Resumen from './pages/dueno/Resumen';
import Ventas from './pages/dueno/Ventas';
import WhatsApp from './pages/dueno/WhatsApp';

function Protegido({ children, roles }: { children: ReactNode; roles?: Rol[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.rol)) return <Navigate to={user.rol === 'cajero' ? '/mostrador' : '/panel'} replace />;
  return <>{children}</>;
}

function Inicio() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.rol === 'cajero' ? '/mostrador' : '/panel'} replace />;
}

const GESTION: Rol[] = ['dueno', 'admin_caja'];
const DUENO: Rol[] = ['dueno'];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/pantalla"
        element={
          <Protegido>
            <Pantalla />
          </Protegido>
        }
      />
      <Route
        path="/mostrador"
        element={
          <Protegido>
            <MostradorLayout />
          </Protegido>
        }
      >
        <Route index element={<Cobrar />} />
        <Route path="entradas" element={<Entradas />} />
        <Route path="clientes" element={<SociosPage />} />
        <Route path="membresias" element={<Membresias />} />
        <Route path="clases" element={<Clases />} />
        <Route path="entrenadores" element={<EntrenadoresKiosko />} />
        <Route path="turno" element={<MiTurno />} />
      </Route>
      <Route
        path="/panel"
        element={
          <Protegido roles={GESTION}>
            <PanelLayout />
          </Protegido>
        }
      >
        <Route index element={<Resumen />} />
        <Route path="caja-en-vivo" element={<CajaEnVivo />} />
        <Route path="cierres" element={<Cierres />} />
        <Route path="ventas" element={<Ventas />} />
        <Route path="clientes" element={<SociosPage />} />
        <Route path="membresias" element={<Membresias />} />
        <Route path="clases" element={<Clases />} />
        <Route path="asistencia" element={<Asistencia />} />
        <Route path="reportes" element={<Reportes />} />
        <Route path="finanzas" element={<Finanzas />} />
        <Route path="tasas" element={<TasasPage />} />
        <Route path="entrenadores" element={<EntrenadoresAdmin />} />
        <Route path="catalogo" element={<Protegido roles={DUENO}><Catalogo /></Protegido>} />
        <Route path="equipo" element={<Protegido roles={DUENO}><Equipo /></Protegido>} />
        <Route path="whatsapp" element={<Protegido roles={DUENO}><WhatsApp /></Protegido>} />
        <Route path="biometrico" element={<Protegido roles={DUENO}><Biometrico /></Protegido>} />
        <Route path="ajustes" element={<Protegido roles={DUENO}><Ajustes /></Protegido>} />
      </Route>
      <Route path="*" element={<Inicio />} />
    </Routes>
  );
}
