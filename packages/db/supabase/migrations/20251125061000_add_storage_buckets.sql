-- ============================================
-- Supabase Storage Configuration
-- ============================================
-- This migration sets up storage buckets for:
-- 1. Store logos (store-logos bucket)
-- 2. Product images (product-images bucket)
-- ============================================

-- Create store-logos bucket
-- Files will be stored as: store-logos/{store_slug}.{ext}
-- Example: store-logos/sp-digital.png
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'store-logos',
    'store-logos',
    true, -- Public bucket for read access
    1048576, -- 1MB max file size
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
-- Create product-images bucket
-- Files will be stored as: product-images/{mpn}.{ext}
-- Example: product-images/RTX4090-GAMING-X-TRIO.webp
-- Using MPN (Manufacturer Part Number) as identifier ensures:
-- - Same product from different stores shares one image
-- - No duplicate images for the same product
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-images',
    'product-images',
    true, -- Public bucket for read access
    2097152, -- 2MB max file size
    ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
-- ============================================
-- Storage Policies for store-logos bucket
-- ============================================

-- Allow public read access to store logos
CREATE POLICY "Public read access for store logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-logos');
-- Allow service role and authenticated admins to upload/update store logos
-- In practice, only the scraper (using service_role) will upload logos
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
-- ============================================
-- Storage Policies for product-images bucket
-- ============================================

-- Allow public read access to product images
CREATE POLICY "Public read access for product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');
-- Allow service role to manage product images (scraper uploads)
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
-- ============================================
-- Helper function to get storage URL
-- ============================================
-- This function generates the public URL for a storage object
-- Usage: SELECT get_storage_url('store-logos', 'sp-digital.png');

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
-- Grant execute permission to all roles
GRANT EXECUTE ON FUNCTION public.get_storage_url(text, text) TO anon, authenticated, service_role;
-- ============================================
-- Add comments for documentation
-- ============================================

COMMENT ON FUNCTION public.get_storage_url IS 
'Generates a public URL for a Supabase Storage object. 
Usage: SELECT get_storage_url(''store-logos'', ''sp-digital.png'')
Note: Requires app.settings.supabase_url to be set, or use direct URL construction in application code.';
