# CLAUDE.md

Guía para Claude Code (y cualquier persona) que trabaje en este repo. Framerate.cl compara precios de componentes
de PC en tiendas chilenas. Este archivo va versionado: es la forma de mantener las mismas reglas entre máquinas.

## Arquitectura (v2)

Lee `docs/architecture.md` antes de tocar código del backend. Todo corre en Cloudflare (Workers, D1, Queues, R2).

- **`apps/server`**: Worker de la API HTTP (`api.framerate.cl`, Hono + D1), organizado por feature: `catalog`,
  `identity` (Better Auth + Discord; ver `docs/identity.md`), `stores`, `claims` (ver `docs/stores.md`),
  `users-admin`, `crawl-admin` y `match-review`. No tiene Cron ni colas.
- **`apps/ingest`**: Worker de scraping (Cron + Queues + R2 + RPC): adaptadores de tienda, normalización y
  matching. No tiene HTTP público; `server` le pide crawls por RPC tipado.
- **`apps/web`**: React Router v7 (SSR) en Workers. Sólo habla con la API (`/v1/*`), nunca con la base.
- **`packages/contracts`**: esquemas Zod de la API y contrato RPC `server`↔`ingest`, compartidos con `apps/web`.
- **`packages/database`**: dueño del esquema: migraciones SQL, tipos Kysely, cliente D1 y utilidades de test
  (`@framerate/database/testing`).
- **`packages/matching`**: huella de producto y decisión de matching (dominio puro) + repositorio.
- **`packages/kit`**: texto, reloj, logger y DNS, sin dependencias.
- Las apps **no se importan entre sí**; lo compartido va en `packages/`.

Reglas:

- Las migraciones commiteadas no se editan (un hook de `.claude/settings.json` lo bloquea): se crea una nueva.
- El esquema es SQL a mano en `packages/database/migrations/`. Kysely sólo tipa y arma consultas; los tipos viven
  en `packages/database/src/database.ts` y se actualizan a mano junto con la migración.
- Ninguna oferta entra a `listings` sin pasar `normalizeOffer`; lo inválido va a `quarantine` con su motivo.
- Los adaptadores de tienda nunca inventan identificadores. Si el SKU no es del fabricante, `sku: "internal"`.
  El precio tarjeta sólo se configura si está verificado en la ficha (`cardMarkup`).
- El matching prefiere duplicados antes que fusiones erróneas (vetos duros por atributo). La evolución prevista
  es la huella multicapa: `docs/architecture.md` §5.
- Las listas del catálogo sólo muestran productos con stock; la ficha y el sitemap no filtran.

## Comandos

```bash
bun install
bun run db:migrate:local      # aplica packages/database/migrations en D1 local
bun run dev:server            # API (wrangler dev)
bun run dev:ingest            # scraping (Cron/Queue/RPC)
bun run dev:web               # frontend
bun run test                  # check-types + tests de todo el monorepo (red de seguridad antes de desplegar)
bun test path/to/file.test.ts # un archivo (dentro de la app)
bun run biome                 # lint + formato con escritura
```

Logs: los Workers escriben JSON estructurado en Workers Logs (`feature`, `store`, `category`, `runId`). En vivo:
`bunx wrangler tail framerate-ingest` o `framerate-server`. Salud del scraping: `GET /v1/admin/crawls` y
`GET /v1/admin/quarantine`.

## Push y deploy

- **No hay CI.** Todo sale de la máquina del desarrollador con `wrangler`. El procedimiento completo, con sus trampas,
  está en la skill `/deploy`.
- **Nunca desplegar sin que el dueño lo pida explícitamente**, ni para "probar". Commit y push sí se hacen tras cada
  tanda. Push: `git push https://git.nozz.skin/valentin/framerate.git <rama>:refs/heads/<rama>` (`origin` es GitHub
  y no se usa); nunca usar credenciales pegadas en el chat.
- Salud de producción (consultas D1 de sólo lectura): skill `/prod-health`.

## En un PC nuevo

1. `bun install` (instala también los hooks de git).
2. `bunx wrangler login` con la cuenta de Cloudflare del proyecto.
3. Crear los `.dev.vars` de `apps/server` (`BETTER_AUTH_SECRET`, `ADMIN_TOKEN`, `DISCORD_CLIENT_ID`,
   `DISCORD_CLIENT_SECRET`) y de `apps/web` si hace falta. No están en el repo.
4. `bun run db:migrate:local` y `bun run test`.
5. Aceptar la confianza del espacio de trabajo en Claude Code: `.claude/settings.json` ofrece los plugins
   `ponytail` y `playwright`. Las skills del proyecto (`deploy`, `prod-health`, `referencias-composicion`) están en
   `.claude/skills/`; los hooks (formateo con Biome, migraciones protegidas) en `.claude/hooks/`. Correr
   `/doctor prompt-audit` para detectar referencias rotas entre CLAUDE.md y las skills.

