# TODO

Estado al 2026-09-30. Producción: web `framerate.cl`, API `api.framerate.cl` (Workers `framerate`, `framerate-server`, `framerate-ingest`, D1 `framerate`).

## Para probar en producción
- [x] Reclamo por DNS con `nozz.skin` (30-09-2026): tienda `nozz` (id 3) sembrada, reclamo 2 verificado y confirmado (organización 1, owner `nozztutos`), perfil editado, error de usuario inexistente al sumar miembro OK. TXT quitado a las 22:46 UTC.
- [ ] Ver que el Cron pase el reclamo 2 a `stale` y congele `nozz` (3 fallas: ~12:17 UTC del 01-10-2026). Después borrar la tienda de prueba, su organización y el reclamo.
- [ ] Sumar un miembro, votar y responder una reseña: hace falta una segunda cuenta de Discord.
- [x] Login con Discord real y `/perfil` funcionan (callback registrado).
- [x] Google OAuth configurado (30-09-2026): proyecto de Google Cloud "Framerate" (`gen-lang-client-0491493857`), cliente web `framerate-server`, secretos `GOOGLE_CLIENT_ID`/`_SECRET` en `framerate-server` (copia local en `~/.config/framerate/`). `/v1/auth/providers` ya lista Google.
- [ ] **Publicar la app de Google** (Google Auth Platform → Audience → "Publish app"): mientras esté en "Testing" sólo entran usuarios de prueba. Después, probar login con Google y que se vincule a la cuenta de Discord con el mismo email.
- [x] Revocado el reclamo de prueba 1 de `tectec.cl` (30-09-2026).
- [x] `nozztutos` (Discord del dueño) es `admin` (30-09-2026); `/admin/users` funciona.

## Bugs vistos en producción (web `bb66fe3`, 30-09-2026; arreglados el mismo día)
- [x] **Todo 404 responde 500** (`/login`, `/favicon.ico`): `Error: Request info is not available` (`shared/hooks/use-request-info.ts`) al renderizar el ErrorBoundary sin loader del root. Falta además el favicon.
- [x] En la primera carga con sesión (`/perfil`) el navbar muestra "Entrar"; tras navegar muestra el usuario.
- [x] CSP `font-src` bloquea una fuente `data:` que Vite incrusta en el CSS.
- [x] Con sesión, la web pide `/v1/quotes` (404) dos veces por página.
- [x] Reclamo: el éxito dice "desde su panel de administración" sin enlace; un reclamo confirmado sigue mostrando "expira"; "Verificamos solos cada unos segundos"; el auto-verify choca con el enfriamiento (429 en consola).
- [x] Redacción en voseo argentino ("Reclamá", "Verificá", "vas a poder", "Ya podés") en reclamo y tienda: pasar a español de Chile neutro.
- [x] La URL de login de Discord pide `identify email` duplicado.
- [ ] Quedan lectores de `useAuthStore` con el mismo vacío en el primer render: `store-reviews` (3 archivos), `support/support-contact-panel`, `settings/pages/account`, `product/pages/product-details`, `shared/hooks/use-translation`, `getSessionToken()`. Pasarlos a `useUser`/`useProfile` y borrar el store y el efecto de `App`.
- [ ] "Crear cotización" hace POST a `/v1/quotes` (404) al enviar: ocultar el botón o construir la API (`QUOTES_API_ENABLED` en `quote/services/quotes.ts`).
- [ ] `apps/web` no tiene tests ni `check-types` en Turbo: `bun run --cwd apps/web typecheck` hay que correrlo a mano.

