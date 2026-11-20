import type { Moneda, Tasas } from './monedas';

export interface Vigencia {
  vigente: boolean;
  desde: string | null;
  hasta: string | null;
  ultimaFin: string | null;
  plan: string | null;
  diasRestantes: number;
  congelada: { membresiaId: string; desde: string; dias: number } | null;
}

export type BioEstado = 'sin_rostro' | 'pendiente' | 'sincronizado' | 'error';

export interface SocioLista {
  id: string;
  codigo: number;
  cedula: string | null;
  nombre: string;
  apellido: string;
  telefono: string | null;
  activo: boolean;
  bioEstado: BioEstado;
  tieneFoto: boolean;
  vence: string | null;
  plan: string | null;
  ultimaVisita: string | null;
}

export interface Deuda {
  id: number;
  concepto: string;
  moneda: Moneda;
  montoTotal: number;
  saldo: number;
  creadoEn: string;
  saldoTexto?: string;
}

export interface MembresiaCliente {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  estado: 'activa' | 'congelada' | 'anulada' | 'reemplazada';
  plan: string;
  color: string;
  congelable: boolean;
  congeladaDesde: string | null;
  diasCongelados: number;
  grupoId: string | null;
  notas: string | null;
  precio?: number;
  moneda?: Moneda;
  creadoEn: string;
}

export interface SocioDetalle {
  id: string;
  codigo: number;
  cedula: string | null;
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string | null;
  fechaNacimiento: string | null;
  genero: 'M' | 'F' | 'O' | null;
  foto: string | null;
  notas: string | null;
  activo: boolean;
  bioEstado: BioEstado;
  bioError: string | null;
  bioSincronizadoEn: string | null;
  bioPendiente: boolean;
  bioReintentando: string | null;
  creadoEn: string;
  actualizadoEn: string;
  vigencia: Vigencia;
  membresias: MembresiaCliente[];
  asistencias: Array<{ id: number; fechaHora: string; origen: string; resultado: 'permitido' | 'denegado'; motivo: string | null; alerta: string | null }>;
  deudas: Deuda[];
}

export type TipoDuracion = 'dias' | 'semanas' | 'meses' | 'anios';

export interface Plan {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  moneda: Moneda;
  tipoDuracion: TipoDuracion;
  cantidad: number;
  personas: number;
  congelable: boolean;
  maxDiasCongelado?: number;
  /** El lector facial le abre (semanas/meses/años). Pase diario: entra por recepción */
  accesoLector: boolean;
  duracion: string;
  color: string;
  activo?: boolean;
  orden?: number;
  activos?: number;
  /** Clientes que alguna vez lo compraron */
  historicos?: number;
  eliminadoEn?: string | null;
}

export interface Producto {
  id: number;
  nombre: string;
  categoria: string;
  precio: number;
  moneda: Moneda;
  costo?: number;
  stock: number;
  stockMinimo?: number;
  controlaStock: boolean;
  activo?: boolean;
  codigoBarras?: string | null;
}

export interface MetodoPago {
  codigo: string;
  nombre: string;
  pideReferencia: boolean;
  monedas: Moneda[];
  activo?: boolean;
  orden?: number;
  esSistema?: boolean;
}

export interface Catalogo {
  planes: Plan[];
  productos: Producto[];
  metodos: MetodoPago[];
  tasas: Tasas;
  tasasActualizadas: string | null;
  monedaRef: Moneda;
  categorias: { egreso: string[]; ingreso: string[] };
  /** Ids de los productos más vendidos (venta rápida) */
  masVendidos?: number[];
}

export interface TurnoCiego {
  id: string;
  numero: number;
  abiertoEn: string;
}

export interface FilaArqueo {
  metodo: string;
  nombre: string;
  moneda: Moneda;
  cobrado: number;
  vueltos: number;
  ingresos: number;
  egresos: number;
  fondo: number;
  esperado: number;
  declarado: number;
  diferencia: number;
  diferenciaRef: number;
}

export interface ResumenTurno {
  id: string;
  numero: number;
  cajero: string;
  cajeroId: string;
  estado: 'abierto' | 'cerrado' | 'revisado';
  abiertoEn: string;
  cerradoEn: string | null;
  notaCajero: string | null;
  notaDueno: string | null;
  operaciones: number;
  anuladas: number;
  monedaRef: Moneda;
  totalVendidoRef: number;
  cobradoRef: number;
  fiadoRef: number;
  ingresosRef: number;
  egresosRef: number;
  totalDeclaradoRef: number;
  diferencia: number;
  declaro: boolean;
  fondo: Partial<Record<Moneda, number>>;
  metodos: FilaArqueo[];
}

export interface Movimiento {
  id: number;
  tipo: 'ingreso' | 'egreso';
  categoria: string;
  concepto: string;
  metodo: string;
  metodoNombre: string;
  moneda: Moneda;
  monto: number;
  montoRef: number;
  referencia: string | null;
  comprobanteId: number | null;
  anulado: boolean;
  motivoAnulacion: string | null;
  creadoEn: string;
  usuario: string;
  turno: number | null;
}

export interface Asistencia {
  id: number;
  fechaHora: string;
  origen: 'biometrico' | 'manual' | 'simulado';
  resultado: 'permitido' | 'denegado';
  motivo: string | null;
  alerta: string | null;
  employeeNo: string | null;
  metodoVerif: string | null;
  socioId: string | null;
  codigo: number | null;
  socio: string | null;
  tieneFoto: boolean | null;
  registradoPor: string | null;
}

export interface ResultadoAcceso {
  resultado: 'permitido' | 'denegado';
  motivo: string;
  alerta: string | null;
  socio: { id: string; codigo: number; nombre: string } | null;
  entrenador?: { id: string; nombre: string; marco: string | null } | null;
  vigencia: Vigencia | null;
}

export type TipoMarcacion = 'entrada' | 'salida' | 'retiro' | 'regreso';
export type Horario = Partial<Record<'1' | '2' | '3' | '4' | '5' | '6' | '7', { entrada: string; salida: string }>>;

export interface EntrenadorHoy {
  id: string;
  codigo: number;
  nombre: string;
  apellido: string;
  especialidad: string | null;
  horario: Horario;
  bioEstado: BioEstado;
  tieneFoto: boolean;
  estado: 'fuera' | 'presente' | 'retirado' | 'salio';
  siguientes: TipoMarcacion[];
  horarioHoy: { entrada: string; salida: string } | null;
  permiso: { id: number; tipo: string; desde: string; hasta: string; motivo: string } | null;
  ausente: boolean;
  entrada: string | null;
  minutosTarde: number | null;
  minutosHoy: number;
  marcaciones: Array<{ id: number; tipo: TipoMarcacion; fechaHora: string; origen: string; fotoId: number | null; nota: string | null; minutosTarde: number | null }>;
}
