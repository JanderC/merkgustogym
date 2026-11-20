import type { Medicion, Rutina } from '../../components/Progreso';

export interface Alerta {
  tipo: 'vence' | 'vencido' | 'ausente' | 'sin_rutina' | 'medir';
  texto: string;
}

export interface ClaseCoach {
  id: number;
  nombre: string;
  descripcion: string | null;
  planId: number | null;
  plan: string | null;
  entrenadorId: string | null;
  entrenador: string | null;
  inicio: string;
  duracionMin: number;
  cupo: number | null;
  nivel: string | null;
  color: string;
  estado: string;
  dia: string;
  hora: string;
  inscritos: number;
  asistieron: number;
  mia?: boolean;
}

export interface ClienteCoach {
  id: string;
  codigo: number;
  nombre: string;
  apellido: string;
  telefono: string | null;
  activo: boolean;
  tieneFoto: boolean;
  privado: boolean;
  appUltimoAcceso: string | null;
  vigente: boolean;
  plan: string | null;
  diasRestantes: number;
  hasta: string | null;
  congelada: boolean;
  ultimaEntrada: string | null;
  diasSinVenir: number | null;
  ultimaMedicion: string | null;
  rutina: string | null;
  entrenosSemana: number;
  alertas: Alerta[];
}

export type MedicionCoach = Medicion & { autor: 'equipo' | 'entrenador' | 'cliente'; entrenador: string | null };
export type RutinaCoach = Rutina & { autor: 'equipo' | 'entrenador' | 'cliente' };

export interface FichaCoach extends Omit<ClienteCoach, 'privado' | 'appUltimoAcceso' | 'activo'> {
  edad: number | null;
  genero: string | null;
  desde: string;
  mio: boolean;
  app: { privado: boolean; ultimoAcceso: string | null; enlace: boolean };
  mediciones: MedicionCoach[];
  rutinas: RutinaCoach[];
  notas: Array<{ id: number; texto: string; creadoEn: string }>;
  clases: Array<{ id: number; nombre: string; inicio: string; color: string; asistioEn: string | null; reservadoPorSocio: boolean; entrenador: string | null }>;
  entradas: string[];
  entrenos: { lista: Array<{ id: number; fecha: string; dia: string }>; hoy: string[]; estaSemana: number; racha: number };
}

export interface Plantilla {
  id: number;
  titulo: string;
  objetivo: string | null;
  dias: Rutina['dias'];
  actualizadoEn: string;
}

export const whatsappDe = (tel: string) => `https://wa.me/${tel.replace(/\D/g, '').replace(/^0/, '58')}`;

export const diaCorto = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric' });