## Web: vistas y diseño
- [x] **Home**: se eligió v1 (mosaico de categorías con fotos, aparición escalonada). Sin desplegar aún.
- [x] **`/categoria/:slug` y `/explorar`**: una sola vista de catálogo (opción C: cabecera con foto o buscador con fichas, barra de filtros fija con marca/precio/stock/orden). `/explorar?category=` redirige a `/categoria/:slug`. Sin desplegar.
- [ ] Catálogo: referencias de motion desde X/Twitter (exige login: hay que pasar links o capturas) y pulir la cabecera (parallax, transiciones de página con View Transitions).
- [ ] Catálogo: filtros por especificación (chipset, VRAM, capacidad…) — se quitó el panel lateral porque la API v2 no los soporta; volver a agregarlos como chips cuando existan.
- [x] Reglas de animación y rendimiento del hilo principal en `CLAUDE.md` (base: artículo "The Expensive Main Thread").
- [ ] Auditar `MorphSearch` (interpola con el scroll en JS): ¿cabe en el presupuesto de ~10 ms/frame? Idealmente pasarlo a CSS scroll-driven animations.
- [ ] Transiciones de página con View Transitions (`<Link viewTransition>` en React Router v7): las resuelve el compositor.
- [ ] Dirección gráfica: definir lenguaje de motion (easing, duraciones, entradas escalonadas) y documentarlo; reutilizar `Reveal` (`shared/components/motion`) y `.enter-up`.
- [ ] Imágenes de stock: hay 10 de categoría y un banner de tienda (`public/img`, créditos en `CREDITS.md`). Falta usarlas en `/categoria/*`, `/explorar` y el fallback de banner; evaluar copiarlas a R2.
- [ ] URLs en español pendientes (convención del proyecto): `/privacy` → `/privacidad`, `/terms` → `/terminos`, con redirect 301 desde las inglesas. Ya están `/perfil` (301 desde `/profile`) y `/ajustes/*` (301 desde `/settings/*`).
- [x] Sistema de diseño en Storybook (`bun run --cwd apps/web storybook`, puerto 6006), Inter y paleta neutra inspirada en Luma; navbar, pie, login y ajustes rehechos.
- [ ] Redacción: muchas etiquetas en español usan mayúsculas de título en inglés ("Precio Normal", "Ver Oferta", "Especificaciones Técnicas"…). Pasar a mayúscula sólo inicial (`shared/lib/translations.ts`).
- [x] Tarjeta de producto única (v3, horizontal) en catálogo, home y tiendas; historia en Storybook "Producto/Tarjeta".
- [ ] Modales con el mismo parpadeo que tenía "Agregar a cotización" (velo animado sólo en opacidad con `motion`): `quote/components/store-selector.tsx` y `comments/components/quote-embed.tsx`. Pasarlos a CSS como `add-to-quote.tsx` cuando se retomen cotizaciones y comentarios.
- [ ] Quitar " · " como separador en el resto de la UI (el dueño lo ve "estilo IA"): comentarios, cotizaciones embebidas, reseñas, tickets, reclamo, admin de tiendas y soporte, y títulos de pestaña ("Tienda · Framerate").
- [ ] Nombres de producto con " | " de la tienda ("RTX 3050 | MSI Ventus 2X | 6GB GDDR6"): limpiarlos en la normalización de `ingest` para mostrar un nombre legible.
- [ ] **Rehacer el logo**: está mal construido y se ve mal (sobre todo en el pie). Al cambiarlo, regenerar `public/favicon.svg` y `public/favicon.ico` (hoy salen del logo actual) y agregar `apple-touch-icon.png`.
- [ ] Quedan " · " visibles en `comments/components/quote-embed.tsx`, `slash-quote-picker.tsx`, `comment-node.tsx` y `quote/components/quote-performance-card.tsx`.
- [ ] `moderation-dashboard.tsx` tiene el título de pestaña en inglés ("Moderation | Framerate Admin").
- [ ] **Rehacer los sellos de certificación** (80 Plus Bronze/Silver/Gold/Platinum/Titanium y los demás, p. ej. Cybenetics): hoy `PsuBadge` es un dibujo propio que no coincide con los sellos reales ni con el estilo nuevo. Diseñarlos bien, con su historia en Storybook.
- [ ] Llevar al estilo nuevo (y a Storybook): `/ajustes/tickets`, perfil público (`/u/:username`, `/perfil`), ficha de producto, tienda y reclamo.
- [ ] **Vista pública de producto**: 3 versiones (v1/v2/v3) con `/referencias-composicion`.
- [ ] "Mejores ofertas" y "tendencias" del home salen vacías: falta precio de referencia y ranking de popularidad (columnas derivadas de `products` sin recalcular tras los crawls).
- [ ] Filtros por especificación en categoría (hoy `getFilters` devuelve `{}`).

## Rendimiento de navegación
- [x] Root loader en paralelo y sin revalidar en cada navegación; barra de progreso de navegación; `/profile` ya no pide `/v1/quotes` (inexistente).
- [ ] Cada llamada a la API tarda ~0,37 s desde el cliente: medir por service binding en producción y cachear datos casi estáticos (categorías, proveedores de login).
- [ ] `prefetch="intent"` en los enlaces del navbar y de las tarjetas de producto.
- [ ] Reactivar la carga de cotizaciones en `/perfil` cuando exista la API de cotizaciones.

## API v2 pendiente (la web degrada vacío / 404)
- [ ] **Comentarios** (`0006_comments.sql`): API + adaptar `features/comments`.
- [ ] **Cotizaciones** (`0005_quotes.sql`): API + adaptar `features/quotes` y `/cotizacion/:slug`.
- [ ] **Reportes y cola de moderación** (`0007_moderation.sql`): crear reportes (producto, comentario, reseña, tienda) y resolverlos desde `/admin`.
- [ ] **Soporte** (`0008_support.sql`): tickets (`/settings/tickets` hoy devuelve vacío).
- [ ] Perfil público de usuario / avatar copiado a R2, borrado de cuenta.
- [ ] Contador de miembros en el detalle de tienda (hoy 0).

