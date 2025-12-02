-- Incluye tanto disipadores de aire como refrigeración líquida
INSERT INTO categories (name, slug)
VALUES ('CPU Cooler', 'cpu_cooler')
ON CONFLICT (slug) DO NOTHING;

