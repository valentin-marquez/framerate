# Tiendas candidatas

Qué tiendas chilenas conviene integrar al scraper (`apps/ingest`), cómo se scrapea cada una y qué tan bien
alimentan la huella de producto. Base: un sondeo del 30-09-2026 sobre las tiendas que lista SoloTodo.

> Los datos de las tiendas cambian. Antes de integrar una, verifica de nuevo lo que dice aquí con un crawl real
> (`POST /v1/admin/crawls`) y la cuarentena.

## Resumen

- SoloTodo lista 316 tiendas chilenas. **72 venden hoy componentes de PC**, y 56 tienen 15 o más ofertas: esas se
  evaluaron a fondo.
- **25 son WooCommerce con la Store API abierta.** El adaptador que ya existe les sirve con sólo configurarlo.
- **4 están fuera de alcance mientras sólo usemos `fetch`**, porque bloquean con Cloudflare: Winpy (la más
  grande), SP Digital, CTMAN y Nice One.
- Las multitiendas (Mercado Libre, Falabella, Paris, Ripley, Lider…) casi no venden componentes. No se integran.

### Cómo se midió

- Las tiendas y sus ofertas salen de la API pública de SoloTodo (`publicapi.solotodo.com`). SoloTodo también
  registra el SKU, el part number y los dos precios de cada oferta, y eso se usó como segunda fuente.
- Por tienda se hicieron de 3 a 5 peticiones (portada, una ficha real y el endpoint de la plataforma), sin
  navegador.
- **Límite importante:** se probó desde una red local, no desde un Worker de Cloudflare. Un Worker tiene otra IP y
  otra huella TLS, así que los bloqueos de Cloudflare pueden comportarse distinto. Además, un filtro DNS local
  impidió verificar Tekmachine, TYT Gamer, AllTec, Gestion y Equipos y CSByte.
- En la tabla del anexo, **V** = verificado con una petición real, **ST** = dato de SoloTodo sin verificar,
  **inf** = inferencia.

## Qué necesita el scraper de una tienda

El contrato es `RawOffer` (`apps/ingest/src/features/ingestion/domain/normalize.ts`). Lo que decide la calidad:

| Dato | Por qué importa | Cómo suele venir |
|---|---|---|
| MPN o GTIN del fabricante | Capa 1 de la huella: vínculo automático entre tiendas | SKU (a veces), JSON-LD `mpn`/`gtin13`, atributo de la tienda o dentro del título |
| Marca | Bloqueo y veto del matching | Atributo "Marca", `brands` de WooCommerce, JSON-LD `brand` |
| Título descriptivo | De ahí salen los atributos (VRAM, capacidad, watts…) | Varía mucho: desde "RTX 5060 8GB Ventus" hasta títulos sin marca |
| Precio transferencia y precio tarjeta | Lo que ve el usuario | Casi nunca vienen los dos en la API (ver abajo) |
| Stock | Las listas sólo muestran productos con stock | Booleano en casi todas; cantidad en algunas |

### Trampa de precios en WooCommerce

La Store API trae `price` y `regular_price`, pero **cada tienda los usa distinto** (comparado contra SoloTodo en
25 tiendas):

| Qué significa en la tienda | Tiendas | Cómo se configura hoy |
|---|---|---|
| `price` = transferencia; la tarjeta es un recargo que sólo aparece en el HTML | Infor-Ingen (+6 %), Dust2 (+7 %), TecTec (+4 %), Progaming (+5 %), KDTEC (+2,2 %), ETChile (+5 %), CCLink (+5 %), Tecno Master, DazBog, Café Digital, Electronica Budini, Trulu, Notebooksya, MegaBytes, Natcom, RS Tech | `cardMarkup` con el recargo verificado en la ficha; sin él, tarjeta = transferencia |
| `price` = **tarjeta**; la transferencia sólo en el HTML | Central Gamer (−5 %), Globalbox, Nuevatec (−5 %), Tecno Shopping (−3,5 %) | `cashDiscount` con el descuento verificado en la ficha |
| Un solo precio | Cintegral, Play Factory, Fiestalan, Xtreme Components | Sin configuración |