## Tiendas
- [ ] Subida de icono y banner a R2 (se quitó esa sección del panel de administración).
- [ ] Invitaciones por correo a la organización (`organization_invitations` ya está en el esquema; falta el envío).
- [ ] Verificación alternativa por archivo `/.well-known/framerate-verify` para tiendas sin acceso a su DNS.
- [ ] Reseñas: reportar reseña desde la UI contra la API v2; paginación "cargar más".

## Último deploy
- [x] Desplegado el 30-09-2026 (`17adce0`): migraciones 0009 y 0010, `framerate-ingest` y `framerate-server`. La web no cambió de comportamiento y sigue en `bb66fe3`.
- [x] Crawl posterior revisado: fuentes y RAM de Dust2 entraron, precio tarjeta en todas las ofertas (Dust2 +7 %, TecTec +4 % promedio).
- [x] Desplegado `framerate-ingest` con `11ffecb` (extractores de chipset/capacidad): +7 ofertas de Dust2 fuera de cuarentena. `ADMIN_TOKEN` rotado (copia local en `~/.config/framerate/admin-token`).

## Scraping / catálogo
- [ ] Revisar las 56 revisiones pendientes de matching (`match_reviews`) con datos reales y ajustar vetos.
- [ ] Integrar tiendas en el orden de `docs/store-candidates.md` (MyShop y Sandos primero, misma API).
- [ ] Opciones de precio de WooCommerce que faltan: "`regular_price` = tarjeta" (Infor-Ingen) y "`price` = tarjeta" (Central Gamer, Globalbox, Nuevatec, Tecno Shopping).
- [ ] Decidir la política de MPN dentro del título y de SKU con prefijo (en `normalize`, no por tienda).
- [ ] Probar Winpy desde el Worker (bloquea desde red local); si bloquea, evaluar Browser Rendering.
- [ ] Resumen de precios de `products` y `product_price_daily` tras cada corrida (habilita "mejores ofertas" y descuento real).
- [ ] Huella multicapa (`docs/architecture.md` §5): overrides persistentes, separar fusiones, recalcular huellas, hash de imagen.
- [ ] Refresco liviano de precio y stock (hoy hasta 6 h de atraso).
- [ ] Imágenes: hoy se enlazan (hotlink) desde la tienda; copiarlas a R2.
- [ ] "Usado certificado" y "open box" hoy van a cuarentena; decidir si se muestran como condición aparte.

## Web (cuando se retome)
- [ ] El chip "Con stock" de `filter-bar.tsx` sobra: la API ya sólo lista productos con stock.
- [ ] **Reescribir privacidad y términos para v2**: `privacy-page.tsx` describe Supabase (Auth, Postgres, RLS, buckets, tablas `account`) y login con Google/Apple/Facebook; `terms-page.tsx:77` también. v2 es D1 + Better Auth + Discord/Google. Google enlaza esta página en su pantalla de consentimiento.
- [ ] Código muerto en `shared/lib/client.tsx`: `ClientHintCheck` (nunca se monta, así que la cookie de hints de tema nunca se escribe), `subscribeToSchemeChange`, `getLocale`, `parseAcceptLanguage`.
- [ ] Quedan menciones al sistema anterior en `comments/services/comments.ts`, `product/services/adapters.ts` y `shared/utils/images.ts`.
- [ ] Tipos heredados (`shared/utils/db-types.ts`, tipos del cotizador en `quote/services/quotes.ts`): reemplazarlos por `@framerate/contracts` al construir cada API.

## Infra y deuda técnica
- [ ] Borrar el proyecto de Supabase del sistema anterior (`qkvqtkrsmrzegckrakwb`): dashboard → Project Settings → General → Delete project. El Worker viejo `framerate-api` ya se borró (30-09-2026).
- [ ] Tests de server intermitentes: el primer test de `claims` y el de `users-admin` a veces pasan los 5 s de timeout en la suite completa (solos pasan). Subir el timeout de esos `beforeAll` o del archivo.
- [ ] `apps/web` no tiene `check-types` en Turbo y `knip.config.ts` falla al tipar (`knip` no está instalado; lo usa `react-doctor`).
- [ ] Alertas: nadie avisa si una corrida falla o cae a la DLQ (`framerate-crawl-dlq`); hoy sólo logs y `GET /v1/admin/crawls`.
- [ ] Rotar/definir secretos: `BETTER_AUTH_SECRET`, `ADMIN_TOKEN`, credenciales de Discord (solo por `wrangler secret put`).
- [ ] Agregar más proveedores de login (el registro está en `features/identity/providers.ts`).
