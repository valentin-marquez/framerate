-- Add SSD (Solid State Drive) category
INSERT INTO categories (name, slug)
VALUES ('SSD', 'ssd')
ON CONFLICT (slug) DO NOTHING;
