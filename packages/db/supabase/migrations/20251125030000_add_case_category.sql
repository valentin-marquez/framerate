-- Add Case (Gabinete) category
INSERT INTO categories (name, slug)
VALUES ('Case', 'case')
ON CONFLICT (slug) DO NOTHING;