En muchas, `regular_price` es el **precio "antes"** tachado. Nunca debe guardarse como precio tarjeta.

### Identificadores: reglas que ya aplican

- Si el SKU es interno de la tienda, `sku: "internal"`. Un SKU que resulte ser un GTIN válido se usa igual como GTIN.
- **Códigos de mayorista que parecen MPN** (`CS000ASU13`, `NW000QNA71`, en KDTEC y Notebooksya): no son del
  fabricante, así que `internal`.
- **Pendiente de decidir, como política en `normalize` y no por tienda:**
  - El MPN dentro del título (`[GV-N5060WF2OC-8GD]`, `p/n 90-ga5lzz-00uanf`) aparece en Natcom, Nuevatec,
    Electronica Budini, Tecno Saga, Wei, PC Express y Nice One. Extraerlo sería leerlo, no inventarlo.
  - El SKU con prefijo + MPN (`GPU-PRIME-RTX5080-O16G`) aparece en Cintegral y Trulu. Quitarle el prefijo ya es
    derivar un identificador; mientras no se decida, `internal`.
- Varias tiendas venden **usados** (TecTec, DazBog, Xtreme Components). Hoy van a cuarentena (`condition:not_new`).

## Estado de las integradas

| Tienda | Configuración | Notas |
|---|---|---|
| TecTec | WooCommerce, `sku: "internal"`, tarjeta +4 % | Casi todo lo que vende es usado certificado: aporta poco. La migración 0009 limpió los MPN falsos que dejó |
| Dust2 | WooCommerce, `sku: "internal"` (el SKU es EAN-13), tarjeta +7 %, con GPU | Probablemente la misma empresa que Progaming (mismos EAN y hosting) |
| Infor-Ingen | WooCommerce, `sku: "internal"`, tarjeta +6 % | La ficha muestra siempre tarjeta = transferencia × 1,06. En ~20 % de los productos `regular_price` es un "antes" inflado (× 1,272) que no se muestra: no sirve como precio tarjeta. Mucho catálogo agotado |
| ETChile | WooCommerce, `sku: "mpn"`, tarjeta +5 % ("Precio otros métodos de pago") | SKU = MPN real casi siempre; algunas placas traen un código propio (`GBTB550MDS3HAC1W`) |
| Nuevatec | WooCommerce, `sku: "mpn"`, `cashDiscount: 0.05` | `price` = Webpay; "Oferta Internet - Transferencia" −5 %. Catálogo chico (~80 válidas) |
| CCLink | WooCommerce, `sku: "mpn"`, tarjeta +5 % | SKU = MPN o UPC. ~130 válidas, fuerte en discos |
| Progaming | WooCommerce, `sku: "internal"` (EAN), tarjeta +5 % | Mezcla ventiladores en "Refrigeración": `normalize` los aparta (`category:case_fan`) |
| Central Gamer | WooCommerce, `sku: "internal"`, `cashDiscount: 0.05` | Vende sobre todo PCs armados; ~55 componentes |
| MyShop | Adaptador `myshop` (`POST /servicio/producto`), `minIntervalMs: 2500` | Dry run del 30-09-2026: ~650 ofertas válidas, MPN 81–99 % según categoría, los dos precios en todas. Su Cloudflare corta con 429 (error 1015) a ~1,3 requests/s sostenidas |
| Sandos | Mismo adaptador, otro mapa de `idFamilia` | Dry run: ~260 válidas, MPN 65–100 %. `api: 1` = entrega diferida por distribuidor: se puede comprar, cuenta como stock |

Para evaluar una tienda antes de activarla: `bun run --cwd apps/ingest dry-run <tienda> [categoría]` (crawl real +
`normalizeOffer`, sin base): reporta cobertura de MPN, GTIN, marca y precios, marcas fuera del diccionario y la
cuarentena por motivo.

## Orden de integración recomendado

