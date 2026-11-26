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
import { INITIAL_REPORTS } from '../src/data/mockReports.ts';

const { Pool } = pg;
const scrypt = promisify(crypto.scrypt) as (password: string, salt: string, keylen: number) => Promise<Buffer>;

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

export interface AsuncionDbOptions {
  /** Cadena de conexión de Postgres (Supabase: "Transaction pooler"). */
  connectionString: string;
  /** Esquema donde viven las tablas. Por defecto "public". Los tests usan uno temporal. */
  schema?: string;
  /** Forzar SSL on/off. Por defecto: activado salvo que el host sea local. */
  ssl?: boolean;
  /** Tamaño máximo del pool de conexiones. */
  max?: number;
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)).toString('hex');
  return `${salt}:${derived}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  const derived = await scrypt(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

// Las columnas timestamptz llegan como Date; la app trabaja con strings ISO.
type Ts = Date | string;
const iso = (v: Ts): string => (v instanceof Date ? v.toISOString() : new Date(v).toISOString());
const isoOrNull = (v: Ts | null): string | null => (v == null ? null : iso(v));

type ReportRow = {
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
};

type HistoryRow = {
  id: string;
  report_id: string;
  timestamp: Ts;
  previous_status: IncidentStatus | null;
  new_status: IncidentStatus;
  changed_by: string;
  notes: string | null;
};

type AdminRow = {
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
};

type CitizenRow = {
  id: string;
  ci: string;
  full_name: string;
  phone: string | null;
  registered_at: Ts;
};

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
    resolvedAt: isoOrNull(row.resolved_at) || undefined,
    statusHistory: history
  };
}

/** Los comodines % y _ del texto buscado se tratan como texto literal. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

/** El driver parsea sslmode del URL y pisaría nuestra configuración SSL: lo quitamos y lo decidimos nosotros. */
function stripSslMode(url: string): string {
  return url.replace(/([?&])sslmode=[^&]*&?/i, '$1').replace(/[?&]$/, '');
}

const SEED_LOCK_ID = 727001; // candado para que dos instancias no siembren datos a la vez

export async function createAsuncionDb(options: AsuncionDbOptions) {
  const schema = options.schema || 'public';
  if (!/^[a-z_][a-z0-9_]*$/i.test(schema)) {
    throw new Error(`Nombre de esquema inválido: ${schema}`);
  }
  const S = `"${schema}"`;
  const T = {
    citizens: `${S}.citizens`,
    admins: `${S}.admins`,
    sessions: `${S}.sessions`,
    reports: `${S}.reports`,
    history: `${S}.report_status_history`,
    counters: `${S}.report_counters`
  };

  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(options.connectionString);
  const useSsl = options.ssl ?? !isLocal;

  const pool = new Pool({
    connectionString: stripSslMode(options.connectionString),
    // Supabase firma con su propia CA; sin ella no se puede verificar el certificado.
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: options.max ?? 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  });
  // Un error en una conexión ociosa no debe tumbar el servidor.
  pool.on('error', (err) => console.error('Error inesperado en el pool de Postgres:', err.message));

  type Q = Pick<pg.Pool | pg.PoolClient, 'query'>;

  async function inTransaction<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // la conexión ya estaba rota; el error original es el que importa
      }
      throw err;
    } finally {
      client.release();
    }
  }

  // ---------- Sesiones ----------
  async function createSession(subjectType: 'citizen' | 'admin', subjectId: string): Promise<string> {
    const token = crypto.randomBytes(24).toString('hex');
    const now = new Date();
    const expires = new Date(now.getTime() + 14 * 24 * 3600 * 1000);
    await pool.query(
      `insert into ${T.sessions} (token, subject_type, subject_id, created_at, expires_at) values ($1, $2, $3, $4, $5)`,
      [token, subjectType, subjectId, now.toISOString(), expires.toISOString()]
    );
    return token;
  }

  async function resolveSession(token: string | undefined, expectedType: 'citizen' | 'admin'): Promise<string | null> {
    if (!token) return null;
    const { rows } = await pool.query<{ subject_id: string; expires_at: Ts }>(
      `select subject_id, expires_at from ${T.sessions} where token = $1 and subject_type = $2`,
      [token, expectedType]
    );
    const row = rows[0];
    if (!row) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await pool.query(`delete from ${T.sessions} where token = $1`, [token]);
      return null;
    }
    return row.subject_id;
  }

  async function deleteSession(token: string | undefined): Promise<void> {
    if (!token) return;
    await pool.query(`delete from ${T.sessions} where token = $1`, [token]);
  }

  /** Borra sesiones vencidas (la tabla crecería sin límite). Devuelve cuántas eliminó. */
  async function purgeExpiredSessions(): Promise<number> {
    const res = await pool.query(`delete from ${T.sessions} where expires_at < now()`);
    return res.rowCount ?? 0;
  }

  // ---------- Reportes ----------
  async function getHistoryMap(q: Q, reportIds: string[]): Promise<Map<string, StatusHistoryEntry[]>> {
    const map = new Map<string, StatusHistoryEntry[]>();
    if (reportIds.length === 0) return map;

    const { rows } = await q.query<HistoryRow>(
      `select id, report_id, "timestamp", previous_status, new_status, changed_by, notes
       from ${T.history}
       where report_id = any($1::text[])
       order by "timestamp" asc, id asc`,
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

  async function fetchReport(q: Q, id: string): Promise<IncidentReport | null> {
    const { rows } = await q.query<ReportRow>(`select * from ${T.reports} where id = $1`, [id]);
    if (!rows[0]) return null;
    const historyMap = await getHistoryMap(q, [id]);
    return mapReport(rows[0], historyMap.get(id) || []);
  }

  async function listReports(filters?: ReportQueryFilters): Promise<IncidentReport[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    const p = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (filters?.date) clauses.push(`report_date = ${p(filters.date.trim())}`);
    if (filters?.month) clauses.push(`report_month = ${p(filters.month.trim())}`);
    if (filters?.status && filters.status !== 'Todos') clauses.push(`status = ${p(filters.status)}`);
    if (filters?.category && filters.category !== 'Todas') clauses.push(`category = ${p(filters.category)}`);
    if (filters?.barrio && filters.barrio !== 'Todos') clauses.push(`barrio = ${p(filters.barrio)}`);
    if (filters?.q && filters.q.trim() !== '') {
      const n = p(`%${escapeLike(filters.q.trim().toLowerCase())}%`);
      const fields = ['id', 'address', 'barrio', 'description'];
      if (filters.searchCitizen) fields.splice(1, 0, 'citizen_name');
      clauses.push(`(${fields.map((f) => `lower(${f}) like ${n}`).join(' or ')})`);
    }

    const whereSql = clauses.length > 0 ? `where ${clauses.join(' and ')}` : '';
    const { rows } = await pool.query<ReportRow>(
      `select * from ${T.reports} ${whereSql} order by created_at desc`,
      params
    );

    const historyMap = await getHistoryMap(pool, rows.map((r) => r.id));
    return rows.map((row) => mapReport(row, historyMap.get(row.id) || []));
  }

  async function getReportById(id: string): Promise<IncidentReport | null> {
    return fetchReport(pool, id);
  }

  // Siguiente número del año. La fila del contador queda bloqueada hasta el COMMIT, así que dos
  // reportes simultáneos nunca reciben el mismo ID. Además se "autocorrige" si ya hay reportes con
  // un número mayor (por ejemplo, importados a mano).
  const MAX_SEQ_SQL = `(select coalesce(max(split_part(id, '-', 3)::int), 0) from ${T.reports} where id ~ ('^ASU-' || $1::text || '-[0-9]+$'))`;
  async function nextReportSeq(c: pg.PoolClient, year: string): Promise<number> {
    const { rows } = await c.query<{ last_seq: number }>(
      `insert into ${T.counters} as rc (year, last_seq)
       values ($1::text, ${MAX_SEQ_SQL} + 1)
       on conflict (year) do update set last_seq = greatest(rc.last_seq, ${MAX_SEQ_SQL}) + 1
       returning last_seq`,
      [year]
    );
    return rows[0].last_seq;
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
    return inTransaction(async (c) => {
      const createdAt = input.createdAt || new Date().toISOString();
      const reportDate = toAsuncionDateKey(createdAt);
      const reportMonth = toAsuncionMonthKey(createdAt);
      const year = reportDate.slice(0, 4) || String(new Date().getFullYear());

      const seq = await nextReportSeq(c, year);
      const id = `ASU-${year}-${String(seq).padStart(3, '0')}`;

      let resolvedCitizenId: string | null = null;
      if (input.citizenId) {
        const cleanCI = normalizeCI(input.citizenId);
        if (cleanCI) {
          await c.query(
            `insert into ${T.citizens} (id, ci, full_name, phone, registered_at)
             values ($1, $2, $3, $4, $5)
             on conflict (id) do nothing`,
            [cleanCI, cleanCI, input.citizenName.trim(), input.citizenPhone?.trim() || null, createdAt]
          );
          resolvedCitizenId = cleanCI;
        }
      }

      await c.query(
        `insert into ${T.reports} (
           id, category, description, photo_url, lat, lng, address, barrio,
           citizen_id, citizen_name, citizen_phone, severity, status, resolution_notes,
           created_at, report_date, report_month, updated_at, resolved_at
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Pendiente', null, $13, $14, $15, $13, null)`,
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

      await c.query(
        `insert into ${T.history} (id, report_id, "timestamp", previous_status, new_status, changed_by, notes)
         values ($1, $2, $3, null, 'Pendiente', $4, $5)`,
        [
          `${id}-h-${Date.now()}`,
          id,
          createdAt,
          input.citizenName.trim(),
          'Reporte registrado en plataforma ciudadana.'
        ]
      );

      const created = await fetchReport(c, id);
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
    return inTransaction(async (c) => {
      const { rows } = await c.query<ReportRow>(`select * from ${T.reports} where id = $1 for update`, [id]);
      const existing = rows[0];
      if (!existing) return null;

      const now = new Date().toISOString();
      const nextNotes = notes !== undefined ? notes : existing.resolution_notes;
      const nextResolvedAt = newStatus === 'Solucionado' ? isoOrNull(existing.resolved_at) || now : null;

      await c.query(
        `update ${T.reports} set status = $1, updated_at = $2, resolution_notes = $3, resolved_at = $4 where id = $5`,
        [newStatus, now, nextNotes, nextResolvedAt, id]
      );

      await c.query(
        `insert into ${T.history} (id, report_id, "timestamp", previous_status, new_status, changed_by, notes)
         values ($1, $2, $3, $4, $5, $6, $7)`,
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

      return fetchReport(c, id);
    });
  }

  async function bulkUpdateReportsStatus(
    ids: string[],
    newStatus: IncidentStatus,
    notes?: string,
    changedBy?: string
  ): Promise<number> {
    if (!ids || ids.length === 0) return 0;

    return inTransaction(async (c) => {
      const now = new Date().toISOString();
      let updatedCount = 0;

      for (const id of ids) {
        const { rows } = await c.query<ReportRow>(`select * from ${T.reports} where id = $1 for update`, [id]);
        const existing = rows[0];
        if (!existing) continue;
        updatedCount++;

        const finalNote =
          notes !== undefined && notes.trim() !== ''
            ? notes.trim()
            : existing.resolution_notes || 'Solucionado en lote por cuadrilla vial municipal';
        const resolvedAt = newStatus === 'Solucionado' ? isoOrNull(existing.resolved_at) || now : null;

        await c.query(
          `update ${T.reports} set status = $1, updated_at = $2, resolution_notes = $3, resolved_at = $4 where id = $5`,
          [newStatus, now, finalNote, resolvedAt, id]
        );
        await c.query(
          `insert into ${T.history} (id, report_id, "timestamp", previous_status, new_status, changed_by, notes)
           values ($1, $2, $3, $4, $5, $6, $7)`,
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
    const res = await pool.query(`delete from ${T.reports} where id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // ---------- Ciudadanos ----------
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

    const { rows } = await pool.query<CitizenRow>(
      `insert into ${T.citizens} (id, ci, full_name, phone, registered_at)
       values ($1, $2, $3, $4, $5)
       on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone
       returning *`,
      [id, ci, fullName, phone || null, now]
    );
    const citizen = mapCitizen(rows[0]);
    const token = await createSession('citizen', citizen.id);
    return { success: true, citizen, token };
  }

  async function getCitizenBySession(token: string | undefined): Promise<CitizenUser | null> {
    const citizenId = await resolveSession(token, 'citizen');
    if (!citizenId) return null;
    const { rows } = await pool.query<CitizenRow>(`select * from ${T.citizens} where id = $1`, [citizenId]);
    return rows[0] ? mapCitizen(rows[0]) : null;
  }

  // ---------- Administradores ----------
  function toAdminUser(row: AdminRow, token: string): AdminUser {
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

  async function loginAdmin(
    identifier: string,
    password: string
  ): Promise<{ success: boolean; error?: string; admin?: AdminUser; token?: string }> {
    const raw = identifier.trim();
    const normalizedEmail = raw.toLowerCase();
    const normalizedCI = normalizeCI(raw) || '';

    const { rows } = await pool.query<AdminRow>(
      `select * from ${T.admins}
       where ($1::text <> '' and ci = $1::text)
          or (email is not null and lower(email) = $2::text)
          or ($2::text = 'admin' and email = 'admin@asuncion.gov.py')
       order by created_at asc
       limit 1`,
      [normalizedCI, normalizedEmail]
    );
    const matched = rows[0];

    if (!matched || !(await verifyPassword(password, matched.password_hash))) {
      return {
        success: false,
        error: 'Credenciales no autorizadas. Verifica tu C.I. / correo institucional y contraseña.'
      };
    }

    const token = await createSession('admin', matched.id);
    return { success: true, admin: toAdminUser(matched, token), token };
  }

  async function getAdminBySession(token: string | undefined): Promise<AdminUser | null> {
    const adminId = await resolveSession(token, 'admin');
    if (!adminId) return null;
    const { rows } = await pool.query<AdminRow>(`select * from ${T.admins} where id = $1`, [adminId]);
    return rows[0] ? toAdminUser(rows[0], token!) : null;
  }

  async function listAdminAccounts(): Promise<AdminAccountPublic[]> {
    const { rows } = await pool.query<AdminRow>(`select * from ${T.admins} order by created_at desc`);
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

    const existingCI = await pool.query(`select id from ${T.admins} where id = $1 or ci = $2`, [id, ci]);
    if (existingCI.rows.length > 0) {
      return { success: false, error: `Ya existe un perfil administrativo registrado con el C.I. ${ci}.` };
    }

    const existingEmp = await pool.query(`select id from ${T.admins} where lower(employee_number) = lower($1)`, [
      employeeNumber
    ]);
    if (existingEmp.rows.length > 0) {
      return { success: false, error: `El Número de Empleado "${employeeNumber}" ya está asignado a otro perfil.` };
    }

    if (email) {
      const existingEmail = await pool.query(`select id from ${T.admins} where lower(email) = lower($1)`, [email]);
      if (existingEmail.rows.length > 0) {
        return { success: false, error: `El correo "${email}" ya se encuentra registrado.` };
      }
    }

    const createdAt = new Date().toISOString();
    const role: AdminAccountPublic['role'] = level === 2 ? 'administrador' : 'analista';
    const createdBy = `${actorAdmin.fullName} (C.I. ${actorAdmin.ci})`;

    try {
      const { rows } = await pool.query<AdminRow>(
        `insert into ${T.admins} (id, ci, employee_number, full_name, email, level, role, password_hash, created_at, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         returning *`,
        [id, ci, employeeNumber, fullName, email || null, level, role, await hashPassword(password), createdAt, createdBy]
      );
      return { success: true, account: mapAdminPublic(rows[0]) };
    } catch (err) {
      // Dos altas simultáneas con los mismos datos: la restricción UNIQUE de la base lo detiene.
      if ((err as { code?: string })?.code === '23505') {
        return { success: false, error: 'Ya existe un perfil con esos datos (C.I., N° de empleado o correo).' };
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
    if (targetId === '1000001') {
      return { success: false, error: 'No se puede eliminar la cuenta administrativa principal del sistema.' };
    }

    await inTransaction(async (c) => {
      await c.query(`delete from ${T.sessions} where subject_type = 'admin' and subject_id = $1`, [targetId]);
      await c.query(`delete from ${T.admins} where id = $1`, [targetId]);
    });

    return { success: true };
  }

  // ---------- Datos iniciales ----------
  async function seed(): Promise<void> {
    // Administrador raíz Nivel 2 (idempotente; si ya existe no hace nada).
    const root = await pool.query(`select id from ${T.admins} where id = $1`, ['1000001']);
    if (root.rows.length === 0) {
      await pool.query(
        `insert into ${T.admins} (id, ci, employee_number, full_name, email, level, role, password_hash, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (id) do nothing`,
        [
          '1000001',
          '1000001',
          'EMP-001',
          'Ing. Mario Arzamendia',
          'admin@asuncion.gov.py',
          2,
          'administrador',
          await hashPassword('admin123'),
          '2026-01-01T08:00:00.000Z'
        ]
      );
    }

    // Reportes de ejemplo solo si la tabla está totalmente vacía. El candado evita que dos
    // instancias que arrancan a la vez los inserten duplicados.
    await inTransaction(async (c) => {
      await c.query('select pg_advisory_xact_lock($1)', [SEED_LOCK_ID]);
      const count = await c.query<{ count: number }>(`select count(*)::int as count from ${T.reports}`);
      if (count.rows[0].count > 0) return;

      // Se mueven dos reportes antiguos al mes anterior para que el filtro por mes funcione de entrada.
      const priorMonthDate = new Date();
      priorMonthDate.setMonth(priorMonthDate.getMonth() - 1);
      priorMonthDate.setDate(18);
      const priorMonthIso = priorMonthDate.toISOString();

      for (const [idx, rep] of INITIAL_REPORTS.entries()) {
        const createdAt = idx >= 5 ? priorMonthIso : rep.createdAt;
        const updatedAt = idx >= 5 && rep.resolvedAt ? rep.resolvedAt : idx >= 5 ? priorMonthIso : rep.updatedAt;
        const resolvedAt = rep.resolvedAt || null;

        await c.query(
          `insert into ${T.reports} (
             id, category, description, photo_url, lat, lng, address, barrio,
             citizen_id, citizen_name, citizen_phone, severity, status, resolution_notes,
             created_at, report_date, report_month, updated_at, resolved_at
           ) values ($1, $2, $3, $4, $5, $6, $7, $8, null, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
          [
            rep.id,
            rep.category,
            rep.description,
            rep.photoUrl,
            rep.location.lat,
            rep.location.lng,
            rep.location.address,
            rep.location.barrio,
            rep.citizenName,
            rep.citizenPhone || null,
            rep.severity,
            rep.status,
            rep.resolutionNotes || null,
            createdAt,
            toAsuncionDateKey(createdAt),
            toAsuncionMonthKey(createdAt),
            updatedAt,
            resolvedAt
          ]
        );

        await c.query(
          `insert into ${T.history} (id, report_id, "timestamp", previous_status, new_status, changed_by, notes)
           values ($1, $2, $3, null, 'Pendiente', $4, $5)`,
          [`${rep.id}-h1`, rep.id, createdAt, rep.citizenName, 'Reporte registrado en plataforma ciudadana.']
        );

        if (rep.status !== 'Pendiente') {
          await c.query(
            `insert into ${T.history} (id, report_id, "timestamp", previous_status, new_status, changed_by, notes)
             values ($1, $2, $3, 'Pendiente', $4, $5, $6)`,
            [
              `${rep.id}-h2`,
              rep.id,
              updatedAt,
              rep.status,
              'Dirección de Obras Municipales',
              rep.resolutionNotes || `Estado actualizado a ${rep.status}.`
            ]
          );
        }
      }

      // Los IDs de ejemplo (ASU-2026-001...) ya existen: el contador debe partir después de ellos.
      await c.query(
        `insert into ${T.counters} as rc (year, last_seq)
         select split_part(id, '-', 2), max(split_part(id, '-', 3)::int)
         from ${T.reports}
         where id ~ '^ASU-[0-9]{4}-[0-9]+$'
         group by split_part(id, '-', 2)
         on conflict (year) do update set last_seq = greatest(rc.last_seq, excluded.last_seq)`
      );
    });
  }

  try {
    await seed();
  } catch (err) {
    await pool.end().catch(() => {});
    if ((err as { code?: string })?.code === '42P01') {
      throw new Error(
        'No se encontraron las tablas en la base de datos. Ejecuta supabase/schema.sql en el SQL Editor de Supabase.'
      );
    }
    throw err;
  }

  async function ping(): Promise<boolean> {
    await pool.query('select 1');
    return true;
  }

  async function close(): Promise<void> {
    await pool.end();
  }

  return {
    listReports,
    getReportById,
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
    purgeExpiredSessions,
    ping,
    close
  };
}

export type AsuncionDb = Awaited<ReturnType<typeof createAsuncionDb>>;
