---
name: prod-health
description: Revisa la salud del catálogo en producción (D1 remoto, sólo lectura): productos, ofertas, revisiones de matching pendientes, cuarentena por motivo y títulos rechazados, corridas fallidas. Usar cuando pregunten "cómo está producción", "qué hay en cuarentena", "por qué no entra X tienda", o después de desplegar ingest.
---

# Salud de producción (D1, sólo lectura)

Consultas contra la base remota `framerate`. **Sólo `SELECT`.** Correrlas desde `packages/database` (ahí está el
`wrangler.jsonc` que resuelve la base):

```bash
bunx wrangler d1 execute framerate --remote --command "<SQL>"
```

Si el permiso de Claude bloquea las lecturas remotas, pásale el comando al dueño con el prefijo `!` para que lo
corra él y la salida quede en la conversación.

## Consultas base

Resumen general:

```sql
select (select count(*) from products) productos,
       (select count(*) from listings where is_active=1) ofertas,
       (select count(*) from listings where is_active=1 and in_stock=1) con_stock,
       (select count(*) from match_reviews where status='pending') revisiones,
       (select count(*) from crawl_runs where status='failed') fallidas,
       (select max(started_at) from crawl_runs) ultima
```

Cuarentena por tienda y motivo, y los títulos de un motivo:

```sql
select s.slug, q.reason, count(*) n from quarantine q join stores s on s.id=q.store_id group by 1,2 order by n desc limit 15
select s.slug, json_extract(q.payload,'$.title') title from quarantine q join stores s on s.id=q.store_id where q.reason='<motivo>' limit 40
```

Última corrida por (tienda, categoría):

```sql
select s.slug, r.category, r.status, r.started_at, r.stats from crawl_runs r join stores s on s.id=r.store_id
where r.started_at = (select max(started_at) from crawl_runs r2 where r2.store_id=r.store_id and r2.category=r.category)
order by s.slug, r.category
```

## Cómo leer los resultados

- **Ofertas por producto cerca de 1** con varias tiendas: casi no hay fusiones entre tiendas. Mirar las revisiones
  pendientes antes de tocar umbrales.
- **`attribute:missing:*` con productos reales** es un extractor que no entiende el título: agregar el título como
  test en `packages/matching/src/domain/matching.test.ts` y arreglar `attributes.ts`. Con accesorios o basura, la
  cuarentena está haciendo su trabajo.
- **`condition:not_new`** es correcto para usados y open box; revisar sólo si aparecen productos nuevos.

## Trampas

- **La cuarentena re-registra los rechazos en cada corrida** (se purga a los 14 días). Los conteos son filas, no
  ofertas distintas: para medir una corrida, filtrar por `run_id`.
- **D1 rechaza `UNION ALL` largos** ("too many terms in compound SELECT"). Usar subconsultas escalares en un solo
  `SELECT`, como en el resumen.
- **`LIKE` en D1 admite como máximo 50 bytes de patrón.**
- `listings.title` es el título limpio; el que publicó la tienda está en `raw_title` (desde la migración 0010).