| # | Tienda | Ofertas | Trabajo | Por qué |
|---|---|---|---|---|
| 1 | MyShop | 548 | Adaptador nuevo (API JSON propia) | MPN o UPC, marca, los dos precios y stock en `POST /servicio/producto` |
| 2 | Sandos | 295 | Mismo adaptador que MyShop | Sólo cambia el mapa de familias (`idFamilia`) |
| 3 | ~~Infor-Ingen~~ | 578 | Integrada | `cardMarkup: 0.06`: su `regular_price` coincide con la tarjeta sólo a veces (ver abajo) |
| 4 | ETChile | 120 | Configuración | La mejor huella de las WooCommerce: SKU = MPN, GTIN y marca |
| 5 | ~~Centrale~~ | 593 | No integrar | Protege los precios con un plugin anti-scraping (`centrale-anti-scrape` + Turnstile): no quiere que la scrapeen. Candidata a la API abierta para tiendas |
| 6 | KDTEC | 303 | Configuración (`internal`) | Atributos muy completos |
| 7 | PC Factory | 321 | Descubrir endpoints | API JSON con `partNumber`, pero falta encontrar el listado y los precios |
| 8 | Tecnomas | 506 | Parser HTML | La mejor huella del lote: MPN, GTIN y marca en JSON-LD, los dos precios en el HTML |
| 9 | PC Express | 519 | Parser HTML (OpenCart) | JSON-LD con MPN y marca |
| 10 | NotebookStore y otras Jumpseller | 389 + | Adaptador Jumpseller (JSON-LD + HTML) | Después sirve para Thundertech, Tecnocam, Valrod y V Gamers |
| 11 | MyBox, Todoclick | 150 + 38 | Adaptador PrestaShop (búsqueda AJAX) | MPN y GTIN; probar si sirve para AllTec y TYT Gamer |
| 12 | WooCommerce chicas con MPN | — | Configuración | Tecno Shopping, Nuevatec, CCLink, Tecno Master, Progaming, Notebooksya, DazBog |
| 13 | Wei, Eylstore, Tecno Saga | 170 + 147 + 145 | Parsers HTML | MPN en la página (Tecno Saga, sólo en el título) |
| 14 | El resto | — | — | SKU interno, títulos pobres o usados |

**Descartadas o en pausa tras el sondeo del 30-09-2026:**

- Centrale: plugin anti-scraping para los precios (ver arriba).
- KDTEC: la Store API respondió a las primeras peticiones y después dejó de responder (timeout); reintentar otro día.
- Tecno Shopping: la Store API ahora devuelve HTML en vez de JSON.
- Tecno Master: la ficha muestra la tarjeta más barata que la transferencia (4.495.621 contra 4.616.610); aclarar antes de integrar.
- Notebooksya: casi todo son notebooks; pocos componentes.

**Fuera de alcance mientras sólo haya `fetch`:** Winpy, SP Digital, CTMAN y Nice One. Winpy tiene el catálogo más
grande: conviene probarla desde el Worker antes de descartarla, y si también bloquea, es la primera candidata para
Browser Rendering.

**Por verificar desde otra red:** Gestion y Equipos y CSByte (Shopify: si `/products.json` responde, son
fáciles), AllTec, Tekmachine y TYT Gamer.

## Anexo: las 56 tiendas evaluadas

Notas de 1 a 5. **Fac.** = facilidad de scraping (5 = API JSON sin bloqueo con todos los datos; 3 = HTML del
servidor; 1 = pide navegador o bloquea). **Huella** = compatibilidad con la huella de producto. Los hallazgos
sobre TecTec y Dust2 de esta tabla ya están corregidos.

