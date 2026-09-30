# TODO

Estado al 2026-09-30. Producción: web `framerate.cl`, API `api.framerate.cl` (Workers `framerate`, `framerate-server`, `framerate-ingest`, D1 `framerate`).

## Para probar en producción
- [ ] **Prueba real de reclamo por DNS con `nozz.skin`** (dominio propio en la misma cuenta de Cloudflare): sembrar una tienda con `domain = 'nozz.skin'`, reclamarla desde la web, crear el TXT `_framerate-verify.nozz.skin`, verificar, confirmar, editar perfil, sumar un miembro, quitar el TXT y ver que el Cron la pase a `stale`/congelada.
- [ ] Flujo completo con sesión en el navegador (nunca se probó con Discord real): login, perfil, ajustes, publicar/votar/responder/eliminar una reseña.
- [ ] Registrar `https://api.framerate.cl/v1/auth/callback/discord` en el portal de Discord (si falta).

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
- [ ] Quitar " · " como separador en el resto de la UI (el dueño lo ve "estilo IA"): comentarios, cotizaciones embebidas, reseñas, tickets, reclamo, admin de tiendas y soporte, y títulos de pestaña ("Tienda · Framerate").
- [ ] Nombres de producto con " | " de la tienda ("RTX 3050 | MSI Ventus 2X | 6GB GDDR6"): limpiarlos en la normalización de `ingest` para mostrar un nombre legible.
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

## Scraping / catálogo
- [ ] Solo hay 8 productos (todos GPU de TecTec). Probar Dust2 y otras categorías; documentar qué tiendas se pueden hacer sin navegador.
- [ ] Tiendas que exigen navegador (PC Express, SP Digital, Central Gamer, Centrale, MyShop, NotebooksYa): decidir estrategia (Browser Rendering de Cloudflare vs. descartar).
- [ ] Imágenes: hoy se enlazan (hotlink) desde la tienda; copiarlas a R2.
- [ ] Revisar la cola de matching (`match_reviews`) con datos reales y ajustar vetos.

## Infra y deuda técnica
- [ ] **Cambiar la contraseña de git.nozz.skin** (se pegó en el chat) y usar un token.
- [ ] Retirar el legado (fase 5): `apps/api`, `collector`, `tracker`, `cortex`, `janitor`, `packages/core`, `matcher`, `mpn-finder`, `opendb`, `utils`, `db` (Supabase). `apps/web` ya no depende de Supabase.
- [ ] `apps/web` no tiene `check-types` en Turbo y `knip.config.ts` falla al tipar (falta `knip` instalado).
- [ ] Biome: 24 avisos heredados (`noNonNullAssertion`, `noExplicitAny`) en legado y `use-prevent-scroll.tsx`.
- [ ] Reglas de alerta/observabilidad del Cron y de la DLQ; retención de snapshots en R2 (14 días).
- [ ] Rotar/definir secretos: `BETTER_AUTH_SECRET`, `ADMIN_TOKEN`, credenciales de Discord (solo por `wrangler secret put`).
- [ ] Agregar más proveedores de login (el registro está en `features/identity/providers.ts`).
