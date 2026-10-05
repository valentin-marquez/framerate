---
name: deploy
description: Sube a git.nozz.skin y despliega los Workers de Framerate (ingest, match, server, web) con wrangler, aplicando antes las migraciones D1. Sólo cuando el dueño pide "pushear", "desplegar" o "subir a producción".
disable-model-invocation: true
---

# Push y deploy

No hay CI: todo sale de esta máquina con `wrangler`, para tener control y logs aquí. Desplegar sólo cuando quien
trabaja lo pide en esta conversación; nunca para "probar" variantes.

## Objetivo

Dejar en producción lo commiteado, sin romper a ninguno de los dos Workers que comparten la base D1.

0. Estar en `main`, con el árbol limpio y al día con git.nozz.skin (`git status`, `git pull`). Despliegan dos personas:
   desplegar una rama o un `main` atrasado pisa en producción lo que subió el otro.
1. `bun run test` en verde (check-types + tests de todo el monorepo). Si algo falla, no se despliega.
2. Ver qué cambió desde el último deploy: `git diff --stat <último desplegado>..HEAD`. Así se sabe qué Workers
   tocar y si hay migraciones nuevas en `packages/database/migrations/`.
3. Push (abajo).
4. Deploy en este orden, sólo lo que cambió:
   1. Migraciones: `bun run db:migrate:remote`. Van primero porque el código nuevo ya escribe en las columnas nuevas.
   2. `apps/ingest`: `bunx wrangler@latest deploy`. Va antes que server, porque server lo referencia por service
      binding.
   3. `apps/match`: `bunx wrangler@latest deploy`. La primera vez, crear antes sus colas:
      `bunx wrangler@latest queues create framerate-match-verify` y `... framerate-match-verify-dlq`. Para pasar de
      sombra a decidir solo, cambiar `MATCH_MODE` a `live` en su `wrangler.jsonc` y volver a desplegar.
   4. `apps/server`: `bunx wrangler deploy`.
   5. `apps/web`: `VITE_API_URL=https://api.framerate.cl VITE_TURNSTILE_SITE_KEY=0x4AAAAAAFLjXEJIhds4HQZi bun run build`
      y luego `bunx wrangler deploy`. La site key de Turnstile es pública (va en el JS del sitio); su secreto vive en
      `framerate-server` (`TURNSTILE_SECRET_KEY`). Sin ella, el soporte sin cuenta no muestra el formulario.
5. Verificar: `bunx wrangler tail framerate-ingest` (o `framerate-server`) y, si cambió el scraping, pedir un crawl
   con `POST /v1/admin/crawls` y revisar `GET /v1/admin/crawls` y la cuarentena. Para una revisión más a fondo,
   usar la skill `prod-health`.

## Push

`git push origin <rama>`. `origin` es Forgejo (`git.nozz.skin`); GitHub ya no se usa. Nunca usar credenciales pegadas en el chat: si pide contraseña, que la ingrese el dueño.

## Trampas

- **Pre-push falla con "The WebSocket is undefined" o "new dependencies optimized".** No es del código: es el build
  de Vite chocando con un dev server o Storybook abierto que re-optimiza dependencias. Reintentar el push.
- **`wrangler` viejo (4.63) falla al crear colas.** En ingest usar `bunx wrangler@latest`.
- **La web sin `VITE_API_URL`** se construye apuntando a localhost y en producción no carga datos; sin
  `VITE_TURNSTILE_SITE_KEY`, el formulario de soporte sin cuenta desaparece.
- **Una migración aplica a los dos Workers a la vez.** Nunca desplegar un Worker que depende de columnas que la
  migración todavía no creó, ni escribir migraciones destructivas mientras el código viejo sigue desplegado.
- **Un cambio en `packages/matching` va a ingest, match y server en la misma tanda.** Ingest y server corrigen las filas de
  `products` con su copia de los extractores al cargarlas; si quedan con versiones distintas, se pisan entre sí.
- **La primera corrida tras un cambio de matching mueve ofertas en prod** (re-decide todos los vínculos). Antes de
  desplegar, anotar la hora. Para volver atrás, en este orden: primero `bunx wrangler rollback` en `apps/ingest` y en
  `apps/server` (si no, el siguiente cron vuelve a aplicar el matching), y después
  `bunx wrangler d1 time-travel restore framerate --timestamp=<hora>` desde `packages/database`. El restore descarta
  toda escritura posterior a esa hora (usuarios, sesiones, cotizaciones, reclamos, revisiones resueltas en el admin):
  hay que hacerlo pronto.
- **Tras el primer ciclo posterior a un deploy de matching**, mirar `GET /v1/admin/crawls` y `/prod-health`. Revertir si
  alguna corrida falló por límite de subrequests, o si las desvinculaciones del primer ciclo superan ~600 en total (la
  simulación con datos de prod dio 283; se espera algo más porque las fuentes de Infor-Ingen ahora llegan por el crawl
  de `psu` y las fichas Woo aportan códigos P/N).
- **Los secretos no están en el repo.** Si falta uno (`BETTER_AUTH_SECRET`, `ADMIN_TOKEN`, `DISCORD_CLIENT_ID`,
  `DISCORD_CLIENT_SECRET`), el dueño lo pone con `bunx wrangler secret put <NOMBRE>` en la carpeta del Worker.
- `bun run test` a veces falla por timeout en el primer test de `claims` o de `users-admin` (pasan solos). Repetirlo
  una vez antes de investigar.
