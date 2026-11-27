import crypto from 'node:crypto';
import { promisify } from 'node:util';
import pg from 'pg';
import type {
  AdminLevel,
  AdminUser,
  CitizenUser,
  IncidentCategory,
  IncidentReport,
  IncidentSeverity,
  IncidentStatus,
  StatusHistoryEntry
} from '../src/types.ts';
import { toAsuncionDateKey, toAsuncionMonthKey } from '../src/utils/dateFilterUtils.ts';
import {
  normalizeCI,
  validateAdminRegistration,
  validateCitizenRegistration
} from '../src/utils/userValidation.ts';

const { Pool } = pg;

export interface AdminAccountPublic {
  id: string;
  ci: string;
  employeeNumber: string;
  fullName: string;
  email?: string;
  level: AdminLevel;
  role: 'analista' | 'supervisor' | 'administrador';
  createdAt: string;
  createdBy?: string;
}

export interface ReportQueryFilters {
  date?: string;
  month?: string;
  status?: IncidentStatus | 'Todos';
  category?: IncidentCategory | 'Todas';
  barrio?: string;
  q?: string;
  /** Si es true, la búsqueda de texto también mira el nombre del ciudadano (solo administradores). */
  searchCitizen?: boolean;
}

/** Datos del primer administrador (Nivel 2). Normalmente vienen de ADMIN_CI / ADMIN_PASSWORD en el .env. */
export interface SeedAdminOptions {
  ci?: string;
  password?: string;
  fullName?: string;
  email?: string;
  employeeNumber?: string;
}

export interface CreateDbOptions {
  seedAdmin?: SeedAdminOptions;
  /** Tamaño máximo del pool de conexiones. Por defecto 5. */
  poolMax?: number;
  /** Crear las tablas si no existen (idempotente). Por defecto true. */
  autoMigrate?: boolean;
  /** Solo para tests: usa un schema aislado (se crea y se puede borrar con close({ dropSchema: true })). */
  schema?: string;
}

/** Algo que sabe ejecutar consultas: el pool o un cliente dentro de una transacción. */
interface Queryable {
  query<R extends pg.QueryResultRow = any>(text: string, params?: unknown[]): Promise<pg.QueryResult<R>>;
}

