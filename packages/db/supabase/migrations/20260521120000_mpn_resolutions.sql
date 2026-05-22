-- Caché de resoluciones MPN del servicio `mpn-finder` (Fase 2 del dedup).
--
-- Resolver una query (título de producto / EAN) a su MPN canónico cuesta una
-- búsqueda web + una llamada LLM. Esta tabla evita repetir ese trabajo: se
-- keya por el hash de la query normalizada. El TTL lo decide el servicio al
-- escribir (`expires_at`); el `get` filtra lo expirado.

create table if not exists public.mpn_resolutions (
  query_hash  text primary key,
  query       text not null,
  result      jsonb not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz
);

create index if not exists mpn_resolutions_expires_at_idx
  on public.mpn_resolutions (expires_at);

-- Tabla interna del pipeline de scraping: sólo el service role la lee/escribe
-- (bypassa RLS). No se expone vía la API anon, así que no lleva política
-- pública — RLS habilitada deniega por defecto.
alter table public.mpn_resolutions enable row level security;
