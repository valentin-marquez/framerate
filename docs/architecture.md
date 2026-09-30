# Arquitectura de Framerate (v2)

Reconstrucción desde cero del backend. Objetivo: **datos correctos antes que
datos completos**, un solo despliegue barato en Cloudflare (tope US$10/mes) y
código organizado por *feature*, no por tipo de archivo.

> Estado: `apps/server` y `packages/contracts` son la nueva base. Las apps
> `api`, `collector`, `tracker`, `cortex`, `janitor` y los paquetes `core`,
> `matcher`, `mpn-finder`, `opendb`, `utils` son **legado** y se retiran cuando
> `apps/web` consuma la API nueva (ver [Plan](#plan)).

---

## 1. Qué salió mal antes (y qué regla lo evita ahora)

| Problema del sistema anterior | Regla nueva |
|---|---|
| El mismo producto aparecía varias veces y no se podía fusionar. | Matching por **huella en capas** con evidencia guardada y revisión humana para casos dudosos (§5). |
| Se fusionaban productos distintos (ej. 8GB y 16GB). | **Vetos duros** por atributos discriminantes: si difieren, nunca se fusiona, ni con MPN igual. |
| Crawlers inventaban MPN (`TECTEC-slug`) y usaban EAN como MPN. | Los adaptadores **nunca inventan identificadores**; MPN/GTIN se validan (checksum) y ante duda son `null`. |
| Datos basura entraban a la base y no había cómo limpiarlos. | **Validación en la frontera** (Zod + reglas de negocio). Lo inválido va a `quarantine` con su motivo, nunca a `listings`. |
| Disk IO de Supabase agotado. | `price_points` guarda **sólo cambios**; polling reemplazado por Cron + Queues; D1 cobra por filas, no por IO. |
| 6 servicios, 3 runtimes, Docker, colas en Postgres. | **Un Worker** con tres disparadores (HTTP, Cron, Queue). |
| Lógica mezclada entre apps ("spaghetti"). | Organización por **feature** con dominio puro separado de IO (§3). |
| Un crawl parcial vaciaba el catálogo de una tienda. | **Guardia de salud**: si una corrida trae < 50% de lo esperado no desactiva nada; si trae 0, falla. |

## 2. Vista general

```
                  Cron (cada 6h)
                        │ encola 1 mensaje por (tienda, categoría)
                        ▼
┌───────────────────────────────────────────────────────────────┐
│ apps/server  (un Cloudflare Worker)                           │
│                                                               │
│  queue ──► ingestion ──► normalize ──► listings + price_points│
│              │  (adaptador        │ inválido → quarantine     │
│              │   por tienda)      ▼                           │
│              ▼                 matching ──► products          │
│        R2 snapshots               │ dudoso → match_reviews    │
│                                                               │
│  fetch ──► /v1/*        catálogo público (cache en el edge)   │
│        └─► /v1/admin/*  corridas, cuarentena, revisiones      │
└───────────────────────────────────────────────────────────────┘
        │ D1 (SQLite)         │ R2                  │ Queues (+DLQ)
```

`apps/web` (React Router en Workers) consume `/v1/*` y comparte tipos vía
`@framerate/contracts`.

## 3. Estructura del código

```
apps/server/
  migrations/                  SQL de D1 (autoridad del esquema)
  src/
    index.ts                   entrada: fetch / scheduled / queue
    app.ts                     composición HTTP (monta routers de features)
    env.ts                     bindings del Worker
    features/
      catalog/                 lectura pública: listado, búsqueda, detalle, historial
      ingestion/
        domain/normalize.ts    contrato RawOffer + validación + limpieza (puro)
        stores/                un adaptador por tienda + cliente HTTP + registro
        crawl-category.ts      caso de uso: una corrida (tienda, categoría)
        ingestion.repository.ts
        runtime.ts             cableado con Cron/Queues/R2
      matching/
        domain/                identificadores, marcas, atributos, huella, decisión (puro)
        match-listing.ts       caso de uso: vincular una oferta
        reviews.ts             caso de uso: resolver una revisión humana
        matching.repository.ts
    shared/                    sólo infraestructura transversal (db, http, logger, texto)
  test/                        integración contra D1 real (Miniflare)
packages/contracts/            esquemas Zod de la API compartidos con la web
```

Reglas:

1. **Una feature es dueña de sus tablas.** `ingestion` escribe `listings`,
   `price_points`, `crawl_runs`, `quarantine`; `matching` escribe `products`,
   `product_identifiers`, `match_*`; `catalog` sólo lee.
2. **`domain/` es puro**: sin D1, sin `fetch`, sin `Date.now()`. Se prueba sin
   mocks. El tiempo se inyecta (`Clock`).
3. **Casos de uso** (`crawl-category.ts`, `match-listing.ts`) orquestan dominio
   + repositorio. Reciben sus dependencias como parámetros.
4. **`shared/` no conoce features.** Si algo sólo lo usa una feature, vive en ella.
5. Sin DI containers ni registries mágicos: funciones y objetos planos.

## 4. Modelo de datos (D1)

| Tabla | Qué es | Invariantes clave |
|---|---|---|
| `stores` | Tiendas (se crean solas desde el registro en código). | `slug` único. |
| `listings` | Lo que vende UNA tienda. | `UNIQUE(store_id, external_id)`; `price_card >= price_cash > 0`. |
| `price_points` | Historial: **sólo cuando cambia** precio o stock. | — |
| `products` | Producto canónico que agrupa ofertas. | `slug` único; `attribute_key` indexada. |
| `product_identifiers` | MPN/GTIN normalizados de cada producto. | **PK (kind, value)**: un identificador pertenece a un solo producto. |
| `match_decisions` | Auditoría append-only de cada vínculo/desvínculo. | — |
| `match_reviews` | Casos dudosos para revisión humana. | Una revisión pendiente por oferta. |
| `crawl_runs` | Una corrida por (tienda, categoría) con estadísticas. | — |
| `quarantine` | Ofertas rechazadas con motivo y payload. | — |
| `products_fts` | Búsqueda FTS5 (sin tildes), sincronizada por triggers. | — |

Escrituras idempotentes: si la cola reintenta una corrida, el resultado es el
mismo. Oferta + punto de precio se escriben en un `batch` (atómico en D1).

## 5. Matching (huella de producto)

Se compara la huella de la oferta con candidatos (mismo identificador, misma
clave de atributos, o misma marca + texto similar por FTS):

1. **Vetos duros** → nunca es el mismo producto: distinta categoría, distinta
   marca, o un atributo discriminante distinto (VRAM, capacidad, modelo de CPU,
   chipset, OC vs no-OC…). Un veto gana incluso a un MPN igual.
2. **Identificador** (MPN o GTIN normalizados iguales) → vínculo automático.
3. **Clave de atributos** (`gpu|asus|rtx 4070 super|12|dual|true`):
   - En categorías donde la clave identifica un único producto (CPU) → vínculo.
   - En el resto, vínculo sólo si además la similitud de título es alta
     (score ≥ 0.85) y no hay MPN en conflicto.
4. **Zona gris** (score ≥ 0.6) → se crea producto propio (la oferta es visible
   de inmediato) + `match_review` proponiendo el candidato. Aceptar mueve la
   oferta y sus identificadores al candidato.
5. Si una oferta ya vinculada cambia (la tienda corrige título/MPN) y ahora hay
   un veto, se **desvincula** (auditado) y se vuelve a decidir.

Principio: **preferimos duplicados antes que fusiones erróneas.** Un duplicado
se arregla revisando; una fusión errónea mezcla precios en silencio.

Perfiles por categoría en `matching/domain/attributes.ts`. Mejorar el matching
de una categoría = mejorar su extractor + agregar casos al test.

**Hash de imagen (pendiente, ADR-4):** se agregará como evidencia *positiva*
dentro de la zona gris (nunca decide sola, porque variantes distintas comparten
foto del fabricante).

## 6. Agregar una tienda

1. Identificar la plataforma (WooCommerce → `createWooCommerceAdapter`; si no,
   escribir un adaptador que implemente `StoreAdapter`).
2. Agregar la entrada en `ingestion/stores/registry.ts`.
3. Guardar respuestas reales como fixture y testear el mapeo.
4. Verificar en producción: `POST /v1/admin/crawls {"store":"x","category":"gpu"}`,
   luego revisar `GET /v1/admin/crawls` y `GET /v1/admin/quarantine`.

Reglas del adaptador (ver `stores/adapter.ts`): sólo extrae datos crudos, nunca
inventa identificadores, siempre guarda snapshot.

## 7. Operación

```bash
# Una vez
bunx wrangler d1 create framerate                     # pegar database_id en wrangler.jsonc
bunx wrangler r2 bucket create framerate-snapshots
bunx wrangler r2 bucket lifecycle add framerate-snapshots snapshots-14d snapshots/ --expire-days 14
bunx wrangler queues create framerate-crawl
bunx wrangler queues create framerate-crawl-dlq
bunx wrangler secret put ADMIN_TOKEN

# Cada cambio de esquema
bun run --cwd apps/server db:migrate:remote

# Deploy
bun run --cwd apps/server deploy

# Local
bun run --cwd apps/server db:migrate:local
bun run --cwd apps/server dev
bun run --cwd apps/server test
```

Observabilidad: logs JSON estructurados (Workers Logs) con `feature`, `store`,
`category`, `runId`. Salud por tienda en `crawl_runs.stats`.

## 8. Costos estimados (a volumen actual)

| Ítem | US$/mes |
|---|---|
| Workers Paid (incluye D1, Queues, R2 free tier, Cron) | 5,00 |
| D1: 50M filas escritas y 25 mil millones leídas incluidas | 0 |
| Queues: 1M operaciones incluidas (≈ 280 mensajes/día) | 0 |
| R2: 10 GB incluidos (snapshots gzip, retención 14 días) | 0 |
| **Total** | **≈ 5** |

Pendientes que pueden sumar: Browser Rendering para tiendas que requieren
JavaScript (10 h/mes incluidas, luego US$0,09/h) y LLM si se agrega extracción
asistida.

## 9. Decisiones (ADR resumidos)

- **ADR-1 · D1 en vez de Postgres/Supabase.** Costo por uso, sin IO budget, sin
  servidor. Se pierde RLS: la autorización vive en la API (única que accede a
  la base). Límites de D1 (10 GB, un escritor) holgados para este volumen.
- **ADR-2 · Un Worker, tres disparadores.** Menos piezas que desplegar y
  monitorear. Las features siguen separadas en el código; si una crece, se
  extrae a su propio Worker sin reescribir (ya tiene sus límites claros).
- **ADR-3 · SQL a mano + Kysely como query builder tipado.** Las migraciones son
  revisables y aplican con `wrangler`. Los tests corren esas migraciones en D1
  real, así el esquema TS no puede desfasarse sin romper CI.
- **ADR-4 · Hash de imagen como evidencia secundaria**, no como llave. Pendiente
  de prueba de concepto (decodificar imágenes en Workers).
- **ADR-5 · Tiendas que requieren navegador**: primero buscar su API JSON; si no
  existe, Browser Rendering; si las bloquea, un job externo (GitHub Actions)
  que envía `RawOffer` a un endpoint admin. Se decide por tienda con datos.

## Plan

1. ✅ Base: esquema D1, contrato de tienda, pipeline de ingesta, matching con
   revisión, API de catálogo, tests contra D1 real.
2. Verificar TecTec y Dust2 en vivo (slugs de categoría, significado del SKU) y
   ajustar extractores con la cuarentena real.
3. Portar las demás tiendas (PC Express, MyShop, SP Digital, Centrale, Central
   Gamer, NotebooksYa), priorizando APIs JSON sobre navegador.
4. Migrar `apps/web` a `/v1` + `@framerate/contracts`; UI de revisión para admin.
5. Retirar las apps y paquetes legado.
6. Features de usuario (cuentas, cotizaciones, alertas de precio) sobre la base nueva.
