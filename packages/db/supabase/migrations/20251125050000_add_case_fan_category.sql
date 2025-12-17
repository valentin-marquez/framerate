-- Add case_fan (Ventiladores para Gabinete) category
INSERT INTO categories (name, slug)
VALUES ('Case Fan', 'case_fan')
ON CONFLICT (slug) DO NOTHING;