// ---------------------------------------------------------------------------
// Contraseñas (mismo formato salt:hash que antes, pero sin bloquear el servidor)
// ---------------------------------------------------------------------------
const scryptAsync = promisify(crypto.scrypt) as (
  password: string,
  salt: string,
  keylen: number
) => Promise<Buffer>;

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 64)).toString('hex');
  return `${salt}:${derived}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  const derived = await scryptAsync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

// ---------------------------------------------------------------------------
// Filas de la base y conversores
// ---------------------------------------------------------------------------
// Postgres devuelve las columnas timestamptz como objetos Date; la app espera strings ISO.
type Ts = Date | string;
const iso = (v: Ts): string => (v instanceof Date ? v.toISOString() : v);
const isoOrUndefined = (v: Ts | null): string | undefined => (v ? iso(v) : undefined);

interface ReportRow {
  id: string;
  category: IncidentCategory;
  description: string;
  photo_url: string;
  lat: number;
  lng: number;
  address: string;
  barrio: string;
  citizen_id: string | null;
  citizen_name: string;
  citizen_phone: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  resolution_notes: string | null;
  created_at: Ts;
  report_date: string;
  report_month: string;
  updated_at: Ts;
  resolved_at: Ts | null;
}

interface HistoryRow {
  id: string;
  report_id: string;
  timestamp: Ts;
  previous_status: IncidentStatus | null;
  new_status: IncidentStatus;
  changed_by: string;
  notes: string | null;
}

interface AdminRow {
  id: string;
  ci: string;
  employee_number: string;
  full_name: string;
  email: string | null;
  level: number;
  role: 'analista' | 'supervisor' | 'administrador';
  password_hash: string;
  created_at: Ts;
  created_by: string | null;
}

interface CitizenRow {
  id: string;
  ci: string;
  full_name: string;
  phone: string | null;
  registered_at: Ts;
}

function mapAdminPublic(row: AdminRow): AdminAccountPublic {
  return {
    id: row.id,
    ci: row.ci,
    employeeNumber: row.employee_number,
    fullName: row.full_name,
    email: row.email || undefined,
    level: row.level === 2 ? 2 : 1,
    role: row.role,
    createdAt: iso(row.created_at),
    createdBy: row.created_by || undefined
  };
}

function mapAdminUser(row: AdminRow, token: string): AdminUser {
  return {
    id: row.id,
    ci: row.ci,
    employeeNumber: row.employee_number,
    email: row.email || `ci.${row.ci}@asuncion.gov.py`,
    fullName: row.full_name,
    level: row.level === 2 ? 2 : 1,
    role: row.role,
    token,
    createdAt: iso(row.created_at)
  };
}

function mapCitizen(row: CitizenRow): CitizenUser {
  return {
    id: row.id,
    ci: row.ci,
    fullName: row.full_name,
    phone: row.phone || undefined,
    registeredAt: iso(row.registered_at)
  };
}

function mapReport(row: ReportRow, history: StatusHistoryEntry[]): IncidentReport {
  return {
    id: row.id,
    category: row.category,
    description: row.description,
    photoUrl: row.photo_url,
    location: {
      lat: row.lat,
      lng: row.lng,
      address: row.address,
      barrio: row.barrio
    },
    citizenId: row.citizen_id || undefined,
    citizenName: row.citizen_name,
    citizenPhone: row.citizen_phone || undefined,
    severity: row.severity,
    status: row.status,
    resolutionNotes: row.resolution_notes || undefined,
    createdAt: iso(row.created_at),
    reportDate: row.report_date,
    reportMonth: row.report_month,
    updatedAt: iso(row.updated_at),
    resolvedAt: isoOrUndefined(row.resolved_at),
    statusHistory: history
  };
}

// ---------------------------------------------------------------------------
// Esquema (igual a schema.sql, sin el prefijo "public." para poder usar schemas de prueba).
// Es idempotente: si ya corriste schema.sql en Supabase, no cambia nada.
// ---------------------------------------------------------------------------
const SCHEMA_SQL = `
create table if not exists citizens (
  id            text primary key,
  ci            text not null unique,
  full_name     text not null,
  phone         text,
  registered_at timestamptz not null default now()
);

create table if not exists admins (
  id              text primary key,
  ci              text not null unique,
  employee_number text not null unique,
  full_name       text not null,
  email           text unique,
  level           integer not null check (level in (1, 2)),
  role            text not null check (role in ('analista', 'supervisor', 'administrador')),
  password_hash   text not null,
  created_at      timestamptz not null default now(),
  created_by      text
);

create table if not exists sessions (
  token        text primary key,
  subject_type text not null check (subject_type in ('citizen', 'admin')),
  subject_id   text not null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null
);

create table if not exists reports (
  id               text primary key,
  category         text not null check (category in ('Bache', 'Badén en mal estado', 'Alcantarilla sin tapa', 'Suciedad / Basura')),
  description      text not null,
  photo_url        text not null,
  lat              double precision not null,
  lng              double precision not null,
  address          text not null,
  barrio           text not null,
  citizen_id       text references citizens(id) on update cascade on delete set null,
  citizen_name     text not null,
  citizen_phone    text,
  severity         text not null check (severity in ('Baja', 'Media', 'Alta', 'Crítica')),
  status           text not null check (status in ('Pendiente', 'En revisión', 'Solucionado')),
  resolution_notes text,
  created_at       timestamptz not null default now(),
  report_date      text not null,
  report_month     text not null,
  updated_at       timestamptz not null default now(),
  resolved_at      timestamptz
);

create table if not exists report_status_history (
  id              text primary key,
  report_id       text not null references reports(id) on delete cascade,
  "timestamp"     timestamptz not null default now(),
  previous_status text,
  new_status      text not null check (new_status in ('Pendiente', 'En revisión', 'Solucionado')),
  changed_by      text not null,
  notes           text
);

create table if not exists report_counters (
  year     text primary key,
  last_seq integer not null default 0
);

create index if not exists idx_reports_status      on reports (status);
create index if not exists idx_reports_category    on reports (category);
create index if not exists idx_reports_barrio      on reports (barrio);
create index if not exists idx_reports_date        on reports (report_date);
create index if not exists idx_reports_month       on reports (report_month);
create index if not exists idx_reports_created_at  on reports (created_at desc);
create index if not exists idx_reports_citizen_id  on reports (citizen_id);
create index if not exists idx_history_report_id   on report_status_history (report_id, "timestamp" asc);
create index if not exists idx_sessions_expires    on sessions (expires_at);

