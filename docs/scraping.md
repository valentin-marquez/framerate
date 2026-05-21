# Guía de scraping

Cómo Framerate scrapea tiendas y cómo integrar una nueva. Léela completa antes
de escribir un crawler.

---

## 1. Contexto

- **`apps/collector` es el único servicio que escribe en la base de datos.** Los
  crawlers viven en `apps/collector/src/crawlers/`.
- Cada crawler extiende `BaseCrawler` (`src/crawlers/base.ts`).
- El collector es un servicio HTTP (Hono, puerto `3001`). Un crawl se dispara
  con `POST /v1/<tienda>/crawl` y corre en un `Worker` en segundo plano.
- Flujo: **crawler** (scrapea) → **strategy** (orquesta) → **pipeline**
  (normaliza, extrae specs) → **catalog service** (dedup por MPN, escribe
  `products` + `listings`).

### Filosofía: cada tienda es bespoke

**No hay un adapter genérico ni un registry con DI.** Cada tienda tiene su HTML,
su API y sus rarezas; un crawler bespoke por tienda es más simple de mantener y
depurar que una abstracción que intenta cubrir todas. La inversión va en
**tooling operacional** (logs, canary, esta guía), no en abstracción prematura.

No propongas `IAdapter` / registries / inyección de dependencias para los
crawlers. Copiá el crawler más parecido y ajustalo.

---

## 2. Vías de scraping — en orden de preferencia

Antes de escribir nada, **identificá la plataforma de la tienda** y elegí la vía
más alta de esta lista que aplique. Cuanto más arriba, más simple, rápido y
estable.

### A. WooCommerce Store API — _preferida_

Muchas tiendas chilenas usan WooCommerce. Expone una API JSON pública y
paginada, **sin navegador**:

```
GET /wp-json/wc/store/v1/products?category=<slug>&per_page=100&page=<n>
GET /wp-json/wc/store/v1/products/categories?per_page=100
```

Devuelve `name`, `sku`, `prices`, `is_in_stock`, `stock_availability`,
`images`, `attributes`, etc. Es la vía ideal: JSON estable, sin parsing de HTML.

**Ejemplos en el repo:** `tectec.ts`, `dust2.ts`.

### B. API JSON propia de la tienda

Aunque no sea WooCommerce, muchas tiendas tienen un endpoint JSON interno (el
que consume su propio frontend). Buscalo en las DevTools → Network. Si existe,
es casi tan bueno como A.

**Ejemplo:** `myshop.ts` (usa `ApiStrategy`).

### C. HTMLRewriter

Parser de HTML _streaming_ nativo de Bun. Sin navegador, muy rápido. Sirve para
HTML servido del lado del servidor (SSR estático).

**Ejemplo:** `pc-express.ts`.

### D. `fetch` + `cheerio`

`fetch` del HTML + parsing con `cheerio` (jQuery-like). Para páginas estáticas
cuando HTMLRewriter no alcanza. Sin navegador.

### E. Puppeteer + stealth — _último recurso_

Navegador headless con plugin _stealth_. Úsalo **sólo** si la tienda renderiza
los productos con JavaScript en el cliente o tiene anti-bot que bloquea `fetch`.
Es lento, pesado (cada instancia consume cientos de MB) y frágil.

`BaseCrawler` ya gestiona el pool de páginas, el proxy y la extracción de
`__NEXT_DATA__` / payload RSC de Next.js. Para activarlo: `useHeadless = true`.

**Ejemplos:** `sp-digital.ts`, `centrale.ts`, `central-gamer.ts`, `notebooksya.ts`.

### Cómo detectar la plataforma

Mirá la home y headers de la tienda:

| Señal | Plataforma → vía |
|---|---|
| `/wp-json/wc/store/v1/products` responde JSON | WooCommerce → **A** |
| `wp-content`, `<meta name="generator" content="WordPress">` | WordPress/Woo → **A** o D |
| `cdn.shopify.com`, `Shopify` | Shopify → **B** (`/products.json`) |
| `__NEXT_DATA__` o `self.__next_f` en el HTML | Next.js → **E** con extracción de hydration |
| Productos sólo aparecen tras ejecutar JS (HTML vacío) | SPA → **E** |
| HTML ya trae los productos | SSR → **C** o **D** |

