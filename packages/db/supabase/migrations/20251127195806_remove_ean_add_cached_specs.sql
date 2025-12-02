-- Eliminar columna EAN de productos ya que no se usa en Chile
alter table public.products drop column if exists ean;

-- Crear tabla cached_specs_extractions para almacenar especificaciones extraídas por IA
create table public.cached_specs_extractions (
    id uuid primary key default gen_random_uuid(),
    mpn text not null unique,
    specs jsonb default '{}'::jsonb not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS
alter table public.cached_specs_extractions enable row level security;

-- Políticas
-- Permitir acceso de lectura a todos (consistente con otras tablas)
create policy "Public cached_specs_extractions are viewable by everyone" on public.cached_specs_extractions for select using (true);

-- Permitir insertar/actualizar solo al rol de servicio (implícito, ya que ninguna otra política lo permite)

