INSERT INTO categories (name, slug)
VALUES ('HDD', 'hdd')
ON CONFLICT (slug) DO NOTHING;

