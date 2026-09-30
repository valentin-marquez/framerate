---
name: deploy
description: Sube a git.nozz.skin y despliega los Workers de Framerate (ingest, server, web) con wrangler, aplicando antes las migraciones D1. Sólo cuando el dueño pide "pushear", "desplegar" o "subir a producción".
disable-model-invocation: true
---

# Push y deploy

No hay CI: todo sale de esta máquina con `wrangler`, para tener control y logs aquí. Desplegar sólo cuando el dueño
lo pide en esta conversación; nunca para "probar" variantes.

## Objetivo

Dejar en producción lo commiteado, sin romper a ninguno de los dos Workers que comparten la base D1.

1. `bun run test` en verde (check-types + tests de todo el monorepo). Si algo falla, no se despliega.
2. Ver qué cambió desde el último deploy: `git diff --stat <último desplegado>..HEAD`. Así se sabe qué Workers
   tocar y si hay migraciones nuevas en `packages/database/migrations/`.
3. Push (abajo).
4. Deploy en este orden, sólo lo que cambió:
   1. Migraciones: `bun run db:migrate:remote`. Van primero porque el código nuevo ya escribe en las columnas nuevas.
   2. `apps/ingest`: `bunx wrangler@latest deploy`. Va antes que server, porque server lo referencia por service
      binding.
   3. `apps/server`: `bunx wrangler deploy`.
   4. `apps/web`: `VITE_API_URL=https://api.framerate.cl bun run build` y luego `bunx wrangler deploy`.
5. Verificar: `bunx wrangler tail framerate-ingest` (o `framerate-server`) y, si cambió el scraping, pedir un crawl
   con `POST /v1/admin/crawls` y revisar `GET /v1/admin/crawls` y la cuarentena. Para una revisión más a fondo,
   usar la skill `prod-health`.

## Push

`git push https://git.nozz.skin/valentin/framerate.git <rama>:refs/heads/<rama>`. No es un remote configurado, y
`origin` (GitHub) no se usa. Nunca usar credenciales pegadas en el chat: si pide contraseña, que la ingrese el dueño.

## Trampas

- **Pre-push falla con "The WebSocket is undefined" o "new dependencies optimized".** No es del código: es el build
  de Vite chocando con un dev server o Storybook abierto que re-optimiza dependencias. Reintentar el push.
- **`wrangler` viejo (4.63) falla al crear colas.** En ingest usar `bunx wrangler@latest`.
- **La web sin `VITE_API_URL`** se construye apuntando a localhost y en producción no carga datos.
- **Una migración aplica a los dos Workers a la vez.** Nunca desplegar un Worker que depende de columnas que la
  migración todavía no creó, ni escribir migraciones destructivas mientras el código viejo sigue desplegado.
- **Los secretos no están en el repo.** Si falta uno (`BETTER_AUTH_SECRET`, `ADMIN_TOKEN`, `DISCORD_CLIENT_ID`,
  `DISCORD_CLIENT_SECRET`), el dueño lo pone con `bunx wrangler secret put <NOMBRE>` en la carpeta del Worker.
- `bun run test` a veces falla por timeout en el primer test de `claims` o de `users-admin` (pasan solos). Repetirlo
  una vez antes de investigar.