| # | Tienda | URL | Ofertas ST | Plataforma | API JSON (endpoint) | Anti-bot | MPN/GTIN | Fac. | Huella | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Winpy | winpy.cl | 602 | No determinada (el challenge tapa la página) | No verificable | **V** 403, desafío gestionado de Cloudflare ("Just a moment…") en portada y ficha. `robots.txt` responde 200 (Crawl-delay 10) | **ST** MPN en 602/602 (`90-GA5LZZ-00UANZ`) | 1 | 4 (ST) | La tienda con más ofertas en SoloTodo. Necesita navegador |
| 2 | Centrale | centrale.cl | 593 | WooCommerce (V) | **V** sí, `/wp-json/wc/store/v1/products` (5.502 productos) | **V** el HTML da 403 ("Solicitud bloqueada", Cloudflare); la Store API da 200 | **V** SKU interno (`58728`), `brands` presente. **ST** MPN en 593/593 (sale del HTML) | 4 | 3 | La API sólo da transferencia (398.500); la tarjeta (420.420) está en el HTML bloqueado. El legado usaba navegador para el HTML |
| 3 | Infor-Ingen | store.infor-ingen.com | 578 | WooCommerce (V) | **V** sí, Store API (1.598) | **V** 200 | **V** SKU interno (`69734`), `brands` sí, sin MPN (ST 0/578) | 5 | 3 | Única Woo con `price` = transferencia y `regular` = tarjeta (V, coincide con ST). Stock en texto ("10 disponibles"). Títulos en mayúsculas pero con modelo y VRAM |
| 4 | MyShop | myshop.cl | 548 | Propia (Vue) | **V** sí, `POST /servicio/producto` `{"tipo":"3","page":"1","idFamilia":"33"}` (65 GPU, 12 por página) | **V** 200 (Cloudflare sin desafío). `www` redirige con 308 al dominio sin www | **V** `partno` = MPN (`GT710-SL-2GD5-BRK-EVO`) o UPC (`824142126905`), `marca`. JSON-LD con `mpn` y `brand` | 5 | 5 | `precio` = transferencia, `precio_tarjeta` = tarjeta, `precio_normal` = "antes", `stock_total`. Hay código legado |
| 5 | PC Express | tienda.pc-express.cl | 519 | OpenCart (V) | No | **V** 200 (LiteSpeed) | **V** JSON-LD `mpn` (`90-GA5LZZ-00UANF`) y `brand`; `sku` = "--" | 3 | 4 | El título trae "p/n". Los dos precios están en el HTML. El legado usaba HTMLRewriter |
| 6 | Tecnomas | tecnomas.cl | 506 | Propia (BunnyCDN) | No encontrada | **V** 200 | **V** JSON-LD `sku` = `mpn` (`DUAL-RTX3060-O12G-V2`), `gtin` (`195553309899`) y `brand` | 3 | 5 | Los dos precios vienen en el HTML del servidor (V: $428.990 y "webpay" $439.990). La mejor huella del lote |
| 7 | NotebookStore | notebookstore.cl | 389 | Jumpseller (V) | No (inf: Jumpseller no publica el catálogo) | **V** 200 | **V** JSON-LD `sku` = MPN (`90YV0GB2-M0AA10`) y `brand`; sin GTIN | 3 | 4 | El `price` del JSON-LD es el de tarjeta; la transferencia está en el HTML (`lowPrice`, `custom-price-value`). Hay títulos con errores ("Asis") |
| 8 | PC Factory | pcfactory.cl | 321 | Propia (Vue) con API `api.pcfactory.cl` | **V** parcial: `GET api.pcfactory.cl/pcfactory-services-catalogo/v1/catalogo/productos/{id}` (`partNumber`, `marca`, `stock.aproximado`) y el menú `api-dex-catalog/v1/catalog/category/PCF/menu`. No encontré el endpoint de listado ni el de precios | **V** 200 (Cloudflare sin desafío) | **V** `partNumber` = MPN (`90YV0PS0-M0AA00`) y `marca`; sin JSON-LD | 4 | 4 | Los precios no vienen ni en el HTML del servidor ni en la ficha JSON: falta descubrir de dónde salen (SoloTodo sí obtiene los dos) |
| 9 | KDTEC | kdtec.cl | 303 | WooCommerce (V) | **V** sí (5.775 productos, mucho que no es de PC) | **V** 200 | **V** mixto: MPN (`90YV0GB2-M0AA10`) y códigos de mayorista (`CS000ASU13`). Marca en el atributo "Marca" | 4 | 3 | Atributos muy completos (VRAM, GPU, interfaz). `price` = `regular` = transferencia; la tarjeta (+2,2 %) sólo en el HTML |
| 10 | Sandos | sandos.cl | 295 | Propia, la misma de MyShop (V) | **V** sí, `POST /servicio/producto` (los `idFamilia` no son los de MyShop) | **V** 200 | **V** `partno` = MPN (`SDCE/256GB`) y `marca`; JSON-LD `mpn` | 5 | 5 | Mismo adaptador que MyShop con otro mapa de familias. Da `precio` y `precio_tarjeta` |
| 11 | Nice One | n1g.cl | 266 | PrestaShop (inf, por el formato de URL) | No verificable | **V** 403, desafío de Cloudflare | **ST** sin MPN; el MPN va al final del título | 1 | 3 | |
| 12 | SP Digital | spdigital.cl | 213 | No determinada | No verificable | **V** 403 "Sorry, you have been blocked" (bloqueo WAF de Cloudflare) | **ST** SKU interno (`NA0000099658`), MPN en 213/213 | 1 | 4 (ST) | El legado usaba Puppeteer |
| 13 | CTMAN | ctman.cl | 205 | Shopify (inf: URL `/products/…`) | **V** no: `/products.json` también da 403 | **V** 403, desafío de Cloudflare ("Estamos verificando tu navegador") | **ST** MPN en 205/205 | 1 | 4 (ST) | |
| 14 | Dust2 (integrada) | dust2.gg | 184 | WooCommerce (V) | **V** sí (6.508, incluye TCG) | **V** 200 | **V** SKU = EAN-13 (`4711581490031`); marca en el atributo "Marca" | 4 | 4 | La tarjeta (+7 %) sólo está en el HTML. No mapea GPU |
| 15 | Notebooksya | notebooksya.cl | 183 | WooCommerce (V) | **V** sí (1.334) | **V** 200 | **V** mixto: modelo (`DUAL-RTX3060-O12G-V2`) y códigos de mayorista (`CS000ASU31`) | 4 | 3 | `regular` = "antes" (469.900); la tarjeta (438.378) sólo en el HTML |
| 16 | Gestion y Equipos | gestionyequipos.cl | 176 | Shopify (**V** el DNS da `23.227.38.65`, IP de Shopify; URL `/collections/…/products/…`) | Sin verificar (no hubo conexión desde esta red) | ? | **ST** SKU = texto de modelo (`GTX-1660-Ti-DDR6-6G`) | ? (5 si `/products.json` responde) | 2 | 117 de sus 176 ofertas son HDD; perfil de venta a empresas |
| 17 | Wei | wei.cl | 170 | Propia (PHP) | No | **V** 200 | **V** "Part Number: RX7600 CL 8GO" en el HTML y también en el título; sin JSON-LD | 3 | 4 | Dos precios (ST) |
| 18 | Progaming | progaming.cl | 166 | WooCommerce (V) | **V** sí (1.409) | **V** 200 | **V** SKU = EAN (los mismos que Dust2); atributo "Marca" | 4 | 4 | La tarjeta (+5 %) sólo en el HTML |
| 19 | MyBox | mybox.cl | 150 | PrestaShop (V) | **V** sí, por AJAX: `/busqueda?s=…` con `X-Requested-With: XMLHttpRequest` y `Accept: application/json` → `products[]` (`reference`, `manufacturer_name`, `price_amount`) | **V** 200 | **V** `reference` = MPN; JSON-LD con `mpn`, `gtin13` (`4711387868393`) y `brand` | 4 | 5 | En ese JSON, `price` = tarjeta y `regular` = "antes"; la transferencia (−5 %) está en el HTML |
| 20 | MegaBytes | megabytes.cl | 147 | WooCommerce (V) | **V** sí (380) | **V** 200 | **V** SKU interno (`11267`), sin marca | 4 | 2 | `regular` = "antes"; la tarjeta sólo en el HTML. Hay fichas bajo `/sitio-nuevo/` |
| 21 | AllTec | alltec.cl | 147 | PrestaShop (inf, URL `/amd/2492-….html`) | Sin verificar (no hubo conexión) | ? | **ST** MPN en 147/147 | ? | 4 (ST) | |
| 22 | Eylstore | eylstore.cl | 147 | Next.js con App Router (V) | No encontrada | **V** 200 | **V** JSON-LD `sku` = MPN (`GV-N5050WF2OC-8GD`) y `brand` | 3 | 4 | Datos en el RSC (`self.__next_f`) y en el JSON-LD del servidor |
| 23 | Tecno Saga | tecnosaga.cl | 145 | Propia (PHP 7.2) | No | **V** 200 | **V** sin JSON-LD; ID interno; el MPN va al final del título | 3 | 3 | Los dos precios en el HTML (`price` y `producto-precio-tarjeta`) |
| 24 | Tecno Master | tecno-master.cl | 128 | WooCommerce (V) | **V** sí (362) | **V** 200 | **V** SKU = MPN en componentes (`DUAL-RTX5070-O12G`, `912-V532-019`), interno en notebooks; sin marca | 4 | 4 | La tarjeta sólo en el HTML |
| 25 | CCLink | cclink.cl | 123 | WooCommerce (V) | **V** sí (267) | **V** 200 | **V** SKU = MPN (`90YV0NQ0-M0AA00`) o UPC (`824142452837`); sin marca | 4 | 4 | `regular` = "antes"; la tarjeta (+5 %) sólo en el HTML |
| 26 | ETChile | etchile.net | 120 | WooCommerce (V) | **V** sí (735) | **V** 200 | **V** SKU = MPN (`90YV0L71-M0AA00`, `GP-UD850GM-PG5-V2`), `gtin` en el JSON-LD (`4711387860816`), atributos "Marca" y "Modelo GPU" | 4 | 5 | La tarjeta (+5 %) sólo en el HTML |
| 27 | Play Factory | playfactory.cl | 115 | WooCommerce (V) | **V** sí (217) | **V** 200 | **V** SKU interno (`MS-700027`), pero el JSON-LD trae `gtin` (`4711636335845`) | 4 | 3 | Un solo precio |
| 28 | Cintegral | cintegral.cl | 96 | WooCommerce (V) | **V** sí (729) | **V** 200 | **V** SKU = prefijo + MPN (`ETVAS90YV0NS0-M0AA00`); `brands` sí | 5 | 3 | Un solo precio; stock "+20 unidades" |
| 29 | DazBog Store | dazbogstore.cl | 89 | WooCommerce (V) | **V** sí (95) | **V** 200 | **V** SKU = MPN (`GV-N166TWF2OC-6GD`, `CMH32GX5M2D6000C38`); `brands` sí | 4 | 4 | Vende usados ("-USADA"); la tarjeta sólo en el HTML |
| 30 | V Gamers | vgamers.cl | 77 | Jumpseller (V) | No | **V** 200 | **V** SKU numérico interno (`77826332441153`); `brand` sí | 3 | 3 | |
| 31 | RS Tech | rstech.cl | 76 | WooCommerce (V) | **V** sí (244) | **V** 200 | **V** mixto: interno (`PCCOMPFUENTE1000PLATINUM`), modelo (`TRSP1000`) y UPC | 4 | 2 | Hay títulos sin marca ("Fuente de Poder 1000W Certificación Platino"). Se centra en refrigeración |
| 32 | Tecno Shopping | tecnoshopping.cl | 75 | WooCommerce (V) | **V** sí (802) | **V** 200 | **V** SKU = MPN (`90YV0NS0-M0AA00`); `brands` y JSON-LD `mpn` | 4 | 5 | `price` = tarjeta; la transferencia (−3,5 %) sólo en el HTML. Catálogo cargado a notebooks |
| 33 | MegaDrive | megadrivestore.cl | 72 | PrestaShop (V) | **V** no: la búsqueda AJAX redirige y devuelve 0 productos | **V** 200 | **V** JSON-LD `sku` = `mpn` = `0929` (código interno) | 3 | 2 | |
| 34 | Natcom | natcomchile.cl | 64 | WooCommerce (V) | **V** sí (83) | **V** 200 | **V** SKU interno (`0308202634`); MPN entre corchetes en el título | 4 | 3 | `regular` = "antes" |
| 35 | Nuevatec | nuevatec.cl | 63 | WooCommerce (V) | **V** sí (320) | **V** 200 | **V** SKU = MPN (`GV-N506TEAGLE OC-8GD`); atributo "Marca"; MPN también en el título | 4 | 4 | `price` = tarjeta; la transferencia (−5 %) sólo en el HTML |
| 36 | Bookcomputer | bookcomputer.cl | 58 | Jumpseller (V) | No | **V** 200 | **V** SKU = UPC (`824142452837`); sin marca; el UPC va pegado al título | 3 | 3 | Un solo precio (ST) |
| 37 | Café Digital | cafedigital.cl | 56 | WooCommerce (V) | **V** sí (66) | **V** 200 | **V** SKU = nombre de modelo (`MAG A1000GLS PCIE5`); sin marca | 4 | 2 | |
| 38 | UG Store | ugstore.cl | 51 | Jumpseller (V) | No | **V** 200 | **V** la ficha no tiene JSON-LD; **ST** SKU interno | 3 | 2 | |
| 39 | Central Gamer | centralgamer.cl | 50 | WooCommerce (V) | **V** sí (244) | **V** 200 | **V** SKU interno (`ASUSTARRTX306012G`, `CG…`); `brands` sí | 4 | 3 | `price` = tarjeta; la transferencia (−5 %) sólo en el HTML |
| 40 | TecTec (integrada) | tectec.cl | 49 | WooCommerce (V) | **V** sí (107) | **V** 200 | **V** SKU interno (`0307002A03N-2`); la configuración actual dice `mpn` | 4 | 2 | Casi todo usados certificados; `regular` = "antes" |
| 41 | Thundertech | thundertech.cl | 46 | Jumpseller (V) | No | **V** 200 | **V** SKU = MPN (`ZT-B50700H-10A`); `brand` sí | 3 | 4 | |
| 42 | Mercado Store | mdstore.cl | 45 | Jumpseller (V) | No | **V** 200 | **V** SKU interno (`MS02910`); `brand` sí | 3 | 2 | En la ficha no coinciden la URL (650W) y el título (750W) |
| 43 | Trulu Store | trulustore.cl | 43 | WooCommerce (V) | **V** sí (115) | **V** 200 | **V** SKU = prefijo + MPN (`GPU-PRIME-RTX5080-O16G`); `brands` sí | 4 | 3 | La tarjeta sólo en el HTML |
| 44 | Todoclick | todoclick.cl | 38 | PrestaShop (V) | **V** sí, la misma búsqueda AJAX que MyBox (`reference`, `manufacturer_name`) | **V** 200 (Cloudflare sin desafío) | **V** JSON-LD `mpn` (`912-V812-201`) y `brand` | 4 | 4 | |
| 45 | Electronica Budini | electronicabudini.cl | 35 | WooCommerce (V) | **V** sí (123) | **V** 200 | **V** SKU vacío en la API; MPN entre corchetes en el título | 4 | 3 | La tarjeta sólo en el HTML |
| 46 | Tecnocam | tecnocam.cl | 32 | Jumpseller (V) | No | **V** 200 | **V** SKU = MPN (`SNV3S/1000G`); `brand` con errores ("Kinsgton") | 3 | 4 | Sólo RAM y SSD |
| 47 | Tekmachine | tekmachine.cl | 31 | WooCommerce (inf, URL `/product/…`) | Sin verificar (filtro DNS local) | ? | **ST** SKU = MPN (`RX9060XT CL 16GO`) | ? | 4 (ST) | |
| 48 | Fiestalan | fiestalan.cl | 31 | WooCommerce (V) | **V** sí (411) | **V** 200 | **V** SKU abreviado (`msia650gn`); a veces MPN real (`G506T-16V2CP`); sin marca | 4 | 2 | `regular` = "antes" |
| 49 | TYT Gamer | tytgamer.cl | 28 | PrestaShop (inf, por URL) | Sin verificar (filtro DNS local; contra la IP real respondió 301 y 302) | ? | **ST** sin MPN; MPN en el título | ? | 3 | |
| 50 | Valrod | valrod.cl | 28 | Jumpseller (V) | No | **V** 200 | **V** SKU = MPN (`31AT075001P01`); `brand` sí | 3 | 4 | Casi todo gabinetes |
| 51 | Xtreme Components | xtremecomponents.cl | 27 | WooCommerce (V) | **V** sí (184) | **V** 200 | **V** SKU vacío; títulos cortos | 4 | 1 | Muchos usados |
| 52 | Invasión Gamer | invasiongamer.com | 27 | Jumpseller (V) | No | **V** 200 | **V** SKU nulo; `brand` sí | 3 | 2 | |
| 53 | Globalbox | globalbox.cl | 24 | WooCommerce (V) | **V** sí (343) | **V** 200 | **V** SKU = modelo (`CS850XTK08`); atributo "Marca" | 4 | 3 | `price` = tarjeta. Marcas genéricas (Xtech) |
| 54 | CSByte | csbyte.cl | 22 | Shopify (**V** IP de Shopify; URL `/collections/…/products/…`) | Sin verificar (no hubo conexión) | ? | **ST** SKU interno | ? | 2 | |
| 55 | Casa Royal | casaroyal.cl | 19 | VTEX (V: `generator vtex.render-server`) | **V** sí, `/api/catalog_system/pub/products/search` (206 con datos) | **V** 200 (CloudFront) | **V** el `gtin` del JSON-LD es falso (es el código interno `00107671`); `ean` vacío en la API | 5 | 1 | Retail de oficina; sólo vende SSD y HDD |
| 56 | Campcom | campcom.cl | 16 | SPA en Vue/Vite (V), API propia `campcom.cl/api/v2/` (V, encontrada en el bundle) | No probada con datos | **V** 200 (HTML vacío) | ? | 2 | ? | |

