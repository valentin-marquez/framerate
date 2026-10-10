# CLAUDE.md

Guía para Claude Code (y cualquier persona) que trabaje en este repo. Framerate.cl compara precios de componentes
de PC en tiendas chilenas. Este archivo va versionado: es la forma de mantener las mismas reglas entre máquinas.

## Arquitectura (v2)

Lee `docs/architecture.md` antes de tocar código del backend. Todo corre en Cloudflare (Workers, D1, Queues, R2).

- **`apps/server`**: Worker de la API HTTP (`api.framerate.cl`, Hono + D1), organizado por feature: `catalog`,
  `identity` (Better Auth + Discord; ver `docs/identity.md`), `stores`, `claims` (ver `docs/stores.md`),
  `users-admin`, `crawl-admin`, `match-review` y `mcp` (servidor MCP de sólo lectura en `mcp.framerate.cl`). No tiene
  Cron ni colas.
- **`apps/ingest`**: Worker de scraping (Cron + Queues + R2 + RPC): adaptadores de tienda, normalización y
  matching. No tiene HTTP público; `server` le pide crawls por RPC tipado.
- **`apps/match`**: Worker que verifica las revisiones del Gatekeeper con Workers AI (Cron + Queue, sin HTTP), y con
  Claude Haiku 5.5 como tercera opinión sobre lo que queda pendiente (`MATCH_HAIKU`, con tope ligado al ciclo del
  crédito de Anthropic; ver #149). Cada modelo nuevo entra en sombra antes de decidir (`MATCH_MODE`, #117).
- **`apps/normalize`**: Worker que normaliza cada oferta una sola vez con Claude Haiku (cola `framerate-normalize`):
  identidad anclada al texto, specs y nombre canónico en `listing_identity`, gasto en `ai_usage`. Su salida va a la
  cola `framerate-link`, que consume `apps/match`. Diseño y fases: `docs/specs/2026-10-08-preprocesador-ia.md` (#153).
- **`apps/web`**: React Router v7 (SSR) en Workers. Sólo habla con la API (`/v1/*`), nunca con la base.
- **`apps/relay`**: la única pieza fuera de Cloudflare: un `Bun.serve` en Docker en el servidor del dueño (Coolify,
  `relay.nozz.skin`) que descarga páginas de las tiendas que cortan las IPs de Cloudflare (`egress: "relay"` en el
  registro de tiendas) y las devuelve tal cual a ingest. Token, lista de dominios, sin lógica de productos (#154).
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
bun run db:migrate:local      # aplica packages/database/migrations en la D1 local, compartida por server e ingest (.wrangler/state en la raíz)
bun run dev:server            # API (wrangler dev)
bun run dev:ingest            # scraping (Cron/Queue/RPC)
bun run dev:match             # verificación del Gatekeeper (Cron/Queue/Workers AI, remoto)
bun run dev:normalize         # normalización con Haiku (Queue; necesita apps/normalize/.dev.vars con ANTHROPIC_API_KEY)
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
- **Nunca desplegar sin que quien trabaja lo pida explícitamente**, ni para "probar". Commit y push sí se hacen tras
  cada tanda. Los dos despliegan: **sólo desde `main` actualizado y con el árbol limpio**, si no se pisa lo que desplegó
  el otro. Push: `git push origin <rama>` (`origin` es Forgejo, `git.nozz.skin`; GitHub ya no se usa); nunca usar
  credenciales pegadas en el chat.
- Salud de producción (consultas D1 de sólo lectura): skill `/prod-health`.

## En un PC nuevo o con una persona nueva

Claude: si falta algo de esta lista, completarlo es lo primero de la sesión, antes de tomar un issue. Se comprueba
rápido: `ls node_modules apps/server/.dev.vars`, `tea logins ls` (tiene que haber un login a `git.nozz.skin`) y
`bunx wrangler whoami` (tiene que listar la cuenta `3f50a4a123ebcbcb917dababff3ef8b5`). Si falta, guiar a la persona
paso a paso; los secretos los escribe ella, nunca pegados en el chat.

1. `bun install` (instala también los hooks de git).
2. `tea login add --name <usuario> --url https://git.nozz.skin --token <token>`, con un token de Forgejo
   (Configuración → Aplicaciones; permisos de lectura y escritura en issue y repository, y lectura en user). Sin
   esto no se pueden reclamar issues.
3. `bunx wrangler login` con la cuenta de Cloudflare del proyecto. Un colaborador entra con la suya, después de
   aceptar la invitación de miembro (rol Administrator); los `wrangler.jsonc` fijan `account_id`, así que wrangler
   no despliega en su cuenta personal.
4. `cp apps/server/.dev.vars.example apps/server/.dev.vars` y cambiar `BETTER_AUTH_SECRET` por uno propio
   (`bun -e "console.log(crypto.randomUUID()+crypto.randomUUID())"`). Son valores **locales**: los secretos de
   producción no se piden ni se copian. Discord y Google son opcionales (el login sólo ofrece los proveedores con
   credenciales); para probar el login en local, una app propia de Discord con el redirect
   `http://localhost:8787/v1/auth/callback/discord`.
5. `bun run db:migrate:local` y `bun run test`.
6. Aceptar la confianza del espacio de trabajo en Claude Code: `.claude/settings.json` ofrece los plugins
   `ponytail` y `playwright`. Las skills del proyecto (`deploy`, `prod-health`, `referencias-composicion`) están en
   `.claude/skills/`; los hooks (formateo con Biome, migraciones protegidas) en `.claude/hooks/`. Correr
   `/doctor prompt-audit` para detectar referencias rotas entre CLAUDE.md y las skills.

## Cómo trabajar aquí

- **Las tareas salen del tablero de Forgejo**, no de `TODO.md`: issues de `valentin/framerate` con milestones y labels,
  en el orden del Roadmap fijado (#67). Desde la raíz del repo `tea` usa el login de quien lo corre. Listar:
  `tea issues --repo valentin/framerate`; leer uno: `tea api /repos/valentin/framerate/issues/<n>`.
- **Quién toma qué:** cualquiera puede tomar cualquier issue del Roadmap, incluidos `server`, `ingest` y `matching`; lo
  que manda es la asignación (abajo). Lo marcado `requiere-dueño` (cuentas personales: consola de Google, Supabase,
  Cloudflare) es de Valentín (`valentin`). Ignacio no toma diseño.
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
