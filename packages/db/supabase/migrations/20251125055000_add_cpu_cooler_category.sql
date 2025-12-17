-- Add cpu_cooler (Disipadores / Coolers para CPU) category
-- Includes both air coolers (Ventilador para CPU) and liquid cooling (Refrigeración líquida)
INSERT INTO categories (name, slug)
VALUES ('CPU Cooler', 'cpu_cooler')
ON CONFLICT (slug) DO NOTHING;
