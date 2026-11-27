import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { createAsuncionDb } from './server/db.ts';
import crypto from 'node:crypto';
import type { IncidentCategory, IncidentStatus } from './src/types.ts';
import { citizenKey, serializeReport } from './server/privacy.ts';
import { validateReportInput } from './server/validation.ts';
import { createRateLimiter } from './server/rateLimit.ts';

const PORT = Number(process.env.PORT) || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

// Secreto para la clave opaca de ciudadano. Si no se define, se genera uno por arranque
// (el ranking sigue funcionando porque la clave solo se compara dentro de cada respuesta).
const CITIZEN_KEY_SECRET = process.env.CITIZEN_KEY_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.CITIZEN_KEY_SECRET) {
  console.warn('CITIZEN_KEY_SECRET no está definido: se usa un secreto temporal. Defínelo en producción.');
}

// En modo prueba se aceptan las fotos de muestra del formulario. Poner ALLOW_SAMPLE_PHOTOS=false en producción.
const ALLOW_SAMPLE_PHOTOS = process.env.ALLOW_SAMPLE_PHOTOS !== 'false';

// Límite de reportes: por IP y por cédula, en una hora.
const REPORTS_PER_HOUR = Number(process.env.REPORTS_PER_HOUR) || 10;
const ipLimiter = createRateLimiter(REPORTS_PER_HOUR, 60 * 60 * 1000);
const citizenLimiter = createRateLimiter(REPORTS_PER_HOUR, 60 * 60 * 1000);
setInterval(() => {
  ipLimiter.sweep();
  citizenLimiter.sweep();
}, 10 * 60 * 1000).unref();

const withCitizenKey = <T extends { id: string; fullName: string } | null>(citizen: T) =>
  citizen ? { ...citizen, citizenKey: citizenKey(CITIZEN_KEY_SECRET, citizen.id, citizen.fullName) } : citizen;

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      result[key] = decodeURIComponent(val);
    }
  }
  return result;
}

function getCitizenToken(req: Request): string | undefined {
  const headerToken = req.header('x-citizen-token');
  if (headerToken) return headerToken.trim();
  const cookies = parseCookies(req.headers.cookie);
  return cookies['asuncion_citizen_token'];
}

