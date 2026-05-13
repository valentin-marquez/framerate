-- Add image/avif to product-images bucket allowed mime types.
-- The collector converts all product images to AVIF before upload (apps/collector/src/lib/storage.ts),
-- but the bucket was originally configured with only png/jpeg/webp, causing every upload to fail
-- with "mime type image/avif is not supported". The storage helper in packages/db/src/storage.ts
-- already lists avif as an allowed mime; this migration aligns the bucket config with the helper.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/avif']
WHERE id = 'product-images';
