-- Dedupe products by normalized MPN (uppercase + alphanumeric only) and replace the
-- existing case-only UNIQUE index with a stricter one that also collapses spaces, hyphens,
-- slashes and other punctuation. Variants like "B850M D3HP", "B850M-D3HP", "B850M/D3HP"
-- now resolve to the same canonical row.
--
-- Audit (pre-merge, local DB at the time of writing):
--   * 1237 product rows
--   * 68 dup groups, 69 redundant rows, 137 rows in dup groups
--   * 237 listings linked to dup-affected products
--   * 0 product_reviews / quote_items / price_alerts / product_metrics rows touched

BEGIN;

-- 1) Helper: estable, IMMUTABLE para que el índice expression-based pueda usarla.
CREATE OR REPLACE FUNCTION public.f_norm_mpn(mpn TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT regexp_replace(upper(coalesce(mpn, '')), '[^A-Z0-9]', '', 'g')
$$;

-- 2) Drop the existing case-only UNIQUE (`products_mpn_unique_upper_idx` on `upper(mpn)`).
--    Lo reemplazamos por uno que también colapsa puntuación.
DROP INDEX IF EXISTS public.products_mpn_unique_upper_idx;

-- 3) Construir el plan de merge: por cada (categoría, MPN normalizado) elige una fila
--    canónica (la más antigua; en empate, MPN más largo; luego id).
WITH ranked AS (
  SELECT
    id,
    mpn,
    category_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY public.f_norm_mpn(mpn), category_id
      ORDER BY created_at ASC, length(mpn) DESC, id ASC
    ) AS rn,
    FIRST_VALUE(id) OVER (
      PARTITION BY public.f_norm_mpn(mpn), category_id
      ORDER BY created_at ASC, length(mpn) DESC, id ASC
    ) AS canonical_id
  FROM public.products
  WHERE mpn IS NOT NULL AND mpn <> ''
),
merges AS (
  SELECT id AS dup_id, canonical_id
  FROM ranked
  WHERE rn > 1
),
-- 4) Reasignar listings: el constraint `(store_id, external_id)` ya impide colisiones
--    con misma URL, así que el UPDATE sólo puede crear filas con misma `(store_id, product_id)`
--    pero distintos `external_id`; no rompe ningún UNIQUE.
listings_reassigned AS (
  UPDATE public.listings l
  SET product_id = m.canonical_id,
      updated_at = NOW()
  FROM merges m
  WHERE l.product_id = m.dup_id
  RETURNING l.id
)
-- 5) Borrar las filas duplicadas. Las FK con CASCADE se aplican, pero ya migramos las
--    listings; las otras tablas referenciantes (price_history vía listings, reviews, quotes,
--    alerts, metrics) hoy no tienen filas tocadas (verificado en auditoría).
DELETE FROM public.products
WHERE id IN (SELECT dup_id FROM merges);

-- 6) UNIQUE index que previene el regreso de duplicados.
--    Categoría + MPN normalizado: una fila por (categoría, MPN canónico).
--    NULL/'' siguen permitidos (productos sin MPN).
CREATE UNIQUE INDEX products_norm_mpn_per_category_idx
  ON public.products (category_id, public.f_norm_mpn(mpn))
  WHERE mpn IS NOT NULL AND mpn <> '';

-- 7) Lookup index para acelerar `f_norm_mpn(mpn)` en queries por API (e.g., findExistingProductByMpn).
--    Sin filtro WHERE para que también sirva en lookups globales si los hay.
CREATE INDEX IF NOT EXISTS products_norm_mpn_lookup_idx
  ON public.products (public.f_norm_mpn(mpn))
  WHERE mpn IS NOT NULL AND mpn <> '';

COMMIT;