---

## 3. Anatomía de un crawler

Un crawler extiende `BaseCrawler<Category>` e implementa:

```ts
export class MiTiendaCrawler extends BaseCrawler<Category> {
  name = "MiTienda";
  baseUrl = "https://mitienda.cl";

  protected useHeadless = false; // true sólo si necesitás Puppeteer (vía E)
  protected concurrency = 4;     // requests/páginas en paralelo

  // Obligatorios:
  async parseProduct(content: string, url: string): Promise<ProductData | null> { ... }
  async getProductUrls(html: string): Promise<string[]> { ... }

  // Opcional — si la tienda permite listar por categoría (vías A/B):
  async getAllProductUrlsForCategory(category: Category): Promise<string[]> { ... }
}
```

- **`getAllProductUrlsForCategory`** — si existe, la strategy crawlea por
  categoría (recomendado: scrapea sólo lo relevante). Si no, usa `getProductUrls`
  sobre HTML de páginas de listado.
- **`fetchHtml`** se puede sobreescribir. Los crawlers de WC Store API lo
  override­an para devolver el JSON de la API en vez de HTML (ver `tectec.ts`).
- **Mapa de categorías** — un `CategoryMap<string[]>` (de `@/constants/categories`)
  que traduce las 10 categorías internas de Framerate a slugs/ids de la tienda.
  Si la tienda no vende una categoría, dejá el array vacío.

### El contrato `ProductData`

`parseProduct` devuelve un `ProductData` (`src/crawlers/base.ts`):

| Campo | Obligatorio | Notas |
|---|---|---|
| `url` | ✅ | URL del producto |
| `title` | ✅ | Nombre del producto |
| `mpn` | ✅ **de facto** | Ver §4 — sin MPN el producto se descarta |
| `price` | ✅ | Precio efectivo/transferencia, entero CLP |
| `originalPrice` | — | Precio tarjeta/normal; si no hay, igual a `price` |
| `stock` | ✅ | `true`/`false` — ver §4, define `is_active` |
| `stockQuantity` | — | Cantidad, o `0` si sin stock, o `null` si desconocido |
| `imageUrl` | — | URL de imagen; el collector la sube a Storage |
| `specs` | — | Specs parciales (al menos `manufacturer` si lo tenés) |
| `context` | — | HTML/texto crudo para que la IA extraiga specs después |

---

## 4. Convenciones obligatorias (no negociables)

### MPN es obligatorio

El `CatalogService` **descarta** cualquier producto sin `mpn` — no hay fallback
a título. El MPN es la clave de dedup entre tiendas: la misma GPU en 3 tiendas
comparte MPN y se une en un solo producto.

- Usá el SKU / código de parte / **EAN / código de barras** del producto.
- Si la tienda no expone ninguno, último recurso: derivá un id estable del slug
  (`MITIENDA-<slug>`), pero eso rompe el dedup cross-tienda — evitalo.
- Clave de matching real: `(category_id, f_norm_mpn(mpn))`.

### `stock` y el flag `pending` definen la visibilidad

```
listings.is_active = (price > 0 && stock)        // listing que YA existe
listings.is_active = false                       // listing NUEVA de producto pending
```

Un producto con `stock = false` queda **invisible** en el catálogo y en la
página de tienda. Detectá el stock con el campo canónico de la plataforma (en
WC Store API es `is_in_stock`, booleano); si scrapeás un sub-objeto, confirmá
con más de una señal (`is_in_stock` **y** la clase `in-stock`).

> ⚠️ **Una tienda nueva necesita DOS pasadas de crawl.** Un producto que no
> matchea ningún MPN existente se crea `pending` (`pipeline: pending: !similarProduct`)
> y su **primera** listing nace `is_active = false` — buffer de staging antes de
> que sea público. En el **segundo** crawl la listing ya existe, el flag
> `pending` se ignora (`catalog.service.ts`) y `is_active` pasa a depender sólo
> de `price > 0 && stock`.
>
> Por eso al integrar una tienda nueva es **esperable** que el primer crawl deje
> casi todo inactivo. No es un bug de stock: crawleá una segunda vez y los
> productos con stock se activan. Si tras la 2ª pasada siguen todos inactivos,
> *ahí* sí sospechá de la detección de stock.

