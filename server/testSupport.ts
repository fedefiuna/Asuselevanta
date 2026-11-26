import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { createAsuncionDb, type AsuncionDb } from './db.ts';

/** Si no hay TEST_DATABASE_URL, los tests de base de datos se saltan solos. */
export const TEST_DB_URL = process.env.TEST_DATABASE_URL;

const SCHEMA_SQL = path.resolve(import.meta.dirname, '..', 'supabase', 'schema.sql');

const isLocal = (url: string) => /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const clean = (url: string) => url.replace(/([?&])sslmode=[^&]*&?/i, '$1').replace(/[?&]$/, '');

export interface TestSchema {
  schema: string;
  /** Abre una conexión nueva (con su propio pool) sobre el esquema temporal. Se cierra sola al terminar. */
  open: () => Promise<AsuncionDb>;
  /** SQL directo sobre el esquema temporal, para preparar o inspeccionar datos. */
  query: (text: string, params?: unknown[]) => Promise<pg.QueryResult>;
  dispose: () => Promise<void>;
}

/**
 * Crea un esquema "test_xxxxxxxx", carga en él supabase/schema.sql y lo borra al terminar.
 * Nunca toca las tablas reales de "public".
 */
export async function createTestSchema(): Promise<TestSchema> {
  const url = TEST_DB_URL!;
  const schema = `test_${crypto.randomBytes(4).toString('hex')}`;
  const ssl = isLocal(url) ? false : { rejectUnauthorized: false };
  const admin = new pg.Client({ connectionString: clean(url), ssl });
  await admin.connect();
  await admin.query(`create schema "${schema}"`);

  const ddl = fs.readFileSync(SCHEMA_SQL, 'utf8').replace(/\bpublic\./g, `"${schema}".`);
  await admin.query(ddl);

  const opened: AsuncionDb[] = [];
  return {
    schema,
    async open() {
      const db = await createAsuncionDb({ connectionString: url, schema, max: 3 });
      opened.push(db);
      return db;
    },
    query: (text, params) => admin.query(text.replaceAll('{s}', `"${schema}"`), params),
    async dispose() {
      await Promise.all(opened.map((d) => d.close().catch(() => {})));
      await admin.query(`drop schema "${schema}" cascade`).catch(() => {});
      await admin.end().catch(() => {});
    }
  };
}
