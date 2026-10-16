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
   4. `apps/normalize` (#153): `bunx wrangler@latest deploy`. La primera vez, crear antes las colas del pipeline
      (`queues create framerate-normalize`, `framerate-normalize-dlq`, `framerate-link`, `framerate-link-dlq`) y que el
      dueño ponga `secret put ANTHROPIC_API_KEY` en `apps/normalize`. Las colas tienen que existir antes de desplegar
      ingest y match, que las producen y consumen.
   5. `apps/server`: `bunx wrangler deploy`.
   6. `apps/web`: `VITE_API_URL=https://api.framerate.cl VITE_TURNSTILE_SITE_KEY=0x4AAAAAAFLjXEJIhds4HQZi bun run build`
      y luego `bunx wrangler deploy`. La site key de Turnstile es pública (va en el JS del sitio); su secreto vive en
      `framerate-server` (`TURNSTILE_SECRET_KEY`). Sin ella, el soporte sin cuenta no muestra el formulario.
   7. `apps/relay` **no se despliega desde aquí**: Coolify (`coolify.nozz.skin`) lo construye con su `Dockerfile` en cada
      push a `main` (webhook de Forgejo). Si cambió `apps/relay`, mirar en Coolify que el deploy terminó y
      `curl https://relay.nozz.skin/health`. Su token es `RELAY_TOKEN` en Coolify y el mismo valor como secreto en
      ingest.
   8. `apps/resizer` (#170) tampoco: es la app `framerate-resizer` de Coolify, **sin webhook**. Si cambió, apretar Deploy
      en Coolify y probar `curl https://resizer.nozz.skin/health`. Su token es `RESIZER_TOKEN` en Coolify y como secreto
      en ingest (`~/.config/framerate/resizer-token`).
5. Verificar: `bunx wrangler tail framerate-ingest` (o `framerate-server`) y, si cambió el scraping, pedir un crawl
   con `POST /v1/admin/crawls` y revisar `GET /v1/admin/crawls` y la cuarentena. Para una revisión más a fondo,
   usar la skill `prod-health`.

## Push

`git push origin <rama>`. `origin` es Forgejo (`git.nozz.skin`); GitHub ya no se usa. Nunca usar credenciales pegadas en el chat: si pide contraseña, que la ingrese el dueño.

## Trampas

- **El pipeline no tiene interruptores en ingest (#156).** Toda oferta nueva o cambiada se encola a `framerate-normalize`
  y nace oculta hasta que Haiku la vincula. Los modos que quedan: `NORMALIZE_MODE` en normalize y `PIPELINE_LINK` en
  match (`off` | `shadow` | `live`), ambos en `live`. Apagar normalize deja ofertas ocultas acumulándose: el Cron de
  ingest las reencola a las 24 h, así que al volver a encender hay que mirar el gasto en `ai_usage`.

- **Pre-push falla con "The WebSocket is undefined" o "new dependencies optimized".** No es del código: es el build
  de Vite chocando con un dev server o Storybook abierto que re-optimiza dependencias. Reintentar el push.
- **`wrangler` viejo (4.63) falla al crear colas.** En ingest usar `bunx wrangler@latest`.
- **La web sin `VITE_API_URL`** se construye apuntando a localhost y en producción no carga datos; sin
  `VITE_TURNSTILE_SITE_KEY`, el formulario de soporte sin cuenta desaparece.
- **Una migración aplica a los dos Workers a la vez.** Nunca desplegar un Worker que depende de columnas que la
  migración todavía no creó, ni escribir migraciones destructivas mientras el código viejo sigue desplegado.
- **Un cambio en `packages/matching` va a normalize, match y server en la misma tanda** (ingest sólo usa las
  compuertas de cuarentena). La huella guardada en `products` no se recalcula al cargar: si cambian los vetos o el
  vocabulario, correr `packages/database/scripts/recanonize-products.ts`.
- **Un cambio de matching mueve ofertas en prod a medida que Haiku las vuelve a ver** (`relink`, backfill o cambio de
  título). Antes de desplegar, anotar la hora. Para volver atrás, en este orden: primero `bunx wrangler rollback` en
  `apps/match` y en `apps/normalize`, y después
  `bunx wrangler d1 time-travel restore framerate --timestamp=<hora>` desde `packages/database`. El restore descarta
  toda escritura posterior a esa hora (usuarios, sesiones, cotizaciones, reclamos, revisiones resueltas en el admin):
  hay que hacerlo pronto.
- **Tras el primer ciclo posterior a un deploy de matching**, mirar `GET /v1/admin/crawls`, `/prod-health` y
  `bunx wrangler tail framerate-match`. Revertir si alguna corrida falló por límite de subrequests o si las fusiones
  de `ai:` del día no cuadran en una muestra.
- **Los secretos no están en el repo.** Si falta uno (`BETTER_AUTH_SECRET`, `ADMIN_TOKEN`, `DISCORD_CLIENT_ID`,
  `DISCORD_CLIENT_SECRET`), el dueño lo pone con `bunx wrangler secret put <NOMBRE>` en la carpeta del Worker.
- `bun run test` a veces falla por timeout en el primer test de `claims` o de `users-admin` (pasan solos). Repetirlo
  una vez antes de investigar.
