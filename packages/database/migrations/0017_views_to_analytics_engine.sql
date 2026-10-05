-- Las vistas de ficha pasan a Analytics Engine (#120): ingest recalcula `products.views_7d` en cada Cron. Antes de
-- borrar la tabla, `views_7d` arranca con la última semana para que el orden por popularidad no parta de cero.
UPDATE products SET views_7d = coalesce(
  (SELECT sum(views) FROM product_views_daily v WHERE v.product_id = products.id AND v.day >= date('now', '-7 days')),
  0
);
DROP TABLE product_views_daily;
