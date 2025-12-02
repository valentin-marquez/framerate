-- Configuración de Supabase Storage
-- Esta migración configura buckets de almacenamiento para:
-- 1. Logos de tiendas (bucket store-logos)
-- 2. Imágenes de productos (bucket product-images)

-- Crear bucket store-logos
-- Los archivos se almacenarán como: store-logos/{store_slug}.{ext}
-- Ejemplo: store-logos/sp-digital.png
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'store-logos',
    'store-logos',
    true, -- Bucket público para lectura
    1048576, -- Tamaño máximo de archivo 1MB
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Crear bucket product-images
-- Los archivos se almacenarán como: product-images/{mpn}.{ext}
-- Ejemplo: product-images/RTX4090-GAMING-X-TRIO.webp
-- Usar MPN (Número de parte del fabricante) como identificador asegura:
-- - El mismo producto de diferentes tiendas comparte una imagen
-- - Sin imágenes duplicadas para el mismo producto
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-images',
    'product-images',
    true, -- Bucket público para lectura
    2097152, -- Tamaño máximo de archivo 2MB
    ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Políticas de almacenamiento para store-logos

-- Permitir acceso de lectura público a logos de tiendas
CREATE POLICY "Public read access for store logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-logos');

-- Permitir al rol de servicio y administradores autenticados subir/actualizar logos
-- En la práctica, solo el scraper (usando service_role) subirá logos
CREATE POLICY "Service role can upload store logos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'store-logos'
    AND (auth.role() = 'service_role')
);

CREATE POLICY "Service role can update store logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'store-logos')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can delete store logos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'store-logos'
    AND (auth.role() = 'service_role')
);

-- Políticas de almacenamiento para product-images

-- Permitir acceso de lectura público a imágenes de productos
CREATE POLICY "Public read access for product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Permitir al rol de servicio gestionar imágenes de productos (scraper sube)
CREATE POLICY "Service role can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'product-images'
    AND (auth.role() = 'service_role')
);

CREATE POLICY "Service role can update product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can delete product images"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'product-images'
    AND (auth.role() = 'service_role')
);

-- Función auxiliar para obtener URL de almacenamiento
-- Esta función genera la URL pública para un objeto de almacenamiento
-- Uso: SELECT get_storage_url('store-logos', 'sp-digital.png');

CREATE OR REPLACE FUNCTION public.get_storage_url(bucket_name text, file_path text)
RETURNS text
LANGUAGE sql
STABLE
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

-- Otorgar permiso de ejecución a todos los roles
GRANT EXECUTE ON FUNCTION public.get_storage_url(text, text) TO anon, authenticated, service_role;

-- Agregar comentarios para documentación

COMMENT ON FUNCTION public.get_storage_url IS 
'Genera una URL pública para un objeto de Supabase Storage. 
Uso: SELECT get_storage_url(''store-logos'', ''sp-digital.png'')
Nota: Requiere que app.settings.supabase_url esté configurado, o usar construcción directa de URL en el código de la aplicación.';

