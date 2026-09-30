# Arquitectura de Framerate (v2)

Reconstrucción desde cero del backend. Objetivo: **datos correctos antes que
datos completos**, despliegue barato en Cloudflare (tope US$10/mes) y código
organizado por *feature*, no por tipo de archivo.

> Estado: `apps/server`, `apps/ingest` y los paquetes `contracts`, `database`,
> `matching` y `kit` son la nueva base. Las apps `api`, `collector`, `tracker`,
> `cortex`, `janitor` y los paquetes `core`, `matcher`, `mpn-finder`, `opendb`,
> `utils`, `db` son **legado** y se retiran cuando `apps/web` consuma la API
> nueva (ver [Plan](#plan)). El nombre `apps/api` está ocupado por el legado (y
> por un Worker en producción), por eso la API nueva se llama `apps/server`.

---

## 1. Qué salió mal antes (y qué regla lo evita ahora)

| Problema del sistema anterior | Regla nueva |
|---|---|
| El mismo producto aparecía varias veces y no se podía fusionar. | Matching por **huella en capas** con evidencia guardada y revisión humana para casos dudosos (§5). |
| Se fusionaban productos distintos (ej. 8GB y 16GB). | **Vetos duros** por atributos discriminantes: si difieren, nunca se fusiona, ni con MPN igual. |
| Crawlers inventaban MPN (`TECTEC-slug`) y usaban EAN como MPN. | Los adaptadores **nunca inventan identificadores**; MPN/GTIN se validan (checksum) y ante duda son `null`. |
| Datos basura entraban a la base y no había cómo limpiarlos. | **Validación en la frontera** (Zod + reglas de negocio). Lo inválido va a `quarantine` con su motivo, nunca a `listings`. |
| Disk IO de Supabase agotado. | `price_points` guarda **sólo cambios**; polling reemplazado por Cron + Queues; D1 cobra por filas, no por IO. |
| 6 servicios, 3 runtimes, Docker, colas en Postgres. | **Dos Workers** (API e ingesta) sobre una sola base D1, con Cron + Queues (§2). |
| Lógica mezclada entre apps ("spaghetti"). | Organización por **feature** con dominio puro separado de IO (§3). |
| Un crawl parcial vaciaba el catálogo de una tienda. | **Guardia de salud**: si una corrida trae < 50% de lo esperado no desactiva nada; si trae 0, falla. |

## 2. Vista general

Dos Workers con responsabilidades separadas, que comparten la misma base D1:

```
                          ┌────────────────────┐
        Usuario ────────► │      apps/web      │  React Router (SSR)
                          └─────────┬──────────┘
                                    │ /v1/*
                                    ▼
 ┌───────────────────────────────────────────────────────────────────┐
 │ apps/server   "lo que ve y toca el usuario"  (sólo HTTP)          │
 │  · catálogo público (cache en el edge)   · cuentas, cotizaciones… │
 │  · admin: corridas, cuarentena, revisión de matches               │
 │  Bindings: D1 · rate limit · INGEST (RPC)      ← sin cola, sin R2 │
 └──────┬────────────────────────────────────────────┬───────────────┘
        │ lee/escribe                                │ RPC: enqueueCrawls()
        ▼                                            ▼
 ┌────────────────────┐                 ┌───────────────────────────────┐
 │   D1  (SQLite)     │                 │ Queues  crawl (+ DLQ)         │◄── Cron 6 h
 │ usuarios, catálogo │                 └───────────────┬───────────────┘
 └─────────▲──────────┘                                 │ 1 mensaje = tienda + categoría
           │ escribe catálogo e ingesta                 ▼
 ┌─────────┴─────────────────────────────────────────────────────────────┐
 │ apps/ingest   "todo lo que toca tiendas externas"  (sin HTTP público) │
 │                                                                       │
 │  adaptador de tienda ─► normalizar ─► matching ─► oferta + precio     │
 │  (JSON / HTML)          (cuarentena)   (huella)                       │
 │  Bindings: D1 · R2 snapshots · cola (producir y consumir)             │
 └────────┬───────────────────────────────────┬──────────────────────────┘
          │ fetch                             │ tiendas que exigen JavaScript
          ▼                                   ▼
   tiendas (WooCommerce, JSON, HTML)    Browser Rendering / GitHub Actions
```

Por qué dos y no uno: un bug o un deploy del scraping no toca la API pública; y
cada Worker sólo tiene los permisos que usa (la API no ve la cola ni los
snapshots; `ingest` no recibe tráfico público). Cuesta lo mismo: Workers no cobra
por cantidad de Workers.

`apps/web` (React Router en Workers) consume `/v1/*` y comparte tipos vía
`@framerate/contracts`.

### Tipos de trabajo de scraping

| Tipo | Disparo | Qué hace | Estado |
|---|---|---|---|
| **Descubrir** | Cron cada 6 h | Recorre el catálogo completo de cada tienda/categoría. Pesado. | ✅ |
| **Bajo demanda** | Admin → `POST /v1/admin/crawls` → RPC a `ingest` | Igual que descubrir, para una tienda/categoría. | ✅ |
| **Refrescar** | Cron frecuente | Re-chequea sólo URLs ya conocidas (precio/stock). Liviano. | pendiente |

## 3. Estructura del código

```
apps/
  server/                       API HTTP (Worker "framerate-server")
    src/
      index.ts                  entrada: sólo fetch
      app.ts                    composición HTTP (monta routers de features)
      env.ts                    bindings del Worker
      features/
        catalog/                lectura pública: listado, búsqueda, detalle, historial
        identity/               login (Better Auth), sesión, perfil, roles y sanciones
        users-admin/            admin: buscar usuarios, suspender, cambiar rol
        crawl-admin/            admin: historial de corridas y cuarentena, "crawlear ahora"
        match-review/           admin: cola de revisión humana de matches
      shared/http/              errores, auth de admin, rate limit, cache
    test/                       integración contra D1 real (Miniflare)
  ingest/                       Scraping (Worker "framerate-ingest")
    src/
      index.ts                  entrada: scheduled (Cron) + queue + RPC (IngestRpc)
      features/ingestion/
        domain/normalize.ts     contrato RawOffer + validación + limpieza (puro)
        stores/                 un adaptador por tienda + cliente HTTP + registro
        crawl-category.ts       caso de uso: una corrida (tienda, categoría)
        ingestion.repository.ts
        runtime.ts              cableado con Cron/Queues/R2 y pedido de crawls
    test/
packages/
  contracts/                    esquemas Zod de la API + contrato RPC server↔ingest
  database/                     migraciones SQL, tipos Kysely, cliente D1, utilidades de test
  matching/                     huella de producto, decisión de matching, repositorio
  kit/                          texto, reloj y logger (sin dependencias)
```

Reglas:

1. **Una feature es dueña de sus tablas.** `ingest` escribe `listings`,
   `price_points`, `crawl_runs`, `quarantine`, y (vía `matching`) `products`,
   `product_identifiers`, `match_*`; `server` escribe usuarios, cotizaciones,
   comentarios, etc., y sólo *resuelve* revisiones de matching.
2. **`domain/` es puro**: sin D1, sin `fetch`, sin `Date.now()`. Se prueba sin
   mocks. El tiempo se inyecta (`Clock`).
3. **Casos de uso** (`crawl-category.ts`, `matchListing`) orquestan dominio
   + repositorio. Reciben sus dependencias como parámetros.
4. **Las apps no se importan entre sí.** Lo compartido vive en `packages/`; la
   única conversación `server` → `ingest` es el RPC tipado de
   `contracts/ingest.ts` (la API no conoce las tiendas ni la cola).
5. **`packages/database` es dueño del esquema.** Una migración afecta a ambos
   Workers; los tests de invariantes viven ahí.
6. Sin DI containers ni registries mágicos: funciones y objetos planos.

## 4. Modelo de datos (D1)

El modelo completo (identidad, organizaciones, tiendas y reseñas, cotizaciones,
comentarios, moderación, soporte y analítica), derivado de las funcionalidades
de la web, está en **[data-model.md](./data-model.md)**. Resumen del núcleo de catálogo:

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

Perfiles por categoría en `packages/matching/src/domain/attributes.ts`. Mejorar el matching
de una categoría = mejorar su extractor + agregar casos al test.

**Hash de imagen (pendiente, ADR-4):** se agregará como evidencia *positiva*
dentro de la zona gris (nunca decide sola, porque variantes distintas comparten
foto del fabricante).

## 6. Agregar una tienda

1. Identificar la plataforma (WooCommerce → `createWooCommerceAdapter`; si no,
   escribir un adaptador que implemente `StoreAdapter`).
2. Agregar la entrada en `apps/ingest/src/features/ingestion/stores/registry.ts`.
3. Guardar respuestas reales como fixture y testear el mapeo.
4. Verificar en producción: `POST /v1/admin/crawls {"store":"x","category":"gpu"}`,
   luego revisar `GET /v1/admin/crawls` y `GET /v1/admin/quarantine`.

Reglas del adaptador (ver `apps/ingest/src/features/ingestion/stores/adapter.ts`): sólo extrae datos crudos, nunca
inventa identificadores, siempre guarda snapshot.

## 7. Operación

```bash
# Requisitos: plan Workers Paid (los crawls superan los 10 ms de CPU del plan Free) y R2 activado.
# Usar wrangler >= 4.144 (`bunx wrangler@latest`): la 4.63 falla al crear colas.

# Una vez
bunx wrangler d1 create framerate          # pegar database_id en los 3 wrangler.jsonc:
                                           #   packages/database, apps/server, apps/ingest
bunx wrangler r2 bucket create framerate-snapshots
bunx wrangler r2 bucket lifecycle add framerate-snapshots snapshots-14d snapshots/ --expire-days 14
bunx wrangler queues create framerate-crawl
bunx wrangler queues create framerate-crawl-dlq

# Cada cambio de esquema (afecta a ambos Workers)
bun run db:migrate:remote

# Deploy — ingest primero: server lo referencia por service binding.
# server queda en https://api.framerate.cl (custom domain en su wrangler.jsonc).
bun run --cwd apps/ingest deploy
bun run --cwd apps/server deploy
cd apps/server && bunx wrangler secret put ADMIN_TOKEN

# Local
bun run db:migrate:local
bun run dev:server            # API
bun run dev:ingest            # scraping (Cron/Queue/RPC)
bunx turbo run check-types test --filter=server --filter=ingest \
  --filter=@framerate/kit --filter=@framerate/database \
  --filter=@framerate/matching --filter=@framerate/contracts
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
- **ADR-2 · Dos Workers (API e ingesta) sobre una base compartida.** Empezó como
  un solo Worker con tres disparadores; se separó porque el scraping y la API
  tienen ciclos de deploy, permisos y límites distintos (CPU de 120 s por crawl
  vs. respuestas de milisegundos) y mezclarlos ampliaba el radio de daño de
  cualquier cambio. El costo es idéntico. Se comunican sólo por RPC tipado
  (`contracts/ingest.ts`) y por la base. Un Worker extra para el navegador
  (ADR-5) encajaría igual: consume la misma cola.
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
1b. ✅ Modelo de datos completo basado en las features de la web (migraciones
   0001–0008, tipos Kysely, specs por categoría, tests de invariantes).
   Pendiente: implementar las features `stores`,
   `quotes`, `comments`, `moderation`, `support` y `analytics` sobre él.
1d. ✅ Identidad: Better Auth + Discord, registro de proveedores, perfil, roles,
   sanciones y administración de usuarios (ver [identity.md](./identity.md)).
   Pendiente: integrar `apps/web`, copiar avatares a R2, eliminar cuenta.
1c. ✅ Separación en `apps/server` (API) + `apps/ingest` (scraping) con paquetes
   compartidos (`database`, `matching`, `kit`, `contracts`) y RPC entre ambos.
   Pendiente: recalcular el resumen de precios de `products` tras cada corrida
   (hoy el catálogo agrega desde `listings` en cada request).
2. Verificar TecTec y Dust2 en vivo (slugs de categoría, significado del SKU) y
   ajustar extractores con la cuarentena real.
3. Portar las demás tiendas (PC Express, MyShop, SP Digital, Centrale, Central
   Gamer, NotebooksYa), priorizando APIs JSON sobre navegador.
4. Migrar `apps/web` a `/v1` + `@framerate/contracts`; UI de revisión para admin.
5. Retirar las apps y paquetes legado.
6. Features de usuario (cuentas, cotizaciones, alertas de precio) sobre la base nueva.
