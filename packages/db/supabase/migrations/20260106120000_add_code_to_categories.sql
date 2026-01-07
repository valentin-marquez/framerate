-- Add code column for system usage (internal identifier)
ALTER TABLE categories ADD COLUMN code text;

-- Populate code with current slug values (preserving existing English identifiers)
UPDATE categories SET code = slug;

-- Add constraints to code column
CREATE UNIQUE INDEX categories_code_key ON categories (code);
ALTER TABLE categories ALTER COLUMN code SET NOT NULL;

-- Update slugs and names to Spanish (SEO friendly)
UPDATE categories SET name = 'Placas Madre', slug = 'placas-madre' WHERE code = 'motherboard';
UPDATE categories SET name = 'Gabinetes', slug = 'gabinetes' WHERE code = 'case';
UPDATE categories SET name = 'Tarjetas de Video', slug = 'tarjetas-de-video' WHERE code = 'gpu';
-- SSD stays as 'ssd' for slug, name as 'SSD'
UPDATE categories SET name = 'SSD', slug = 'ssd' WHERE code = 'ssd';
UPDATE categories SET name = 'Fuentes de Poder', slug = 'fuentes-de-poder' WHERE code = 'psu';
UPDATE categories SET name = 'Procesadores', slug = 'procesadores' WHERE code = 'cpu';
UPDATE categories SET name = 'Coolers CPU', slug = 'coolers-cpu' WHERE code = 'cpu_cooler';
UPDATE categories SET name = 'Discos Duros', slug = 'discos-duros' WHERE code = 'hdd';
UPDATE categories SET name = 'Ventiladores', slug = 'ventiladores' WHERE code = 'case_fan';
UPDATE categories SET name = 'Memorias RAM', slug = 'memorias-ram' WHERE code = 'ram';