### Precios

- Enteros, en CLP, sin separadores ni símbolos (`parseMoney` → sólo dígitos).
- `price` = precio efectivo/transferencia. `originalPrice` = precio tarjeta
  (medio de pago, **no** un descuento — ver memoria del proyecto).

### Rate limiting y etiqueta

- `BaseCrawler` ya throttlea con `waitRateLimit()` / `requestDelay`. No lo
  desactives; subí `requestDelay` si la tienda se queja.
- Usá el User-Agent realista de `BaseCrawler` (`userAgents[0]`).
- No scrapees categorías que no sean componentes de PC aunque la tienda las
  tenga (TCG, consolas, electrodomésticos, etc.).

---

## 5. Integrar una tienda nueva — checklist

1. **Inspeccioná la plataforma** (§2). Confirmá la vía de scraping y, si hay API
   de categorías, los slugs que mapean a las 10 categorías de Framerate.
2. **Crawler:** `apps/collector/src/crawlers/<tienda>.ts`. Copiá el crawler
   existente más parecido (mismo tipo de plataforma) y ajustá.
3. **Ruta:** `apps/collector/src/routes/v1/<tienda>.route.ts` — copiá una
   existente (`tectec.route.ts` para vías A/B, otra para Puppeteer).
4. **Registrá la ruta** en `apps/collector/src/routes/index.ts`.
5. **Factory:** agregá un `case "<tienda>"` en
   `apps/collector/src/collector/factory/crawler.factory.ts`.
6. **Tienda en la BD:** insertá la fila en `stores`
   (`{ slug, name, url, is_active: true }`). Sin esa fila `getStoreId()`
   devuelve `null` y las listings no se pueden crear.
7. **Probá** con una sola categoría:
   ```
   POST http://localhost:3001/v1/<tienda>/crawl?category=cpu
   ```
   Tras el 1er crawl, en la BD deberían existir `listings` para la tienda — casi
   todas `is_active = false` (productos nuevos `pending`, ver §4, es normal).
   Corré el **mismo crawl una 2ª vez**: las listings con stock pasan a
   `is_active = true`. Recién con eso verificado, corré `?category=all`
   (también en dos pasadas).

El `slug` del crawler, el `slug` de la fila en `stores` y el segmento de la ruta
**deben coincidir** (ej. `dust2` en los tres lados).

---

## 6. Operación

- **Disparar un crawl:** `POST /v1/<tienda>/crawl` (todas las categorías) o
  `?category=<cat>` (una). Responde al instante; el trabajo corre en un Worker.
- **Monitorear:** el `Logger` compartido escribe a consola **y** a
  `apps/collector/logs/dev.log`. Señales útiles:
  - `Job completed: N products in Xs` — el crawl terminó de scrapear.
  - `Worker ... finalizado` — el Worker cerró.
  - `[ERROR]` — revisá `apps/collector/logs/dev.log`.
- **Categorías válidas:** las 10 de `CategorySchema`
  (`src/constants/categories.ts`): `gpu, cpu, psu, motherboard, case, ram, hdd,
  ssd, case_fan, cpu_cooler`.

---

## 7. Referencia rápida de crawlers existentes

| Crawler | Plataforma | Vía | Headless |
|---|---|---|---|
| `pc-express.ts` | — | C (HTMLRewriter) | No |
| `tectec.ts` | WooCommerce | A (WC Store API) | No |
| `dust2.ts` | WooCommerce | A (WC Store API) | No |
| `myshop.ts` | — | B (API propia) | No |
| `sp-digital.ts` | — | E (Puppeteer) | Sí |
| `centrale.ts` | — | E (Puppeteer) | Sí |
| `central-gamer.ts` | — | E (Puppeteer) | Sí |
| `notebooksya.ts` | — | E (Puppeteer) | Sí |

Para una tienda WooCommerce nueva, `dust2.ts` es el mejor punto de partida.
