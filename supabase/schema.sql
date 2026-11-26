-- =====================================================================
-- Asunción Se Levanta — esquema para Supabase (Postgres)
-- Pegar completo en: Supabase > SQL Editor > New query > Run
-- Es seguro ejecutarlo más de una vez (usa IF NOT EXISTS).
-- =====================================================================

-- ---------- Ciudadanos ----------
create table if not exists public.citizens (
  id            text primary key,              -- C.I. normalizada
  ci            text not null unique,
  full_name     text not null,
  phone         text,
  registered_at timestamptz not null default now()
);

-- ---------- Administradores municipales ----------
create table if not exists public.admins (
  id              text primary key,            -- C.I.
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

-- ---------- Sesiones (ciudadano y admin) ----------
create table if not exists public.sessions (
  token        text primary key,
  subject_type text not null check (subject_type in ('citizen', 'admin')),
  subject_id   text not null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null
);

-- ---------- Reportes ----------
create table if not exists public.reports (
  id               text primary key,           -- ASU-2026-001
  category         text not null check (category in ('Bache', 'Badén en mal estado', 'Alcantarilla sin tapa', 'Suciedad / Basura')),
  description      text not null,
  photo_url        text not null,              -- data-URL comprimido (se migrará a Supabase Storage en producción)
  lat              double precision not null,
  lng              double precision not null,
  address          text not null,
  barrio           text not null,
  citizen_id       text references public.citizens(id) on update cascade on delete set null,
  citizen_name     text not null,
  citizen_phone    text,
  severity         text not null check (severity in ('Baja', 'Media', 'Alta', 'Crítica')),
  status           text not null check (status in ('Pendiente', 'En revisión', 'Solucionado')),
  resolution_notes text,
  created_at       timestamptz not null default now(),
  report_date      text not null,              -- 'YYYY-MM-DD' en hora de Asunción
  report_month     text not null,              -- 'YYYY-MM'    en hora de Asunción
  updated_at       timestamptz not null default now(),
  resolved_at      timestamptz
);

-- ---------- Historial de estados (auditoría) ----------
create table if not exists public.report_status_history (
  id              text primary key,
  report_id       text not null references public.reports(id) on delete cascade,
  "timestamp"     timestamptz not null default now(),
  previous_status text,
  new_status      text not null check (new_status in ('Pendiente', 'En revisión', 'Solucionado')),
  changed_by      text not null,
  notes           text
);

-- ---------- Contador atómico para los IDs de reporte ----------
-- Reemplaza "leer el máximo y sumar 1": con varias personas reportando a la vez
-- eso podía repetir IDs. Una fila por año; el servidor hace un upsert que incrementa.
create table if not exists public.report_counters (
  year     text primary key,
  last_seq integer not null default 0
);

-- Si ya migras reportes existentes, sincroniza el contador con el mayor número usado:
insert into public.report_counters (year, last_seq)
select split_part(id, '-', 2), max(split_part(id, '-', 3)::integer)
from public.reports
where id ~ '^ASU-[0-9]{4}-[0-9]+$'
group by split_part(id, '-', 2)
on conflict (year) do update set last_seq = greatest(public.report_counters.last_seq, excluded.last_seq);

-- ---------- Índices ----------
create index if not exists idx_reports_status      on public.reports (status);
create index if not exists idx_reports_category    on public.reports (category);
create index if not exists idx_reports_barrio      on public.reports (barrio);
create index if not exists idx_reports_date        on public.reports (report_date);
create index if not exists idx_reports_month       on public.reports (report_month);
create index if not exists idx_reports_created_at  on public.reports (created_at desc);
create index if not exists idx_reports_citizen_id  on public.reports (citizen_id);
create index if not exists idx_history_report_id   on public.report_status_history (report_id, "timestamp" asc);
create index if not exists idx_sessions_expires    on public.sessions (expires_at);

-- ---------- Seguridad: RLS activado y SIN políticas ----------
-- Supabase expone las tablas del esquema "public" por su API REST con la clave pública (anon).
-- Con RLS activado y ninguna política, esa API no puede leer ni escribir NADA.
-- Nuestro servidor Express se conecta directo a Postgres con la cadena de conexión
-- (rol "postgres"), que no está sujeto a RLS. Resultado: solo el servidor toca los datos.
alter table public.citizens              enable row level security;
alter table public.admins                enable row level security;
alter table public.sessions              enable row level security;
alter table public.reports               enable row level security;
alter table public.report_status_history enable row level security;
alter table public.report_counters       enable row level security;

-- Nota: NO se crea el administrador inicial aquí. Lo crea el servidor al arrancar
-- (necesita calcular el hash de la contraseña con scrypt).
