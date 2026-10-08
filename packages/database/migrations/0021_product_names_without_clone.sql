-- Productos creados desde fichas copiadas de Tecnomas antes de que cleanTitle quitara el "(clone)" y el código viejo
-- que lo sigue (#17). Nombre y búsqueda calculados con productNameFromTitle(cleanTitle(name)) y searchText; el slug
-- nuevo con slugify (el del 7800X3D ya existe, así que lleva "-2", como uniqueSlug). El slug viejo queda como
-- redirección. El filtro por slug viejo no pisa un producto que ya se haya corregido o fusionado.

INSERT OR IGNORE INTO product_slug_redirects (old_slug, product_id, created_at)
SELECT slug, id, '2026-10-08T17:00:00.000Z' FROM products
WHERE (id = 1033 AND slug = 'zotac-gaming-geforce-rtx-5070-solid-oc-clone-zt-b50700j-10p')
   OR (id = 1034 AND slug = 'zotac-gaming-geforce-rtx-5070-ti-solid-sff-oc-clone-zt-b50710j3-10p')
   OR (id = 4024 AND slug = 'amd-ryzen-7-7800x3d-clone-100-100000910wof');

UPDATE products
SET name = 'Zotac GAMING GeForce RTX 5070 SOLID OC',
    slug = 'zotac-gaming-geforce-rtx-5070-solid-oc',
    search = 'zotac gaming geforce rtx 5070 solid oc'
WHERE id = 1033 AND slug = 'zotac-gaming-geforce-rtx-5070-solid-oc-clone-zt-b50700j-10p';

UPDATE products
SET name = 'Zotac GAMING GeForce RTX 5070 Ti SOLID SFF OC',
    slug = 'zotac-gaming-geforce-rtx-5070-ti-solid-sff-oc',
    search = 'zotac gaming geforce rtx 5070 ti solid sff oc'
WHERE id = 1034 AND slug = 'zotac-gaming-geforce-rtx-5070-ti-solid-sff-oc-clone-zt-b50710j3-10p';

UPDATE products
SET name = 'AMD Ryzen 7 7800X3D',
    slug = 'amd-ryzen-7-7800x3d-2',
    search = 'amd ryzen 7 7800x3d'
WHERE id = 4024 AND slug = 'amd-ryzen-7-7800x3d-clone-100-100000910wof';

-- La caché del catálogo se invalida por versión (#119): sin esto, las listas siguen con el nombre viejo hasta 6 h.
UPDATE catalog_version SET version = version + 1 WHERE id = 1;
