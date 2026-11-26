export type IncidentCategory = 
  | 'Bache' 
  | 'Badén en mal estado' 
  | 'Alcantarilla sin tapa' 
  | 'Suciedad / Basura';

export type IncidentStatus = 
  | 'Pendiente' 
  | 'En revisión' 
  | 'Solucionado';

export type IncidentSeverity = 
  | 'Baja' 
  | 'Media' 
  | 'Alta' 
  | 'Crítica';

export interface StatusHistoryEntry {
  id: string;
  timestamp: string; // ISO date
  previousStatus?: IncidentStatus;
  newStatus: IncidentStatus;
  changedBy: string; // e.g., "Mesa de Entrada", "Ing. Fernando Lugo (Vialidad)", "Cuadrilla 03"
  notes?: string;
}

export interface IncidentReport {
  id: string;
  category: IncidentCategory;
  description: string;
  photoUrl: string;
  location: {
    lat: number;
    lng: number;
    address: string;
    barrio: string;
  };
  citizenId?: string; // Número de Cédula (el público recibe solo "••••123")
  citizenKey?: string; // Identificador opaco asignado por el servidor (agrupa sin exponer la cédula)
  citizenName: string;
  citizenPhone?: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  createdAt: string; // ISO date
  reportDate?: string; // YYYY-MM-DD (America/Asuncion)
  reportMonth?: string; // YYYY-MM (America/Asuncion)
  updatedAt: string;
  resolutionNotes?: string;
  resolvedAt?: string;
  statusHistory?: StatusHistoryEntry[];
}

export interface CitizenUser {
  id: string; // Número de Cédula de Identidad (el C.I. es el ID)
  ci: string;
  fullName: string;
  phone?: string;
  registeredAt: string;
  citizenKey?: string; // Mismo identificador opaco que llevan sus reportes
}

export type AdminLevel = 1 | 2;

export interface AdminUser {
  id: string; // Número de Cédula de Identidad (el C.I. es el ID)
  ci: string;
  employeeNumber: string;
  email?: string;
  fullName: string;
  level: AdminLevel; // 1 = Solo visualización, 2 = Completo incluyendo crear perfiles
  role: 'analista' | 'supervisor' | 'administrador';
  token: string;
  createdAt?: string;
}

export interface ReportFilter {
  category?: IncidentCategory | 'Todas';
  status?: IncidentStatus | 'Todos';
  barrio?: string | 'Todos';
  searchQuery?: string;
  severity?: IncidentSeverity | 'Todas';
  startDate?: string;
  endDate?: string;
  date?: string; // YYYY-MM-DD
  month?: string; // YYYY-MM
}
