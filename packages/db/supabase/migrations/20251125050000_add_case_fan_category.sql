INSERT INTO categories (name, slug)
VALUES ('Case Fan', 'case_fan')
ON CONFLICT (slug) DO NOTHING;

