import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
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

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

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
  created_at: string;
  report_date: string;
  report_month: string;
  updated_at: string;
  resolved_at: string | null;
}

interface HistoryRow {
  id: string;
  report_id: string;
  timestamp: string;
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
  created_at: string;
  created_by: string | null;
}

interface CitizenRow {
  id: string;
  ci: string;
  full_name: string;
  phone: string | null;
  registered_at: string;
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
    createdAt: row.created_at,
    createdBy: row.created_by || undefined
  };
}

function mapCitizen(row: CitizenRow): CitizenUser {
  return {
    id: row.id,
    ci: row.ci,
    fullName: row.full_name,
    phone: row.phone || undefined,
    registeredAt: row.registered_at
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
    createdAt: row.created_at,
    reportDate: row.report_date,
    reportMonth: row.report_month,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at || undefined,
    statusHistory: history
  };
}

export function createAsuncionDb(dbPath: string) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS citizens (
      id TEXT PRIMARY KEY,
      ci TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      phone TEXT,
      registered_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      ci TEXT NOT NULL UNIQUE,
      employee_number TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE,
      level INTEGER NOT NULL CHECK (level IN (1, 2)),
      role TEXT NOT NULL CHECK (role IN ('analista', 'supervisor', 'administrador')),
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      subject_type TEXT NOT NULL CHECK (subject_type IN ('citizen', 'admin')),
      subject_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL CHECK (category IN ('Bache', 'Badén en mal estado', 'Alcantarilla sin tapa', 'Suciedad / Basura')),
      description TEXT NOT NULL,
      photo_url TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      address TEXT NOT NULL,
      barrio TEXT NOT NULL,
      citizen_id TEXT REFERENCES citizens(id) ON UPDATE CASCADE ON DELETE SET NULL,
      citizen_name TEXT NOT NULL,
      citizen_phone TEXT,
      severity TEXT NOT NULL CHECK (severity IN ('Baja', 'Media', 'Alta', 'Crítica')),
      status TEXT NOT NULL CHECK (status IN ('Pendiente', 'En revisión', 'Solucionado')),
      resolution_notes TEXT,
      created_at TEXT NOT NULL,
      report_date TEXT NOT NULL,
      report_month TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS report_status_history (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      timestamp TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT NOT NULL CHECK (new_status IN ('Pendiente', 'En revisión', 'Solucionado')),
      changed_by TEXT NOT NULL,
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
    CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);
    CREATE INDEX IF NOT EXISTS idx_reports_barrio ON reports(barrio);
    CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(report_date);
    CREATE INDEX IF NOT EXISTS idx_reports_month ON reports(report_month);
    CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_history_report_id ON report_status_history(report_id, timestamp ASC);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  `);

  function runInTransaction<T>(fn: () => T): T {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  // Seed root Nivel 2 admin if missing
  const rootExists = db.prepare('SELECT id FROM admins WHERE id = ?').get('1000001') as { id: string } | undefined;
  if (!rootExists) {
    db.prepare(`
      INSERT INTO admins (id, ci, employee_number, full_name, email, level, role, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      '1000001',
      '1000001',
      'EMP-001',
      'Ing. Mario Arzamendia',
      'admin@asuncion.gov.py',
      2,
      'administrador',
      hashPassword('admin123'),
      '2026-01-01T08:00:00.000Z'
    );
  }

  // Seed initial municipal reports only if reports table is completely empty
  const reportCountRow = db.prepare('SELECT COUNT(*) AS count FROM reports').get() as { count: number };
  if (reportCountRow.count === 0) {
    runInTransaction(() => {
      const insertReport = db.prepare(`
        INSERT INTO reports (
          id, category, description, photo_url, lat, lng, address, barrio,
          citizen_id, citizen_name, citizen_phone, severity, status, resolution_notes,
          created_at, report_date, report_month, updated_at, resolved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertHistory = db.prepare(`
        INSERT INTO report_status_history (
          id, report_id, timestamp, previous_status, new_status, changed_by, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      // Offset two solved/older seed reports slightly into the prior month so month filtering works out-of-the-box
      const priorMonthDate = new Date();
      priorMonthDate.setMonth(priorMonthDate.getMonth() - 1);
      priorMonthDate.setDate(18);
      const priorMonthIso = priorMonthDate.toISOString();

      INITIAL_REPORTS.forEach((rep, idx) => {
        const createdAt = idx >= 5 ? priorMonthIso : rep.createdAt;
        const updatedAt = idx >= 5 && rep.resolvedAt ? rep.resolvedAt : (idx >= 5 ? priorMonthIso : rep.updatedAt);
        const resolvedAt = rep.resolvedAt || null;
        const reportDate = toAsuncionDateKey(createdAt);
        const reportMonth = toAsuncionMonthKey(createdAt);

        insertReport.run(
          rep.id,
          rep.category,
          rep.description,
          rep.photoUrl,
          rep.location.lat,
          rep.location.lng,
          rep.location.address,
          rep.location.barrio,
          null,
          rep.citizenName,
          rep.citizenPhone || null,
          rep.severity,
          rep.status,
          rep.resolutionNotes || null,
          createdAt,
          reportDate,
          reportMonth,
          updatedAt,
          resolvedAt
        );

        insertHistory.run(
          `${rep.id}-h1`,
          rep.id,
          createdAt,
          null,
          'Pendiente',
          rep.citizenName,
          'Reporte registrado en plataforma ciudadana.'
        );

        if (rep.status !== 'Pendiente') {
          insertHistory.run(
            `${rep.id}-h2`,
            rep.id,
            updatedAt,
            'Pendiente',
            rep.status,
            'Dirección de Obras Municipales',
            rep.resolutionNotes || `Estado actualizado a ${rep.status}.`
          );
        }
      });
    });
  }

  function createSession(subjectType: 'citizen' | 'admin', subjectId: string): string {
    const token = crypto.randomBytes(24).toString('hex');
    const now = new Date();
    const expires = new Date(now.getTime() + 14 * 24 * 3600 * 1000);
    db.prepare(`
      INSERT INTO sessions (token, subject_type, subject_id, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(token, subjectType, subjectId, now.toISOString(), expires.toISOString());
    return token;
  }

  function resolveSession(token: string | undefined, expectedType: 'citizen' | 'admin'): string | null {
    if (!token) return null;
    const row = db
      .prepare('SELECT subject_id, expires_at FROM sessions WHERE token = ? AND subject_type = ?')
      .get(token, expectedType) as { subject_id: string; expires_at: string } | undefined;
    if (!row) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      return null;
    }
    return row.subject_id;
  }

  function deleteSession(token: string | undefined) {
    if (!token) return;
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }

  function getHistoryMap(reportIds: string[]): Map<string, StatusHistoryEntry[]> {
    const map = new Map<string, StatusHistoryEntry[]>();
    if (reportIds.length === 0) return map;

    const placeholders = reportIds.map(() => '?').join(',');
    const rows = db
      .prepare(
        `SELECT id, report_id, timestamp, previous_status, new_status, changed_by, notes
         FROM report_status_history
         WHERE report_id IN (${placeholders})
         ORDER BY timestamp ASC`
      )
      .all(...reportIds) as unknown as HistoryRow[];

    for (const h of rows) {
      const list = map.get(h.report_id) || [];
      list.push({
        id: h.id,
        timestamp: h.timestamp,
        previousStatus: h.previous_status || undefined,
        newStatus: h.new_status,
        changedBy: h.changed_by,
        notes: h.notes || undefined
      });
      map.set(h.report_id, list);
    }
    return map;
  }

  function listReports(filters?: ReportQueryFilters): IncidentReport[] {
    const clauses: string[] = [];
    const params: (string | number)[] = [];

    if (filters?.date) {
      clauses.push('report_date = ?');
      params.push(filters.date.trim());
    }
    if (filters?.month) {
      clauses.push('report_month = ?');
      params.push(filters.month.trim());
    }
    if (filters?.status && filters.status !== 'Todos') {
      clauses.push('status = ?');
      params.push(filters.status);
    }
    if (filters?.category && filters.category !== 'Todas') {
      clauses.push('category = ?');
      params.push(filters.category);
    }
    if (filters?.barrio && filters.barrio !== 'Todos') {
      clauses.push('barrio = ?');
      params.push(filters.barrio);
    }
    if (filters?.q && filters.q.trim() !== '') {
      const like = `%${filters.q.trim().toLowerCase()}%`;
      if (filters.searchCitizen) {
        clauses.push(
          '(LOWER(id) LIKE ? OR LOWER(citizen_name) LIKE ? OR LOWER(address) LIKE ? OR LOWER(barrio) LIKE ? OR LOWER(description) LIKE ?)'
        );
        params.push(like, like, like, like, like);
      } else {
        clauses.push(
          '(LOWER(id) LIKE ? OR LOWER(address) LIKE ? OR LOWER(barrio) LIKE ? OR LOWER(description) LIKE ?)'
        );
        params.push(like, like, like, like);
      }
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db
      .prepare(`SELECT * FROM reports ${whereSql} ORDER BY created_at DESC`)
      .all(...params) as unknown as ReportRow[];

    const historyMap = getHistoryMap(rows.map((r) => r.id));
    return rows.map((row) => mapReport(row, historyMap.get(row.id) || []));
  }

  function getReportById(id: string): IncidentReport | null {
    const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as unknown as ReportRow | undefined;
    if (!row) return null;
    const historyMap = getHistoryMap([row.id]);
    return mapReport(row, historyMap.get(row.id) || []);
  }

  function createReport(input: {
    category: IncidentCategory;
    description: string;
    photoUrl: string;
    location: { lat: number; lng: number; address: string; barrio: string };
    citizenId?: string;
    citizenName: string;
    citizenPhone?: string;
    severity: IncidentSeverity;
    createdAt?: string;
  }): IncidentReport {
    return runInTransaction(() => {
      const createdAt = input.createdAt || new Date().toISOString();
      const reportDate = toAsuncionDateKey(createdAt);
      const reportMonth = toAsuncionMonthKey(createdAt);
      const year = reportDate.slice(0, 4) || String(new Date().getFullYear());

      const existingYearRows = db
        .prepare('SELECT id FROM reports WHERE id LIKE ?')
        .all(`ASU-${year}-%`) as { id: string }[];
      let maxSeq = 0;
      for (const r of existingYearRows) {
        const suffix = Number(r.id.split('-')[2]);
        if (!Number.isNaN(suffix) && suffix > maxSeq) maxSeq = suffix;
      }
      const id = `ASU-${year}-${String(maxSeq + 1).padStart(3, '0')}`;

      let resolvedCitizenId: string | null = null;
      if (input.citizenId) {
        const cleanCI = normalizeCI(input.citizenId);
        if (cleanCI) {
          const citizenRow = db.prepare('SELECT id FROM citizens WHERE id = ?').get(cleanCI) as
            | { id: string }
            | undefined;
          if (!citizenRow) {
            db.prepare(
              'INSERT INTO citizens (id, ci, full_name, phone, registered_at) VALUES (?, ?, ?, ?, ?)'
            ).run(cleanCI, cleanCI, input.citizenName.trim(), input.citizenPhone?.trim() || null, createdAt);
          }
          resolvedCitizenId = cleanCI;
        }
      }

      db.prepare(`
        INSERT INTO reports (
          id, category, description, photo_url, lat, lng, address, barrio,
          citizen_id, citizen_name, citizen_phone, severity, status, resolution_notes,
          created_at, report_date, report_month, updated_at, resolved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente', NULL, ?, ?, ?, ?, NULL)
      `).run(
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
        reportMonth,
        createdAt
      );

      db.prepare(`
        INSERT INTO report_status_history (
          id, report_id, timestamp, previous_status, new_status, changed_by, notes
        ) VALUES (?, ?, ?, NULL, 'Pendiente', ?, ?)
      `).run(
        `${id}-h-${Date.now()}`,
        id,
        createdAt,
        input.citizenName.trim(),
        'Reporte registrado en plataforma ciudadana.'
      );

      const created = getReportById(id);
      if (!created) throw new Error('Failed to retrieve created report');
      return created;
    });
  }

  function updateReportStatus(
    id: string,
    newStatus: IncidentStatus,
    notes?: string,
    changedBy?: string
  ): IncidentReport | null {
    return runInTransaction(() => {
      const existing = db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as unknown as ReportRow | undefined;
      if (!existing) return null;

      const now = new Date().toISOString();
      const nextNotes = notes !== undefined ? notes : existing.resolution_notes;
      const nextResolvedAt =
        newStatus === 'Solucionado' ? existing.resolved_at || now : null;

      db.prepare(`
        UPDATE reports
        SET status = ?, updated_at = ?, resolution_notes = ?, resolved_at = ?
        WHERE id = ?
      `).run(newStatus, now, nextNotes, nextResolvedAt, id);

      db.prepare(`
        INSERT INTO report_status_history (
          id, report_id, timestamp, previous_status, new_status, changed_by, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        `${id}-h-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        id,
        now,
        existing.status,
        newStatus,
        changedBy || 'Dirección de Obras Municipales',
        notes ?? null
      );

      return getReportById(id);
    });
  }

  function bulkUpdateReportsStatus(
    ids: string[],
    newStatus: IncidentStatus,
    notes?: string,
    changedBy?: string
  ): number {
    if (!ids || ids.length === 0) return 0;

    return runInTransaction(() => {
      const now = new Date().toISOString();
      let updatedCount = 0;

      const selectStmt = db.prepare('SELECT * FROM reports WHERE id = ?');
      const updateStmt = db.prepare(`
        UPDATE reports
        SET status = ?, updated_at = ?, resolution_notes = ?, resolved_at = ?
        WHERE id = ?
      `);
      const historyStmt = db.prepare(`
        INSERT INTO report_status_history (
          id, report_id, timestamp, previous_status, new_status, changed_by, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const id of ids) {
        const existing = selectStmt.get(id) as unknown as ReportRow | undefined;
        if (!existing) continue;
        updatedCount++;

        const finalNote =
          notes !== undefined && notes.trim() !== ''
            ? notes.trim()
            : existing.resolution_notes || 'Solucionado en lote por cuadrilla vial municipal';
        const resolvedAt =
          newStatus === 'Solucionado' ? existing.resolved_at || now : null;

        updateStmt.run(newStatus, now, finalNote, resolvedAt, id);
        historyStmt.run(
          `${id}-h-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          id,
          now,
          existing.status,
          newStatus,
          changedBy || 'Cuadrilla Vial Municipal (Lote)',
          finalNote
        );
      }

      return updatedCount;
    });
  }

  function deleteReport(id: string): boolean {
    const res = db.prepare('DELETE FROM reports WHERE id = ?').run(id);
    return Number(res.changes) > 0;
  }

  function registerCitizen(input: {
    cedula: string;
    fullName: string;
    phone?: string;
  }): { success: boolean; error?: string; citizen?: CitizenUser; token?: string } {
    const validation = validateCitizenRegistration(input);
    if (!validation.valid || !validation.data) {
      return { success: false, error: validation.error || 'Datos inválidos.' };
    }

    const { id, ci, fullName, phone } = validation.data;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO citizens (id, ci, full_name, phone, registered_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        full_name = excluded.full_name,
        phone = excluded.phone
    `).run(id, ci, fullName, phone || null, now);

    const row = db.prepare('SELECT * FROM citizens WHERE id = ?').get(id) as unknown as CitizenRow;
    const citizen = mapCitizen(row);
    const token = createSession('citizen', citizen.id);
    return { success: true, citizen, token };
  }

  function getCitizenBySession(token: string | undefined): CitizenUser | null {
    const citizenId = resolveSession(token, 'citizen');
    if (!citizenId) return null;
    const row = db.prepare('SELECT * FROM citizens WHERE id = ?').get(citizenId) as unknown as CitizenRow | undefined;
    return row ? mapCitizen(row) : null;
  }

  function loginAdmin(
    identifier: string,
    password: string
  ): { success: boolean; error?: string; admin?: AdminUser; token?: string } {
    const raw = identifier.trim();
    const normalizedEmail = raw.toLowerCase();
    const normalizedCI = normalizeCI(raw);

    const accounts = db.prepare('SELECT * FROM admins').all() as unknown as AdminRow[];
    const matched = accounts.find((acc) => {
      if (normalizedCI && acc.ci === normalizedCI) return true;
      if (acc.email && acc.email.toLowerCase() === normalizedEmail) return true;
      if (normalizedEmail === 'admin' && acc.email === 'admin@asuncion.gov.py') return true;
      return false;
    });

    if (!matched || !verifyPassword(password, matched.password_hash)) {
      return {
        success: false,
        error: 'Credenciales no autorizadas. Verifica tu C.I. / correo institucional y contraseña.'
      };
    }

    const token = createSession('admin', matched.id);
    const admin: AdminUser = {
      id: matched.id,
      ci: matched.ci,
      employeeNumber: matched.employee_number,
      email: matched.email || `ci.${matched.ci}@asuncion.gov.py`,
      fullName: matched.full_name,
      level: matched.level === 2 ? 2 : 1,
      role: matched.role,
      token,
      createdAt: matched.created_at
    };

    return { success: true, admin, token };
  }

  function getAdminBySession(token: string | undefined): AdminUser | null {
    const adminId = resolveSession(token, 'admin');
    if (!adminId) return null;
    const row = db.prepare('SELECT * FROM admins WHERE id = ?').get(adminId) as unknown as AdminRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      ci: row.ci,
      employeeNumber: row.employee_number,
      email: row.email || `ci.${row.ci}@asuncion.gov.py`,
      fullName: row.full_name,
      level: row.level === 2 ? 2 : 1,
      role: row.role,
      token: token!,
      createdAt: row.created_at
    };
  }

  function listAdminAccounts(): AdminAccountPublic[] {
    const rows = db
      .prepare('SELECT * FROM admins ORDER BY created_at DESC')
      .all() as unknown as AdminRow[];
    return rows.map(mapAdminPublic);
  }

  function createAdminAccount(
    input: {
      ci: string;
      employeeNumber: string;
      fullName: string;
      level: AdminLevel;
      password: string;
      email?: string;
    },
    actorAdmin: AdminUser | null
  ): { success: boolean; error?: string; account?: AdminAccountPublic } {
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

    const existingCI = db.prepare('SELECT id FROM admins WHERE id = ? OR ci = ?').get(id, ci);
    if (existingCI) {
      return {
        success: false,
        error: `Ya existe un perfil administrativo registrado con el C.I. ${ci}.`
      };
    }

    const existingEmp = db
      .prepare('SELECT id FROM admins WHERE LOWER(employee_number) = LOWER(?)')
      .get(employeeNumber);
    if (existingEmp) {
      return {
        success: false,
        error: `El Número de Empleado "${employeeNumber}" ya está asignado a otro perfil.`
      };
    }

    if (email) {
      const existingEmail = db
        .prepare('SELECT id FROM admins WHERE LOWER(email) = LOWER(?)')
        .get(email);
      if (existingEmail) {
        return {
          success: false,
          error: `El correo "${email}" ya se encuentra registrado.`
        };
      }
    }

    const createdAt = new Date().toISOString();
    const role: AdminAccountPublic['role'] = level === 2 ? 'administrador' : 'analista';
    const createdBy = `${actorAdmin.fullName} (C.I. ${actorAdmin.ci})`;

    db.prepare(`
      INSERT INTO admins (id, ci, employee_number, full_name, email, level, role, password_hash, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      ci,
      employeeNumber,
      fullName,
      email || null,
      level,
      role,
      hashPassword(password),
      createdAt,
      createdBy
    );

    const row = db.prepare('SELECT * FROM admins WHERE id = ?').get(id) as unknown as AdminRow;
    return { success: true, account: mapAdminPublic(row) };
  }

  function deleteAdminAccount(
    targetId: string,
    actorAdmin: AdminUser | null
  ): { success: boolean; error?: string } {
    if (!actorAdmin || actorAdmin.level !== 2) {
      return {
        success: false,
        error: 'Solo perfiles Nivel 2 pueden eliminar cuentas administrativas.'
      };
    }
    if (actorAdmin.id === targetId) {
      return {
        success: false,
        error: 'No puedes eliminar tu propio perfil mientras estás conectado.'
      };
    }
    if (targetId === '1000001') {
      return {
        success: false,
        error: 'No se puede eliminar la cuenta administrativa principal del sistema.'
      };
    }

    runInTransaction(() => {
      db.prepare("DELETE FROM sessions WHERE subject_type = 'admin' AND subject_id = ?").run(targetId);
      db.prepare('DELETE FROM admins WHERE id = ?').run(targetId);
    });

    return { success: true };
  }

  function close() {
    db.close();
  }

  return {
    dbPath,
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
    close
  };
}