-- Seguridad: RLS activado y sin políticas (la API pública de Supabase no puede tocar nada).
alter table citizens              enable row level security;
alter table admins                enable row level security;
alter table sessions              enable row level security;
alter table reports               enable row level security;
alter table report_status_history enable row level security;
alter table report_counters       enable row level security;
`;

function buildPoolConfig(databaseUrl: string, max: number): pg.PoolConfig {
  let connectionString = databaseUrl;
  let isLocal = false;
  try {
    const url = new URL(databaseUrl);
    isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    // Si la URL trae ?sslmode=..., pisa la opción ssl de abajo y Supabase puede rechazar el certificado.
    url.searchParams.delete('sslmode');
    connectionString = url.toString();
  } catch {
    // Si no se puede interpretar, se usa tal cual.
  }

  const sslDisabled = isLocal || process.env.DATABASE_SSL === 'false';
  return {
    connectionString,
    max,
    ssl: sslDisabled ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000
  };
}

export async function createAsuncionDb(databaseUrl: string, options: CreateDbOptions = {}) {
  if (!databaseUrl) {
    throw new Error('Falta DATABASE_URL (cadena de conexión de Postgres / Supabase).');
  }

  const schema = options.schema;
  if (schema && !/^[a-z_][a-z0-9_]*$/.test(schema)) {
    throw new Error('Nombre de schema inválido.');
  }

  const pool = new Pool(buildPoolConfig(databaseUrl, options.poolMax ?? (Number(process.env.DB_POOL_MAX) || 5)));
  pool.on('error', (err) => {
    // Un cliente inactivo perdió la conexión: no debe tumbar el servidor.
    console.error('Postgres pool error:', err.message);
  });

  if (schema) {
    pool.on('connect', (client) => {
      client.query(`SET search_path TO "${schema}", public`).catch(() => undefined);
    });
    await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  }

  const exec = pool as unknown as Queryable;

  async function withTransaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client as unknown as Queryable);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // la conexión ya estaba rota; se ignora
      }
      throw err;
    } finally {
      client.release();
    }
  }

  if (options.autoMigrate !== false) {
    await pool.query(SCHEMA_SQL);
  }

  // -------------------------------------------------------------------------
  // Primer administrador (Nivel 2), desde variables de entorno
  // -------------------------------------------------------------------------
  async function seedRootAdmin(seed: SeedAdminOptions | undefined) {
    const ci = normalizeCI(seed?.ci || '');
    if (!seed || !ci || !seed.password) {
      const any = await exec.query('SELECT 1 FROM admins LIMIT 1');
      if (any.rows.length === 0) {
        console.warn(
          'No hay administradores en la base. Define ADMIN_CI y ADMIN_PASSWORD en el .env y reinicia el servidor.'
        );
      }
      return;
    }
    if (seed.password.length < 8) {
      throw new Error('ADMIN_PASSWORD debe tener al menos 8 caracteres.');
    }

    const existing = await exec.query('SELECT id FROM admins WHERE id = $1', [ci]);
    if (existing.rows.length > 0) return; // ya existe: no se toca su contraseña

    await exec.query(
      `INSERT INTO admins (id, ci, employee_number, full_name, email, level, role, password_hash, created_at, created_by)
       VALUES ($1, $2, $3, $4, $5, 2, 'administrador', $6, $7, NULL)
       ON CONFLICT DO NOTHING`,
      [
        ci,
        ci,
        (seed.employeeNumber || 'EMP-001').trim(),
        (seed.fullName || 'Administrador Municipal').trim(),
        seed.email?.trim() || null,
        await hashPassword(seed.password),
        new Date().toISOString()
      ]
    );
    console.log(`Administrador inicial creado (C.I. ${ci}).`);
  }

  await seedRootAdmin(options.seedAdmin);

  // -------------------------------------------------------------------------
  // Sesiones
  // -------------------------------------------------------------------------
  async function createSession(subjectType: 'citizen' | 'admin', subjectId: string): Promise<string> {
    const token = crypto.randomBytes(24).toString('hex');
    const now = new Date();
    const expires = new Date(now.getTime() + 14 * 24 * 3600 * 1000);
    await exec.query(
      `INSERT INTO sessions (token, subject_type, subject_id, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [token, subjectType, subjectId, now.toISOString(), expires.toISOString()]
    );
    return token;
  }

  async function resolveSession(token: string | undefined, expectedType: 'citizen' | 'admin'): Promise<string | null> {
    if (!token) return null;
    const { rows } = await exec.query<{ subject_id: string; expires_at: Ts }>(
      'SELECT subject_id, expires_at FROM sessions WHERE token = $1 AND subject_type = $2',
      [token, expectedType]
    );
    const row = rows[0];
    if (!row) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await exec.query('DELETE FROM sessions WHERE token = $1', [token]);
      return null;
    }
    return row.subject_id;
  }

  async function deleteSession(token: string | undefined): Promise<void> {
    if (!token) return;
    await exec.query('DELETE FROM sessions WHERE token = $1', [token]);
  }

  // -------------------------------------------------------------------------
  // Reportes
  // -------------------------------------------------------------------------
  async function getHistoryMap(q: Queryable, reportIds: string[]): Promise<Map<string, StatusHistoryEntry[]>> {
    const map = new Map<string, StatusHistoryEntry[]>();
    if (reportIds.length === 0) return map;

    const { rows } = await q.query<HistoryRow>(
      `SELECT id, report_id, "timestamp", previous_status, new_status, changed_by, notes
       FROM report_status_history
       WHERE report_id = ANY($1::text[])
       ORDER BY "timestamp" ASC`,
      [reportIds]
    );

    for (const h of rows) {
      const list = map.get(h.report_id) || [];
      list.push({
        id: h.id,
        timestamp: iso(h.timestamp),
        previousStatus: h.previous_status || undefined,
        newStatus: h.new_status,
        changedBy: h.changed_by,
        notes: h.notes || undefined
      });
      map.set(h.report_id, list);
    }
    return map;
  }

  async function listReports(filters?: ReportQueryFilters): Promise<IncidentReport[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    const add = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };

    if (filters?.date) clauses.push(`report_date = ${add(filters.date.trim())}`);
    if (filters?.month) clauses.push(`report_month = ${add(filters.month.trim())}`);
    if (filters?.status && filters.status !== 'Todos') clauses.push(`status = ${add(filters.status)}`);
    if (filters?.category && filters.category !== 'Todas') clauses.push(`category = ${add(filters.category)}`);
    if (filters?.barrio && filters.barrio !== 'Todos') clauses.push(`barrio = ${add(filters.barrio)}`);
    if (filters?.q && filters.q.trim() !== '') {
      const like = add(`%${filters.q.trim().toLowerCase()}%`);
      const fields = ['LOWER(id)', 'LOWER(address)', 'LOWER(barrio)', 'LOWER(description)'];
      if (filters.searchCitizen) fields.push('LOWER(citizen_name)');
      clauses.push(`(${fields.map((f) => `${f} LIKE ${like}`).join(' OR ')})`);
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows } = await exec.query<ReportRow>(
      `SELECT * FROM reports ${whereSql} ORDER BY created_at DESC`,
      params
    );

    const historyMap = await getHistoryMap(exec, rows.map((r) => r.id));
    return rows.map((row) => mapReport(row, historyMap.get(row.id) || []));
  }

  async function getReportById(id: string, q: Queryable = exec): Promise<IncidentReport | null> {
    const { rows } = await q.query<ReportRow>('SELECT * FROM reports WHERE id = $1', [id]);
    const row = rows[0];
    if (!row) return null;
    const historyMap = await getHistoryMap(q, [row.id]);
    return mapReport(row, historyMap.get(row.id) || []);
  }

  async function createReport(input: {
    category: IncidentCategory;
    description: string;
    photoUrl: string;
    location: { lat: number; lng: number; address: string; barrio: string };
    citizenId?: string;
    citizenName: string;
    citizenPhone?: string;
    severity: IncidentSeverity;
    createdAt?: string;
  }): Promise<IncidentReport> {
    return withTransaction(async (tx) => {
      const createdAt = input.createdAt || new Date().toISOString();
      const reportDate = toAsuncionDateKey(createdAt);
      const reportMonth = toAsuncionMonthKey(createdAt);
      const year = reportDate.slice(0, 4) || String(new Date().getFullYear());

      // Contador atómico por año: dos reportes simultáneos nunca reciben el mismo ID.
      const counter = await tx.query<{ last_seq: number }>(
        `INSERT INTO report_counters (year, last_seq) VALUES ($1, 1)
         ON CONFLICT (year) DO UPDATE SET last_seq = report_counters.last_seq + 1
         RETURNING last_seq`,
        [year]
      );
      const id = `ASU-${year}-${String(counter.rows[0].last_seq).padStart(3, '0')}`;

      let resolvedCitizenId: string | null = null;
      if (input.citizenId) {
        const cleanCI = normalizeCI(input.citizenId);
        if (cleanCI) {
          await tx.query(
            `INSERT INTO citizens (id, ci, full_name, phone, registered_at)
             VALUES ($1, $1, $2, $3, $4)
             ON CONFLICT (id) DO NOTHING`,
            [cleanCI, input.citizenName.trim(), input.citizenPhone?.trim() || null, createdAt]
          );
          resolvedCitizenId = cleanCI;
        }
      }

      await tx.query(
        `INSERT INTO reports (
           id, category, description, photo_url, lat, lng, address, barrio,
           citizen_id, citizen_name, citizen_phone, severity, status, resolution_notes,
           created_at, report_date, report_month, updated_at, resolved_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Pendiente', NULL, $13, $14, $15, $13, NULL)`,
        [
          id,
          input.category,
          input.description.trim(),
          input.photoUrl,
          input.location.lat,
          input.location.lng,
          input.location.address.trim(),
          input.location.barrio.trim(),
          resolvedCitizenId,
          input.citizenName.trim(),
          input.citizenPhone?.trim() || null,
          input.severity,
          createdAt,
          reportDate,
          reportMonth
        ]
      );

      await tx.query(
        `INSERT INTO report_status_history (id, report_id, "timestamp", previous_status, new_status, changed_by, notes)
         VALUES ($1, $2, $3, NULL, 'Pendiente', $4, $5)`,
        [
          `${id}-h-${Date.now()}`,
          id,
          createdAt,
          input.citizenName.trim(),
          'Reporte registrado en plataforma ciudadana.'
        ]
      );

      const created = await getReportById(id, tx);
      if (!created) throw new Error('Failed to retrieve created report');
      return created;
    });
  }

  async function updateReportStatus(
    id: string,
    newStatus: IncidentStatus,
    notes?: string,
    changedBy?: string
  ): Promise<IncidentReport | null> {
    return withTransaction(async (tx) => {
      const found = await tx.query<ReportRow>('SELECT * FROM reports WHERE id = $1 FOR UPDATE', [id]);
      const existing = found.rows[0];
      if (!existing) return null;

      const now = new Date().toISOString();
      const nextNotes = notes !== undefined ? notes : existing.resolution_notes;
      const nextResolvedAt =
        newStatus === 'Solucionado' ? (existing.resolved_at ? iso(existing.resolved_at) : now) : null;

      await tx.query(
        `UPDATE reports
         SET status = $1, updated_at = $2, resolution_notes = $3, resolved_at = $4
         WHERE id = $5`,
        [newStatus, now, nextNotes, nextResolvedAt, id]
      );

      await tx.query(
        `INSERT INTO report_status_history (id, report_id, "timestamp", previous_status, new_status, changed_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          `${id}-h-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          id,
          now,
          existing.status,
          newStatus,
          changedBy || 'Dirección de Obras Municipales',
          notes ?? null
        ]
      );

      return getReportById(id, tx);
    });
  }

  async function bulkUpdateReportsStatus(
    ids: string[],
    newStatus: IncidentStatus,
    notes?: string,
    changedBy?: string
  ): Promise<number> {
    const uniqueIds = [...new Set((ids || []).filter((x): x is string => typeof x === 'string'))];
    if (uniqueIds.length === 0) return 0;

    return withTransaction(async (tx) => {
      const now = new Date().toISOString();
      let updatedCount = 0;

      for (const id of uniqueIds) {
        const found = await tx.query<ReportRow>('SELECT * FROM reports WHERE id = $1 FOR UPDATE', [id]);
        const existing = found.rows[0];
        if (!existing) continue;
        updatedCount++;

        const finalNote =
          notes !== undefined && notes.trim() !== ''
            ? notes.trim()
            : existing.resolution_notes || 'Solucionado en lote por cuadrilla vial municipal';
        const resolvedAt =
          newStatus === 'Solucionado' ? (existing.resolved_at ? iso(existing.resolved_at) : now) : null;

        await tx.query(
          `UPDATE reports
           SET status = $1, updated_at = $2, resolution_notes = $3, resolved_at = $4
           WHERE id = $5`,
          [newStatus, now, finalNote, resolvedAt, id]
        );
        await tx.query(
          `INSERT INTO report_status_history (id, report_id, "timestamp", previous_status, new_status, changed_by, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            `${id}-h-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
            id,
            now,
            existing.status,
            newStatus,
            changedBy || 'Cuadrilla Vial Municipal (Lote)',
            finalNote
          ]
        );
      }

      return updatedCount;
    });
  }

  async function deleteReport(id: string): Promise<boolean> {
    const res = await exec.query('DELETE FROM reports WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // -------------------------------------------------------------------------
  // Ciudadanos
  // -------------------------------------------------------------------------
  async function registerCitizen(input: {
    cedula: string;
    fullName: string;
    phone?: string;
  }): Promise<{ success: boolean; error?: string; citizen?: CitizenUser; token?: string }> {
    const validation = validateCitizenRegistration(input);
    if (!validation.valid || !validation.data) {
      return { success: false, error: validation.error || 'Datos inválidos.' };
    }

    const { id, ci, fullName, phone } = validation.data;
    const now = new Date().toISOString();

    const { rows } = await exec.query<CitizenRow>(
      `INSERT INTO citizens (id, ci, full_name, phone, registered_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         phone = EXCLUDED.phone
       RETURNING *`,
      [id, ci, fullName, phone || null, now]
    );

    const citizen = mapCitizen(rows[0]);
    const token = await createSession('citizen', citizen.id);
    return { success: true, citizen, token };
  }

  async function getCitizenBySession(token: string | undefined): Promise<CitizenUser | null> {
    const citizenId = await resolveSession(token, 'citizen');
    if (!citizenId) return null;
    const { rows } = await exec.query<CitizenRow>('SELECT * FROM citizens WHERE id = $1', [citizenId]);
    return rows[0] ? mapCitizen(rows[0]) : null;
  }

  // -------------------------------------------------------------------------
  // Administradores
  // -------------------------------------------------------------------------
  async function loginAdmin(
    identifier: string,
    password: string
  ): Promise<{ success: boolean; error?: string; admin?: AdminUser; token?: string }> {
    const raw = identifier.trim();
    const normalizedEmail = raw.toLowerCase();
    const normalizedCI = normalizeCI(raw) || '';

    const { rows } = await exec.query<AdminRow>(
      `SELECT * FROM admins
       WHERE ($1::text <> '' AND ci = $1::text)
          OR (email IS NOT NULL AND LOWER(email) = $2::text)`,
      [normalizedCI, normalizedEmail]
    );
    const matched = rows.find((acc) => normalizedCI && acc.ci === normalizedCI) || rows[0];

    if (!matched || !(await verifyPassword(password, matched.password_hash))) {
      return {
        success: false,
        error: 'Credenciales no autorizadas. Verifica tu C.I. / correo institucional y contraseña.'
      };
    }

    const token = await createSession('admin', matched.id);
    return { success: true, admin: mapAdminUser(matched, token), token };
  }

  async function getAdminBySession(token: string | undefined): Promise<AdminUser | null> {
    const adminId = await resolveSession(token, 'admin');
    if (!adminId) return null;
    const { rows } = await exec.query<AdminRow>('SELECT * FROM admins WHERE id = $1', [adminId]);
    if (!rows[0]) return null;
    return mapAdminUser(rows[0], token!);
  }

  async function listAdminAccounts(): Promise<AdminAccountPublic[]> {
    const { rows } = await exec.query<AdminRow>('SELECT * FROM admins ORDER BY created_at DESC');
    return rows.map(mapAdminPublic);
  }

  async function createAdminAccount(
    input: {
      ci: string;
      employeeNumber: string;
      fullName: string;
      level: AdminLevel;
      password: string;
      email?: string;
    },
    actorAdmin: AdminUser | null
  ): Promise<{ success: boolean; error?: string; account?: AdminAccountPublic }> {
    if (!actorAdmin || actorAdmin.level !== 2) {
      return {
        success: false,
        error: 'Acceso denegado: Solo los perfiles administrativos de Nivel 2 pueden crear nuevos perfiles.'
      };
    }

    const validation = validateAdminRegistration(input);
    if (!validation.valid || !validation.data) {
      return { success: false, error: validation.error || 'Datos inválidos.' };
    }

    const { id, ci, employeeNumber, fullName, level, password, email } = validation.data;

    const existingCI = await exec.query('SELECT id FROM admins WHERE id = $1 OR ci = $2', [id, ci]);
    if (existingCI.rows.length > 0) {
      return { success: false, error: `Ya existe un perfil administrativo registrado con el C.I. ${ci}.` };
    }

    const existingEmp = await exec.query('SELECT id FROM admins WHERE LOWER(employee_number) = LOWER($1)', [
      employeeNumber
    ]);
    if (existingEmp.rows.length > 0) {
      return {
        success: false,
        error: `El Número de Empleado "${employeeNumber}" ya está asignado a otro perfil.`
      };
    }

    if (email) {
      const existingEmail = await exec.query('SELECT id FROM admins WHERE LOWER(email) = LOWER($1)', [email]);
      if (existingEmail.rows.length > 0) {
        return { success: false, error: `El correo "${email}" ya se encuentra registrado.` };
      }
    }

    const createdAt = new Date().toISOString();
    const role: AdminAccountPublic['role'] = level === 2 ? 'administrador' : 'analista';
    const createdBy = `${actorAdmin.fullName} (C.I. ${actorAdmin.ci})`;

    try {
      const { rows } = await exec.query<AdminRow>(
        `INSERT INTO admins (id, ci, employee_number, full_name, email, level, role, password_hash, created_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [id, ci, employeeNumber, fullName, email || null, level, role, await hashPassword(password), createdAt, createdBy]
      );
      return { success: true, account: mapAdminPublic(rows[0]) };
    } catch (err) {
      // 23505 = dato duplicado (dos personas creando el mismo perfil a la vez)
      if ((err as { code?: string }).code === '23505') {
        return { success: false, error: 'Ya existe un perfil con esos datos (C.I., número de empleado o correo).' };
      }
      throw err;
    }
  }

  async function deleteAdminAccount(
    targetId: string,
    actorAdmin: AdminUser | null
  ): Promise<{ success: boolean; error?: string }> {
    if (!actorAdmin || actorAdmin.level !== 2) {
      return { success: false, error: 'Solo perfiles Nivel 2 pueden eliminar cuentas administrativas.' };
    }
    if (actorAdmin.id === targetId) {
      return { success: false, error: 'No puedes eliminar tu propio perfil mientras estás conectado.' };
    }

    const { rows } = await exec.query<{ created_by: string | null }>(
      'SELECT created_by FROM admins WHERE id = $1',
      [targetId]
    );
    if (rows.length === 0) {
      return { success: false, error: 'La cuenta administrativa no existe.' };
    }
    // La cuenta principal (creada desde ADMIN_CI en el .env) es la única sin "created_by".
    if (rows[0].created_by === null) {
      return { success: false, error: 'No se puede eliminar la cuenta administrativa principal del sistema.' };
    }

    await withTransaction(async (tx) => {
      await tx.query("DELETE FROM sessions WHERE subject_type = 'admin' AND subject_id = $1", [targetId]);
      await tx.query('DELETE FROM admins WHERE id = $1', [targetId]);
    });

    return { success: true };
  }

  async function ping(): Promise<void> {
    await exec.query('SELECT 1');
  }

  async function close(opts: { dropSchema?: boolean } = {}): Promise<void> {
    if (opts.dropSchema && schema) {
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
    await pool.end();
  }

  return {
    listReports,
    getReportById: (id: string) => getReportById(id),
    createReport,
    updateReportStatus,
    bulkUpdateReportsStatus,
    deleteReport,
    registerCitizen,
    getCitizenBySession,
    loginAdmin,
    getAdminBySession,
    listAdminAccounts,
    createAdminAccount,
    deleteAdminAccount,
    deleteSession,
    ping,
    close
  };
}
