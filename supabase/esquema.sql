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
create table if not exists public.fuel_logs (
  vehicle_id uuid, fecha date, km_recorridos double precision, litros double precision,
  "full" boolean not null default true, monto double precision, moneda text,
  tasa_ves_usd double precision, monto_usd double precision, nota text, origen text
);
create table if not exists public.maintenance_tasks (
  vehicle_id uuid, clave text, nombre text, sistema text, intervalo_km double precision,
  intervalo_dias integer, ultima_km_inicial double precision, ultima_fecha_inicial date,
  activa boolean not null default true, notas text, es_revision boolean not null default false, fuente text
);
create table if not exists public.service_visits (
  vehicle_id uuid, fecha date, km double precision, titulo text, taller text,
  afecta_rendimiento boolean not null default false, moneda text, tasa_ves_usd double precision, nota text
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
create table if not exists public.tire_events (
  vehicle_id uuid, fecha date, km double precision, tipo text, detalle jsonb, visit_id uuid
);
create table if not exists public.wishlist_items (
  vehicle_id uuid, titulo text, prioridad text, costo_estimado_usd double precision, nota text,
  hecho boolean not null default false, fecha_hecho date, visit_id uuid
);
create table if not exists public.expenses (
  vehicle_id uuid, fecha date, categoria text, descripcion text, monto double precision,
  moneda text, tasa_ves_usd double precision, monto_usd double precision
);

-- Columnas comunes, seguridad (RLS) y disparador en cada tabla
do $$
declare
  t text;
begin
  foreach t in array array[
    'vehicles', 'odometer_corrections', 'fuel_logs', 'maintenance_tasks', 'service_visits',
    'service_items', 'products', 'inspections', 'tires', 'tire_events', 'wishlist_items', 'expenses'
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
