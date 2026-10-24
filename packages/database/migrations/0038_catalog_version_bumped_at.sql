-- Cuándo subió la versión del catálogo por última vez. El refresco horario de precios (#121, fase 2) la sube como mucho
-- cada 15 min: con cada refresco subiéndola, la caché versionada del server casi no acertaría. Toda subida lo registra.
ALTER TABLE catalog_version ADD COLUMN bumped_at TEXT;
