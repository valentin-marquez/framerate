-- ============================================
-- user-avatars bucket
-- ============================================
-- Almacena la foto de perfil del usuario. Path: {user_id}/avatar.{ext}
-- Estructura de carpeta permite RLS por dueño usando storage.foldername(name)[1].
-- Las imágenes que provienen de OAuth (Google/Discord/etc.) se sincronizan al
-- bucket via POST /v1/auth/sync-avatar después del login, para que la edición
-- de perfil futura pueda reescribir el mismo objeto.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'user-avatars',
    'user-avatars',
    true, -- public read
    2097152, -- 2MB
    ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================
-- Policies
-- ============================================

-- Read público (las URLs son públicas, mismo patrón que store-logos/product-images).
CREATE POLICY "Public read access for user avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-avatars');

-- El dueño puede crear archivos dentro de su carpeta {auth.uid()}/...
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'user-avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

-- Update sobre su propia carpeta (necesario para upsert / reemplazo).
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
)
WITH CHECK (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

-- Delete sobre su propia carpeta (limpieza al cambiar de avatar).
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

-- Service role tiene full access (para backfills/scripts administrativos).
CREATE POLICY "Service role can manage user avatars"
ON storage.objects FOR ALL
USING (bucket_id = 'user-avatars' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'user-avatars' AND auth.role() = 'service_role');
