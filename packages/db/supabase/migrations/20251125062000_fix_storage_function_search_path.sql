-- Corregir advertencia de seguridad: Ruta de búsqueda de función mutable
-- Establecer search_path explícito para la función get_storage_url

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

