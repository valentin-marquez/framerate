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

Refresco horario (#121, `category = 'refresh'`): una tienda WooCommerce sin refresco en más de 2 h tiene el DO sin
alarm (el Cron de la hora lo revive) o el adaptador sin `refreshOffers`. `missing` alto y estable es normal; uno que
crece de golpe es la tienda cambiando ids.

```sql
select s.slug, max(r.started_at) ultimo, sum(r.status = 'failed') fallidos,
       max(json_extract(r.stats, '$.requested')) pedidas, max(json_extract(r.stats, '$.missing')) faltantes
from crawl_runs r join stores s on s.id = r.store_id
where r.category = 'refresh' and r.started_at > datetime('now', '-24 hours')
group by s.slug order by ultimo
```

## Pipeline de normalización (#153)

El tablero es el estado por oferta; lo mismo que muestra `/admin/estado` en el sistema `pipeline`:

```sql
select norm_status, count(*) n, min(updated_at) desde from listings where is_active=1 group by 1
```

Gasto de IA por día y propósito en los últimos 7 días (`ai_usage` tiene una fila por llamada; `status` distinto
de `ok` dice por qué falló):

```sql
select substr(at,1,10) dia, purpose, status, count(*) llamadas, round(sum(usd),4) usd from ai_usage
where at >= datetime('now','-7 days') group by 1,2,3 order by 1 desc, 2
```

Productos sin publicar (`published_at is null`) y ofertas ocultas con su antigüedad; a las 24 h el Cron de ingest
las publica por `fallback`, así que más viejas que eso es un problema:

```sql
select count(*) ocultas, min(first_seen_at) mas_vieja from listings where visible=0 and is_active=1
select count(*) sin_publicar, min(created_at) mas_viejo from products where published_at is null
```

Cuánto intenta inventar Haiku (campos de identidad que declaró "de conocimiento", que el anclaje descarta):

```sql
select category, count(*) n from listing_identity
where json_extract(identity_raw,'$.identity_from_knowledge') != '[]' group by 1 order by n desc
```

Pausa global (sin crédito) y vínculo en sombra por categoría (`GET /v1/admin/pipeline/shadow?category=` da lo mismo
con la muestra):

```sql
select paused_until from pipeline_state where id=1
select l.category, s.agrees, s.kind, count(*) n from match_shadow s join listings l on l.id=s.listing_id
where s.version=(select max(version) from match_shadow s2 where s2.listing_id=s.listing_id) group by 1,2,3 order by 1,2,3
```

## Cómo leer los resultados

- **Ofertas por producto cerca de 1** con varias tiendas: casi no hay fusiones entre tiendas. Mirar las revisiones
  pendientes antes de tocar umbrales.
- **`category:other` con productos reales** es Haiku descartando algo que sí es de la categoría: mirar el `reason`
  del payload. Desde #14 ya no hay `attribute:missing:*`; las filas viejas se purgan solas a los 14 días.
- **`condition:not_new`** es correcto para usados y open box; revisar sólo si aparecen productos nuevos.

## Trampas

- **La cuarentena re-registra los rechazos en cada corrida** (se purga a los 14 días). Los conteos son filas, no
  ofertas distintas: para medir una corrida, filtrar por `run_id`.
- **D1 rechaza `UNION ALL` largos** ("too many terms in compound SELECT"). Usar subconsultas escalares en un solo
  `SELECT`, como en el resumen.
- **`LIKE` en D1 admite como máximo 50 bytes de patrón.**
- `listings.title` es el título limpio; el que publicó la tienda está en `raw_title` (desde la migración 0010).
