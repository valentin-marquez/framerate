-- 20251215140000_fix_normalize_mpn_search_path.sql
-- Ensure public.normalize_mpn_trigger has an explicit, immutable search_path
-- Idempotent: safe to run multiple times

-- This fixes the DB linter warning: function_search_path_mutable
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

CREATE OR REPLACE FUNCTION public.normalize_mpn_trigger() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.mpn IS NOT NULL THEN
    NEW.mpn := upper(regexp_replace(regexp_replace(trim(NEW.mpn), '\s+', ' ', 'g'), '[[:cntrl:]]', '', 'g'));
    IF NEW.mpn = '' THEN
      NEW.mpn := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
