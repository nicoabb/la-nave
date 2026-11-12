-- La Nave — esquema de Supabase (SPEC.md §1 y §6)
-- Pégalo completo en Supabase → SQL Editor → New query → Run.
-- Se puede ejecutar más de una vez sin problema.

-- ---------------------------------------------------------------
-- Función común: "gana el último que escribió" + marca de servidor
-- ---------------------------------------------------------------
create or replace function public.lanave_antes_de_guardar()
returns trigger
language plpgsql
as $$
begin
  -- Si llega una versión igual o más vieja que la guardada, se ignora.
  if tg_op = 'UPDATE' and new.updated_at <= old.updated_at then
    return null;
  end if;
  -- Hora del servidor: los dispositivos descargan lo que cambió después
  -- de su última descarga, sin depender del reloj de cada teléfono.
  new.server_updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- Tablas (todas con id, user_id, created_at, updated_at, deleted)
-- ---------------------------------------------------------------
create table if not exists public.vehicles (
  marca text, modelo text, anio integer, motor text, transmision text, alias text,
  fecha_compra date, activo boolean not null default true
);
create table if not exists public.odometer_corrections (
  vehicle_id uuid, fecha date, km_total double precision, nota text
);
-- km_recorridos puede quedar vacío (carga importada sin km).
-- "full": true = full, false = no fue full, null = desconocido.
create table if not exists public.fuel_logs (
  vehicle_id uuid, fecha date, km_recorridos double precision, litros double precision,
  "full" boolean default true, monto double precision, moneda text,
  tasa_ves_usd double precision, tasa_origen text, monto_usd double precision, nota text, origen text
);
create table if not exists public.maintenance_tasks (
  vehicle_id uuid, clave text, nombre text, sistema text, intervalo_km double precision,
  intervalo_dias integer, ultima_km_inicial double precision, ultima_fecha_inicial date,
  activa boolean not null default true, notas text, es_revision boolean not null default false, fuente text
);
create table if not exists public.service_visits (
  vehicle_id uuid, fecha date, km double precision, titulo text, taller text, proveedor text,
  afecta_rendimiento boolean not null default false, moneda text, tasa_ves_usd double precision,
  tasa_origen text, nota text
);
create table if not exists public.service_items (
  visit_id uuid, descripcion text, tipo text, sistema text, task_id uuid, product_id uuid,
  cantidad double precision, monto double precision, monto_usd double precision
);
create table if not exists public.products (
  tipo text, marca text, especificacion text, presentacion text,
  en_uso boolean not null default true, nota text, foto_path text
);
create table if not exists public.inspections (
  vehicle_id uuid, fecha date, km double precision, tipo text, checklist jsonb, mediciones jsonb,
  task_id uuid, nota text
);
create table if not exists public.tires (
  vehicle_id uuid, marca text, medida text, dot_semana integer, dot_anio integer,
  fecha_montaje date, km_montaje double precision, posicion text, estado text, nota text
);
-- Un evento puede llevar lo pagado (p. ej. el aire): suma a Gastos → Cauchos.
create table if not exists public.tire_events (
  vehicle_id uuid, fecha date, km double precision, tipo text, detalle jsonb, visit_id uuid,
  monto double precision, moneda text, tasa_ves_usd double precision, tasa_origen text, monto_usd double precision
);
create table if not exists public.wishlist_items (
  vehicle_id uuid, titulo text, prioridad text, costo_estimado_usd double precision, nota text,
  hecho boolean not null default false, fecha_hecho date, visit_id uuid
);
-- categoria: 'compra_papeles' | 'seguro' | 'otro'
create table if not exists public.expenses (
  vehicle_id uuid, fecha date, categoria text, descripcion text, monto double precision,
  moneda text, tasa_ves_usd double precision, tasa_origen text, monto_usd double precision
);

-- Comprobantes (PDF/imagen) de una visita. El archivo va en el bucket privado
-- 'comprobantes' (user_id/visit_id/archivo); aquí solo los metadatos.
create table if not exists public.visit_receipts (
  visit_id uuid, nombre text, mime text, bytes integer, path text
);

-- tasa_origen: 'manual' | 'wallet' | 'estimada' | 'comprobante'

-- Por si las tablas ya existían de una versión anterior de este script
alter table public.fuel_logs alter column "full" drop not null;
alter table public.fuel_logs add column if not exists tasa_origen text;
alter table public.service_visits add column if not exists proveedor text;
alter table public.service_visits add column if not exists tasa_origen text;
alter table public.tire_events add column if not exists monto double precision;
alter table public.tire_events add column if not exists moneda text;
alter table public.tire_events add column if not exists tasa_ves_usd double precision;
alter table public.tire_events add column if not exists tasa_origen text;
alter table public.tire_events add column if not exists monto_usd double precision;
alter table public.expenses add column if not exists tasa_origen text;

-- Columnas comunes, seguridad (RLS) y disparador en cada tabla
do $$
declare
  t text;
begin
  foreach t in array array[
    'vehicles', 'odometer_corrections', 'fuel_logs', 'maintenance_tasks', 'service_visits',
    'service_items', 'products', 'inspections', 'tires', 'tire_events', 'wishlist_items', 'expenses',
    'visit_receipts'
  ] loop
    execute format('alter table public.%I add column if not exists id uuid primary key', t);
    execute format('alter table public.%I add column if not exists user_id uuid not null default auth.uid() references auth.users(id) on delete cascade', t);
    execute format('alter table public.%I add column if not exists created_at timestamptz not null default now()', t);
    execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()', t);
    execute format('alter table public.%I add column if not exists deleted boolean not null default false', t);
    execute format('alter table public.%I add column if not exists server_updated_at timestamptz not null default now()', t);
    execute format('create index if not exists %I on public.%I (user_id, server_updated_at)', t || '_descarga', t);

    -- RLS: cada quien solo ve y escribe lo suyo
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "solo lo propio" on public.%I', t);
    execute format(
      'create policy "solo lo propio" on public.%I for all to authenticated '
      'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    execute format('drop trigger if exists antes_de_guardar on public.%I', t);
    execute format(
      'create trigger antes_de_guardar before insert or update on public.%I '
      'for each row execute function public.lanave_antes_de_guardar()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------
-- Fotos: bucket privado, cada quien en su carpeta (user_id/...)
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', false)
on conflict (id) do nothing;

drop policy if exists "fotos: ver las propias" on storage.objects;
drop policy if exists "fotos: subir las propias" on storage.objects;
drop policy if exists "fotos: cambiar las propias" on storage.objects;
drop policy if exists "fotos: borrar las propias" on storage.objects;

create policy "fotos: ver las propias" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fotos: subir las propias" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fotos: cambiar las propias" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fotos: borrar las propias" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------
-- Comprobantes: bucket privado, máx. 5 MB, solo PDF e imágenes.
-- Se abren con URL firmada; cada quien solo en su carpeta.
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 5242880,
        array['application/pdf', 'image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "comprobantes: ver los propios" on storage.objects;
drop policy if exists "comprobantes: subir los propios" on storage.objects;
drop policy if exists "comprobantes: borrar los propios" on storage.objects;

create policy "comprobantes: ver los propios" on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "comprobantes: subir los propios" on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "comprobantes: borrar los propios" on storage.objects for delete to authenticated
  using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid())::text);