Tiendas con menos de 15 ofertas (no las sondeé): TecnoSite (11), SCGlobal (9), OPC Store (8), Vantek (8), Travel Tienda (7), Alca Plus (5), Gaming House (4), ShopBox (4), LifeMax (4), ASUS Store (3), Gamingx (3), CNAVA (2), Compu Elite (1). Las ~240 tiendas chilenas restantes de SoloTodo no tienen hoy ninguna oferta de componentes disponible.

### Marketplaces y retail general

| Tienda | Tipo | Ofertas ST | Lo que verifiqué (1 petición) |
|---|---|---|---|
| Mercado Libre | Marketplace | 61 (MPN en 31, ST) | Web 200 (CloudFront). **La API pública `api.mercadolibre.com/sites/MLC/search` responde 403** (V): hoy pide una app con OAuth |
| Mercado Libre LG / Samsung | Tiendas oficiales dentro de ML | 0 | No probé |
| Falabella | Retail | 9 (sólo SSD) | 200, Next.js detrás de Cloudflare (V) |
| Falabella Marketplace | Marketplace | 7 | La misma plataforma |
| Paris / Paris Marketplace | Retail / marketplace | 0 / 0 | 200, Next.js detrás de CloudFront (V) |
| Ripley / Ripley Marketplace | Retail / marketplace | 0 / 0 | 200, Next.js detrás de Cloudflare (V) |
| Lider / Lider Marketplace / Lider Supermercado | Retail / marketplace | 1 / 0 / 0 | La portada responde 307 (V); no seguí la redirección |
| Hites | Retail | 0 | 200, Cloudflare (V) |
| AbcDin / ABC | Retail | 0 | 301, Cloudflare (V) |
| La Polar | Retail | 0 | 301, Cloudflare (V) |
| Sodimac, Easy, Tottus, Jumbo, Santa Isabel, Acuenta, Alvi, Corona, Linio | Retail general | 0 | No probé (Linio cerró en Chile) |
| Tiendas de marca (ASUS Store, Lenovo, HP Online, Dell, Samsung Shop, Apple Store, Xiaomi, Huawei, Sony, LG, Acer, Motorola) y telcos (Claro, Entel, Movistar, WOM) | Marca / operador | 0 a 3 | No probé |
