-- 20251215120001_create_products_mpn_unique_index.sql
-- Verify no duplicates after normalization and create UNIQUE index on normalized mpn
-- This migration will fail early if duplicates are found (safe guard).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT upper(regexp_replace(regexp_replace(trim(mpn), '\\s+', ' ', 'g'), '[[:cntrl:]]', '', 'g')) AS normalized, count(*)
      FROM products
      WHERE mpn IS NOT NULL
      GROUP BY normalized
      HAVING count(*) > 1
    ) t
  ) THEN
    RAISE EXCEPTION 'Cannot create unique index: duplicates detected after normalization';
  END IF;
END;
$$;

-- Create the unique index on normalized mpn
CREATE UNIQUE INDEX IF NOT EXISTS products_mpn_unique_upper_idx
ON products ((upper(mpn)))
WHERE mpn IS NOT NULL;

-- NOTE: If you prefer to create the index CONCURRENTLY to avoid locks on large tables,
-- run the following manually outside of a transaction (some migration runners execute files inside a transaction):
-- CREATE UNIQUE INDEX CONCURRENTLY products_mpn_unique_upper_idx ON products ((upper(mpn))) WHERE mpn IS NOT NULL;

-- End of migration
