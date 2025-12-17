-- 20251215120000_normalize_mpn_and_add_trigger.sql
-- Normalize existing MPN values and add a trigger to normalize on INSERT/UPDATE
-- Idempotent: safe to run multiple times

-- 1) Convert empty/blank mpn to NULL
UPDATE products
SET mpn = NULL
WHERE mpn IS NOT NULL AND trim(mpn) = '';

-- 2) Normalize existing MPNs: trim, collapse whitespace, strip control chars, upper-case
UPDATE products
SET mpn = upper(regexp_replace(regexp_replace(trim(mpn), '\\s+', ' ', 'g'), '[[:cntrl:]]', '', 'g'))
WHERE mpn IS NOT NULL
  AND mpn <> upper(regexp_replace(regexp_replace(trim(mpn), '\\s+', ' ', 'g'), '[[:cntrl:]]', '', 'g'));

-- 3) Create normalization function (safe to replace)
CREATE OR REPLACE FUNCTION public.normalize_mpn_trigger() RETURNS trigger AS $$
BEGIN
  IF NEW.mpn IS NOT NULL THEN
    NEW.mpn := upper(regexp_replace(regexp_replace(trim(NEW.mpn), '\\s+', ' ', 'g'), '[[:cntrl:]]', '', 'g'));
    IF NEW.mpn = '' THEN
      NEW.mpn := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Attach trigger to products table
DROP TRIGGER IF EXISTS products_mpn_normalize ON public.products;
CREATE TRIGGER products_mpn_normalize
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.normalize_mpn_trigger();

-- 5) Sanity check: show top 10 normalized mpns (for manual verification)
-- SELECT id, mpn FROM products WHERE mpn IS NOT NULL LIMIT 10;

-- End of migration
