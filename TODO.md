# TODO

Estado al 2026-09-30. Producción: web `framerate.cl`, API `api.framerate.cl` (Workers `framerate`, `framerate-server`, `framerate-ingest`, D1 `framerate`).

## Para probar en producción
- [ ] **Prueba real de reclamo por DNS con `nozz.skin`** (dominio propio en la misma cuenta de Cloudflare): sembrar una tienda con `domain = 'nozz.skin'`, reclamarla desde la web, crear el TXT `_framerate-verify.nozz.skin`, verificar, confirmar, editar perfil, sumar un miembro, quitar el TXT y ver que el Cron la pase a `stale`/congelada.
- [ ] Flujo completo con sesión en el navegador (nunca se probó con Discord real): login, perfil, ajustes, publicar/votar/responder/eliminar una reseña.
- [ ] Registrar `https://api.framerate.cl/v1/auth/callback/discord` en el portal de Discord (si falta).

## Web: vistas y diseño
- [ ] **Home**: 3 versiones (v1/v2/v3) con `/referencias-composicion`, elegir una y dejarla como definitiva.
- [ ] **Vista pública de producto**: 3 versiones (v1/v2/v3) con `/referencias-composicion`.
- [ ] "Mejores ofertas" y "tendencias" del home salen vacías: falta precio de referencia y ranking de popularidad (columnas derivadas de `products` sin recalcular tras los crawls).
- [ ] Filtros por especificación en categoría (hoy `getFilters` devuelve `{}`).

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
