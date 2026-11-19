-- Orion Flare — base de datos de pedidos (Supabase, capa gratis)
-- Cómo usarlo: en tu proyecto de Supabase abre "SQL Editor", pega todo este archivo y pulsa "Run".

-- 1) Tabla de pedidos
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  creado timestamptz not null default now(),
  codigo text not null unique check (codigo ~ '^OF-[A-Z0-9]{6}$'),
  estado text not null default 'nuevo' check (estado in ('nuevo', 'revisado', 'pagado', 'impreso', 'enviado', 'entregado', 'cancelado')),
  cliente jsonb not null,
  prenda jsonb not null,
  lados jsonb not null,
  total numeric(10, 2) not null check (total > 0 and total < 5000),
  acepto_terminos boolean not null check (acepto_terminos),
  declaro_derechos boolean not null check (declaro_derechos),
  nota_interna text
);

-- Límite de tamaño de los datos del cliente (evita abusos)
alter table public.pedidos drop constraint if exists pedidos_tamano;
alter table public.pedidos add constraint pedidos_tamano
  check (pg_column_size(cliente) < 4000 and pg_column_size(prenda) < 1000 and pg_column_size(lados) < 4000);

-- 2) Seguridad: el sitio (rol "anon") solo puede CREAR pedidos nuevos. No puede leer, editar ni borrar.
alter table public.pedidos enable row level security;

drop policy if exists "sitio crea pedidos" on public.pedidos;
create policy "sitio crea pedidos" on public.pedidos
  for insert to anon
  with check (estado = 'nuevo' and nota_interna is null);

-- Tú ves y editas los pedidos desde el panel de Supabase (Table Editor), que usa permisos de administrador.

-- 3) Almacenamiento de los diseños (privado)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pedidos', 'pedidos', false, 31457280, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = 31457280, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

drop policy if exists "sitio sube disenos" on storage.objects;
create policy "sitio sube disenos" on storage.objects
  for insert to anon
  with check (
    bucket_id = 'pedidos'
    and (storage.foldername(name))[1] ~ '^OF-[A-Z0-9]{6}$'
  );
