// Verificación rápida de la conexión: `npm run db:check`
// Solo LEE: comprueba que la cadena funciona, que existen las 6 tablas y cuántas filas tiene cada una.
import 'dotenv/config';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('✗ Falta DATABASE_URL en el archivo .env');
  process.exit(1);
}

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const client = new pg.Client({
  connectionString: url.replace(/([?&])sslmode=[^&]*&?/i, '$1').replace(/[?&]$/, ''),
  ssl: isLocal || process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000
});

const TABLES = ['citizens', 'admins', 'sessions', 'reports', 'report_status_history', 'report_counters'];

try {
  await client.connect();
  const { rows } = await client.query('select current_database() as db, version() as v');
  console.log(`✓ Conectado a "${rows[0].db}"`);
  console.log(`  ${String(rows[0].v).split(',')[0]}`);

  let missing = 0;
  for (const t of TABLES) {
    try {
      const r = await client.query(`select count(*)::int as n from public.${t}`);
      console.log(`✓ ${t.padEnd(22)} ${r.rows[0].n} filas`);
    } catch (err) {
      missing++;
      console.log(`✗ ${t.padEnd(22)} NO existe (${(err as Error).message})`);
    }
  }
  if (missing > 0) {
    console.error('\nFaltan tablas: ejecuta supabase/schema.sql en el SQL Editor de Supabase.');
    process.exitCode = 1;
  } else {
    console.log('\nTodo listo. Puedes iniciar la app con `npm run dev`.');
  }
} catch (err) {
  console.error(`✗ No se pudo conectar: ${(err as Error).message}`);
  console.error('  Revisa la contraseña, que uses el "Transaction pooler" y que la cadena esté completa.');
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
