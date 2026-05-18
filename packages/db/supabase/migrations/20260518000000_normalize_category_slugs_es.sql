-- Re-normaliza name/slug de categorías a español, keyed by `code` (identificador
-- interno estable).
--
-- Contexto: la migración 20260106120000_add_code_to_categories tradujo los slugs a
-- español UNA sola vez. Pero las categorías sin seed (notablemente `gpu`, que no
-- tiene `add_gpu_category.sql` ni se siembra en initial_schema) las crea el collector
-- de forma lazy con slug/name en inglés. En una DB donde el collector creó la
-- categoría DESPUÉS de aquella migración, queda `slug='gpu'`, lo que rompe:
--   * web: getCategoryConfig() cae al fallback y muestra "gpu"
--   * cotización: QUOTE_SLOTS espera 'tarjetas-de-video' → la GPU cae en "Otros"
--   * API: mapCategorySlugToComponent('gpu') → null → excluida del análisis
--
-- El fix de raíz va en apps/collector (CatalogService ahora inserta el slug/name
-- español + code inglés). Esta migración sana las filas ya creadas y es idempotente
-- (correr de nuevo es no-op; los productos referencian por category_id así que no
-- requieren re-vinculación).

BEGIN;

UPDATE public.categories SET name = 'Procesadores',      slug = 'procesadores'       WHERE code = 'cpu';
UPDATE public.categories SET name = 'Tarjetas de Video', slug = 'tarjetas-de-video'  WHERE code = 'gpu';
UPDATE public.categories SET name = 'Placas Madre',      slug = 'placas-madre'       WHERE code = 'motherboard';
UPDATE public.categories SET name = 'Memorias RAM',      slug = 'memorias-ram'       WHERE code = 'ram';
UPDATE public.categories SET name = 'Fuentes de Poder',  slug = 'fuentes-de-poder'   WHERE code = 'psu';
UPDATE public.categories SET name = 'Gabinetes',         slug = 'gabinetes'          WHERE code = 'case';
UPDATE public.categories SET name = 'Coolers CPU',       slug = 'coolers-cpu'        WHERE code = 'cpu_cooler';
UPDATE public.categories SET name = 'Discos Duros',      slug = 'discos-duros'       WHERE code = 'hdd';
UPDATE public.categories SET name = 'Ventiladores',      slug = 'ventiladores'       WHERE code = 'case_fan';
UPDATE public.categories SET name = 'SSD',               slug = 'ssd'                WHERE code = 'ssd';

COMMIT;
