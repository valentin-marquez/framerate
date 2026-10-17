-- Notas propias de calidad de fuentes (#177) para marcas que la tier list no evalúa (GameMax primero): salen de
-- reseñas con mediciones y de Cybenetics, con la misma vara que la planilla, y entran siempre como especulativas
-- (`limited` = 1), así que la regla no advierte por ellas. `apps/server/scripts/psu-tiers.extra.json`.
ALTER TABLE psu_tier ADD COLUMN origin TEXT NOT NULL DEFAULT 'sheet';
-- JSON: las URLs de las reseñas y reportes que justifican una nota propia.
ALTER TABLE psu_tier ADD COLUMN source_urls TEXT;