function getAdminToken(req: Request): string | undefined {
  const auth = req.header('authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  const headerToken = req.header('x-admin-token');
  if (headerToken) return headerToken.trim();
  const cookies = parseCookies(req.headers.cookie);
  return cookies['asuncion_admin_token'];
}

function setSessionCookie(res: Response, name: string, value: string, maxAgeSeconds = 14 * 24 * 3600) {
  res.append(
    'Set-Cookie',
    `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`
  );
}

function clearSessionCookie(res: Response, name: string) {
  res.append('Set-Cookie', `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

// Express 4 no captura los errores de funciones async: este envoltorio los manda al manejador de errores.
const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };

async function startServer() {
  if (!DATABASE_URL) {
    console.error('Falta DATABASE_URL en el .env (cadena de conexión de Supabase / Postgres).');
    process.exit(1);
  }

  const db = await createAsuncionDb(DATABASE_URL, {
    seedAdmin: {
      ci: process.env.ADMIN_CI,
      password: process.env.ADMIN_PASSWORD,
      fullName: process.env.ADMIN_NAME,
      email: process.env.ADMIN_EMAIL,
      employeeNumber: process.env.ADMIN_EMPLOYEE_NUMBER
    }
  });

  const app = express();
  app.set('trust proxy', 1); // detrás de un proxy (Cloud Run, Render, etc.) req.ip es la IP real
  app.use(express.json({ limit: '3mb' })); // las fotos se comprimen en el navegador antes de enviarse

  app.get('/api/health', ah(async (_req, res) => {
    await db.ping();
    res.json({ ok: true, engine: 'postgres' });
  }));

  // --- REPORTS ROUTES ---
  app.get('/api/reports', ah(async (req, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const status = typeof req.query.status === 'string' ? (req.query.status as IncidentStatus | 'Todos') : undefined;
    const category = typeof req.query.category === 'string' ? (req.query.category as IncidentCategory | 'Todas') : undefined;
    const barrio = typeof req.query.barrio === 'string' ? req.query.barrio : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;

    // Administradores (nivel 1 y 2) ven datos completos; el público ve primer nombre y cédula enmascarada.
    const isAdmin = Boolean(await db.getAdminBySession(getAdminToken(req)));
    const reports = (await db.listReports({ date, month, status, category, barrio, q, searchCitizen: isAdmin })).map(
      (r) => serializeReport(r, isAdmin, CITIZEN_KEY_SECRET)
    );
    res.setHeader('Cache-Control', 'no-store'); // la respuesta depende del rol: que nada la guarde
    res.json({ reports });
  }));

  app.post('/api/reports', ah(async (req, res) => {
    const validation = validateReportInput(req.body, { allowSamplePhotos: ALLOW_SAMPLE_PHOTOS });
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const input = validation.data;

    // Si hay sesión de ciudadano, su identidad manda sobre lo que venga en el cuerpo.
    const sessionCitizen = await db.getCitizenBySession(getCitizenToken(req));
    if (sessionCitizen) {
      input.citizenId = sessionCitizen.id;
      input.citizenName = sessionCitizen.fullName;
      input.citizenPhone = sessionCitizen.phone;
    }

    const ipKey = req.ip || 'unknown';
    const citizenLimitKey = input.citizenId || `name:${input.citizenName.toLowerCase()}`;
    if (!ipLimiter.take(ipKey) || !citizenLimiter.take(citizenLimitKey)) {
      res.status(429).json({ error: 'Alcanzaste el límite de reportes por hora. Intenta nuevamente más tarde.' });
      return;
    }

    try {
      const created = await db.createReport({
        ...input,
        description: input.description || `Reporte ciudadano de ${input.category.toLowerCase()} en ${input.location.barrio}.`,
        location: {
          ...input.location,
          address: input.location.address || `Intersección vial en ${input.location.barrio}`
        }
      });
      const isAdmin = Boolean(await db.getAdminBySession(getAdminToken(req)));
      res.status(201).json({ report: serializeReport(created, isAdmin, CITIZEN_KEY_SECRET) });
    } catch (err) {
      console.error('Error creating report in Postgres:', err);
      res.status(500).json({ error: 'No se pudo guardar el reporte en la base de datos.' });
    }
  }));

  app.patch('/api/reports/:id/status', ah(async (req, res) => {
    const admin = await db.getAdminBySession(getAdminToken(req));
    if (!admin || admin.level !== 2) {
      res.status(403).json({ error: 'Solo perfiles administrativos de Nivel 2 pueden modificar reportes.' });
      return;
    }

    const { id } = req.params;
    const { status, notes, changedBy } = req.body || {};
    if (!status || !['Pendiente', 'En revisión', 'Solucionado'].includes(status)) {
      res.status(400).json({ error: 'Estado inválido.' });
      return;
    }

    const updated = await db.updateReportStatus(
      id,
      status as IncidentStatus,
      typeof notes === 'string' ? notes : undefined,
      typeof changedBy === 'string' && changedBy.trim() ? changedBy.trim() : admin.fullName
    );

    if (!updated) {
      res.status(404).json({ error: 'Reporte no encontrado.' });
      return;
    }
    res.json({ report: serializeReport(updated, true, CITIZEN_KEY_SECRET) });
  }));

  app.post('/api/reports/bulk-status', ah(async (req, res) => {
    const admin = await db.getAdminBySession(getAdminToken(req));
    if (!admin || admin.level !== 2) {
      res.status(403).json({ error: 'Solo perfiles administrativos de Nivel 2 pueden solucionar en lote.' });
      return;
    }

    const { ids, status, notes } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0 || !['Pendiente', 'En revisión', 'Solucionado'].includes(status)) {
      res.status(400).json({ error: 'Lista de IDs o estado inválido.' });
      return;
    }

    const updatedCount = await db.bulkUpdateReportsStatus(
      ids,
      status as IncidentStatus,
      typeof notes === 'string' ? notes : undefined,
      admin.fullName
    );
    const reports = (await db.listReports()).map((r) => serializeReport(r, true, CITIZEN_KEY_SECRET));
    res.json({ updatedCount, reports });
  }));

  app.delete('/api/reports/:id', ah(async (req, res) => {
    const admin = await db.getAdminBySession(getAdminToken(req));
    if (!admin || admin.level !== 2) {
      res.status(403).json({ error: 'Solo perfiles administrativos de Nivel 2 pueden eliminar reportes.' });
      return;
    }
    const deleted = await db.deleteReport(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Reporte no encontrado.' });
      return;
    }
    res.json({ success: true });
  }));

  // --- CITIZEN ROUTES ---
  app.get('/api/citizens/me', ah(async (req, res) => {
    const citizen = await db.getCitizenBySession(getCitizenToken(req));
    res.json({ citizen: withCitizenKey(citizen) });
  }));

  app.post('/api/citizens/register', ah(async (req, res) => {
    const { cedula, fullName, phone } = req.body || {};
    const result = await db.registerCitizen({
      cedula: String(cedula || ''),
      fullName: String(fullName || ''),
      phone: typeof phone === 'string' ? phone : undefined
    });

    if (!result.success || !result.citizen || !result.token) {
      res.status(400).json({ error: result.error || 'No se pudo registrar el ciudadano.' });
      return;
    }

    setSessionCookie(res, 'asuncion_citizen_token', result.token);
    res.status(201).json({ citizen: withCitizenKey(result.citizen), token: result.token });
  }));

  app.post('/api/citizens/logout', ah(async (req, res) => {
    await db.deleteSession(getCitizenToken(req));
    clearSessionCookie(res, 'asuncion_citizen_token');
    res.json({ success: true });
  }));

  // --- ADMIN ROUTES ---
  app.get('/api/admins/me', ah(async (req, res) => {
    const admin = await db.getAdminBySession(getAdminToken(req));
    res.json({ admin });
  }));

  app.post('/api/admins/login', ah(async (req, res) => {
    const { identifier, password } = req.body || {};
    const result = await db.loginAdmin(String(identifier || ''), String(password || ''));
    if (!result.success || !result.admin || !result.token) {
      res.status(401).json({ error: result.error || 'Credenciales inválidas.' });
      return;
    }
    setSessionCookie(res, 'asuncion_admin_token', result.token);
    res.json({ admin: result.admin, token: result.token });
  }));

  app.post('/api/admins/logout', ah(async (req, res) => {
    await db.deleteSession(getAdminToken(req));
    clearSessionCookie(res, 'asuncion_admin_token');
    res.json({ success: true });
  }));

  app.get('/api/admins', ah(async (req, res) => {
    const admin = await db.getAdminBySession(getAdminToken(req));
    if (!admin) {
      res.status(401).json({ error: 'Sesión administrativa requerida.' });
      return;
    }
    res.json({ accounts: await db.listAdminAccounts() });
  }));

  app.post('/api/admins', ah(async (req, res) => {
    const actor = await db.getAdminBySession(getAdminToken(req));
    const { ci, employeeNumber, fullName, level, password, email } = req.body || {};
    const result = await db.createAdminAccount(
      {
        ci: String(ci || ''),
        employeeNumber: String(employeeNumber || ''),
        fullName: String(fullName || ''),
        level: level === 2 ? 2 : 1,
        password: String(password || ''),
        email: typeof email === 'string' && email.trim() ? email.trim() : undefined
      },
      actor
    );

    if (!result.success || !result.account) {
      res.status(actor?.level !== 2 ? 403 : 400).json({ error: result.error || 'No se pudo crear el perfil.' });
      return;
    }
    res.status(201).json({ account: result.account });
  }));

  app.delete('/api/admins/:id', ah(async (req, res) => {
    const actor = await db.getAdminBySession(getAdminToken(req));
    const result = await db.deleteAdminAccount(req.params.id, actor);
    if (!result.success) {
      res.status(actor?.level !== 2 ? 403 : 400).json({ error: result.error || 'No se pudo eliminar el perfil.' });
      return;
    }
    res.json({ success: true });
  }));

  // --- VITE / STATIC FRONTEND ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Manejador de errores: cualquier fallo inesperado responde 500 en vez de tumbar el servidor.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error no controlado:', err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'Error interno del servidor.' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Asunción Se Levanta server listening on http://0.0.0.0:${PORT} (Postgres)`);
  });
}

startServer().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});
