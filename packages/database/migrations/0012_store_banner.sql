-- Banner de la tienda sacado de su sitio (og:image ancha), gemelo de `scraped_icon_url`. El que suba el dueño irá a
-- `store_profiles.banner_key` (R2) y tendrá prioridad.
ALTER TABLE stores ADD COLUMN scraped_banner_url TEXT;
