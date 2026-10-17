-- Más datos de la ficha oficial en `cpu_reference` (#179): lo que la compatibilidad puede usar después sin volver a
-- bajar las fichas. `max_power_w` ya existía; en AMD se completa con la regla publicada PPT = 1,35 × TDP (AM4/AM5).
ALTER TABLE cpu_reference ADD COLUMN unlocked INTEGER;
ALTER TABLE cpu_reference ADD COLUMN pcie_version TEXT;
ALTER TABLE cpu_reference ADD COLUMN memory_channels INTEGER;
ALTER TABLE cpu_reference ADD COLUMN max_memory_gb INTEGER;
-- AMD lo dice en algunos modelos: "liquid" o "premium_air".
ALTER TABLE cpu_reference ADD COLUMN cooler_recommendation TEXT;
