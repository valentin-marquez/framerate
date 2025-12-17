-- Fix security warning: Function Search Path Mutable
-- Set explicit search_path for get_storage_url function

CREATE OR REPLACE FUNCTION public.get_storage_url(bucket_name text, file_path text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT 
        CASE 
            WHEN file_path IS NULL OR file_path = '' THEN NULL
            ELSE concat(
                current_setting('app.settings.supabase_url', true),
                '/storage/v1/object/public/',
                bucket_name,
                '/',
                file_path
            )
        END;
$$;