## Cómo trabajar aquí

- **Las tareas salen del tablero de Forgejo**, no de `TODO.md`: issues de `valentin/framerate` con milestones y labels,
  en el orden del Roadmap fijado (#67). Desde la raíz del repo `tea` usa el login de quien lo corre. Listar:
  `tea issues --repo valentin/framerate`; leer uno: `tea api /repos/valentin/framerate/issues/<n>`.
- **Reclamar el issue antes de tocarlo**, cada vez: trabajan dos personas, cada una con su Claude.
  1. Ver si alguien lo tiene: `tea api /repos/valentin/framerate/issues/<n> | jq '[.assignees[]?.login]'`. Si
     está asignado a otra persona, no se toca: elegir otro del Roadmap y decirlo.
  2. Asignárselo y comentar qué se va a hacer:
     `tea api -X PATCH /repos/valentin/framerate/issues/<n> -F 'assignees=["<tu login>"]'` (`tea api /user` da el
     login) y `tea api /repos/valentin/framerate/issues/<n>/comments -f body="Trabajando en esto: <qué>, rama <rama>."`.
  3. Releer los asignados. `PATCH` reemplaza la lista: si ya no figura uno, el otro lo tomó al mismo tiempo; elegir
     otro.

  Si se deja a medias, desasignarse (`-F 'assignees=[]'`) y comentar dónde quedó. Antes de empezar, verificar contra
  el código que el issue siga vigente: sus `archivo:línea` son del día en que se escribió. El commit que lo resuelve lleva
  `Closes #<n>` (Forgejo lo cierra al llegar a `main`) y se marca su casilla en el Roadmap. Lo que aparezca trabajando
  va a un issue nuevo con el mismo estilo (qué pasa hoy con `archivo:línea`, qué se ve, qué debería pasar), con su
  milestone, y se suma al Roadmap. El [proyecto](https://git.nozz.skin/valentin/framerate/projects/1) muestra lo mismo
  en columnas por milestone; la API de Forgejo 8 no tiene proyectos, así que un issue nuevo se agrega desde la web (cae
  en Backlog) y se mueve a la columna de su milestone.
- **Skills por defecto:** casi siempre usar `/ponytail:ponytail` (la solución más simple que funcione) y sus subskills: `/ponytail:ponytail-review` (revisar sobreingeniería), `/ponytail:ponytail-audit` (auditar el repo entero), `/ponytail:ponytail-debt`, `/ponytail:ponytail-gain`, `/ponytail:ponytail-help`.
- **Maquetación y UI nueva:** usar `/referencias-composicion` antes de maquetar una página, sección o componente (busca referencias reales y propone 2–3 layouts).
- **Comentarios: los mínimos.** Sólo el porqué no obvio (una restricción, una trampa, una decisión). Nada que repita lo que dice el código ni bloques de documentación largos. No agregar comentarios de cabecera por costumbre.
- **Criticar lo heredado contra v2.** La web todavía arrastra supuestos del sistema anterior (Supabase, proxies de
  imágenes, tipos de la vista `api_products` en `shared/utils/db-types.ts`). Antes de extender algo heredado, decir qué
  sobra, qué resuelve Cloudflare de forma nativa y qué conviene rehacer.
- **Sin " · " como separador** en textos visibles ("MSI · Tendencia"): al dueño le parece "estilo IA". Separar con
  espacio o `gap`, chips, líneas propias o jerarquía tipográfica.

## Runtime y convenciones

- **Bun exclusivo**: `bun install`, `bun add`, `bun run`, `bunx`. Nunca `node`, `npm`, `yarn` ni `pnpm`.
- Monorepo Turborepo (`apps/*`, `packages/*`). TypeScript estricto, ESM, dependencias internas con `workspace:*`,
  alias `@/...` por app.
- Biome para lint y formato (`biome.json` extiende `@framerate/config/biome`). Hooks (`simple-git-hooks`):
  pre-commit `bun run biome:check`; pre-push `bun run biome:check && bun run build`.
- **Commits en Conventional Commits, en español**: `tipo(scope): descripción` (`feat`, `fix`, `refactor`, `chore`,
  `docs`, `style`, `test`, `perf`). **No agregar** la línea `Co-Authored-By: Claude ...`.
- Secretos sólo con `bunx wrangler secret put <NOMBRE>`; nunca en el repo.

## Dónde mirar

- `apps/web/CLAUDE.md`: animaciones, rendimiento, diseño y rutas de la web.
- `docs/architecture.md` (arquitectura, operación, plan), `docs/data-model.md`, `docs/identity.md`,
  `docs/stores.md` (reclamo de tiendas), `docs/store-candidates.md` (qué tiendas integrar y cómo).
- [Issues de Forgejo](https://git.nozz.skin/valentin/framerate/issues) y su Roadmap (#67): pendientes concretos.
  `TODO.md`: registro de deploys. `FUTURE.md`: visión de producto.
