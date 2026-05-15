# Framerate.cl

![Bun](https://img.shields.io/badge/Bun-Runtime-000000?style=flat&logo=bun)
![Turborepo](https://img.shields.io/badge/Turborepo-Monorepo-EF2D5E?style=flat&logo=turborepo)
![TypeScript](https://img.shields.io/badge/TypeScript-Language-007ACC?style=flat&logo=typescript&logoColor=white)
![React Router v7](https://img.shields.io/badge/React%20Router-v7-CA4245?style=flat&logo=reactrouter&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-API-E36002?style=flat&logo=hono&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat&logo=cloudflare&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?style=flat&logo=supabase&logoColor=white)
![License](https://img.shields.io/badge/License-PolyForm%20Noncommercial%201.0.0-blueviolet)

**Framerate.cl** es un comparador de precios de componentes PC para
Chile. Reúne en un solo lugar los listados de las principales tiendas
del país, normaliza specs, sigue el histórico de precios y deja a la
comunidad armar, validar y discutir builds.

> Este repositorio es **source-available**, no open-source clásico:
> cualquiera puede leerlo, estudiarlo y desplegarlo para uso no
> comercial. La marca, el dominio y la operación comercial están
> reservados. Ver [`LICENSE`](./LICENSE).

---

## ¿Qué hace por el usuario?

| Área | Para qué sirve |
|---|---|
| **Catálogo** (`/explorar`, `/categoria/:slug`, `/producto/:slug`) | Comparar precios de la misma pieza entre tiendas, ver historial, specs normalizadas y stock. |
| **Cotizaciones** (`/cotizacion/:slug`) | Armar una build, ver compatibilidad básica, totalizar y compartir un link público o privado. |
| **Comentarios** (en cada producto) | Discutir, recomendar, embedder cotizaciones inline tipo Notion. |
| **Tiendas** (`/tiendas/:slug`, `/tiendas/:slug/resenas`) | Ver perfil, reseñas y datos de cada tienda; los dueños pueden reclamar y administrar la suya. |
| **Reclamos** (`/reclamar`) | Que el dueño verificado de una tienda tome control de su perfil oficial. |
| **Perfiles** (`/u/:username`, `/profile`) | Avatar OAuth, cotizaciones públicas del usuario, historial de aportes. |
| **Moderación** (`/admin/*`) | Reportes, bans, gatekeeper de contenido — interno, RLS-gated. |

URLs públicas siempre en español (`/tiendas`, `/reclamar`, `/categoria`, `/producto`, `/cotizacion`). APIs internas y nombres de paquetes en inglés.

---

## Cómo está construido

Monorepo Bun + Turborepo. Workspaces en `apps/*` y `packages/*`.

### Apps

| App | Stack | Rol |
|---|---|---|
| `apps/web` | React Router v7 (framework mode, SSR), Tailwind v4, Cloudflare Workers | Frontend público. Nunca habla con Supabase directo, todo pasa por `apps/api`. |
| `apps/api` | Hono sobre Cloudflare Workers, Supabase anon key + RLS | API gateway de sólo lectura. Cache (Cloudflare Cache API) y rate limit per-handler. |
| `apps/collector` | Bun + Hono, Puppeteer (con stealth) o HTMLRewriter, Docker | Único escritor a Supabase (service role). Crawlea, normaliza, extrae specs (regex + LLM), sube imágenes. |
| `apps/tracker` | Bun + Elysia | Re-chequeo liviano y de alta frecuencia de precio/stock para listings ya conocidos. Sin browser — sólo `fetch` + `cheerio`. |
| `apps/cortex` | Bun, OpenAI SDK contra DeepSeek | Worker de fondo: pollea `ai_extraction_jobs` en Postgres (Postgres como queue), corre matchers/syncers/janitor. |
| `apps/janitor` | Bun + git-sync | Sincroniza specs canónicas de un repo OpenDB externo a `products_canonical`. |

### Packages

| Package | Para qué |
|---|---|
| `@framerate/db` | Migraciones Supabase, types autogenerados (`Database`, `Tables`), specs por categoría, helpers de Storage. |
| `@framerate/core` | Lógica de negocio (motor de PC builder, validaciones de compatibilidad). |
| `@framerate/matcher` | Matching de productos cross-store con Orama + Jaro-Winkler. |
| `@framerate/opendb` | Schemas para integrar el repo OpenDB de specs de hardware. |
| `@framerate/utils` | Logger compartido y helpers. |
| `@framerate/config` | `biome.json` y `tsconfig.base.json` compartidos. |

### Flujo de datos

```
┌──────────────┐   crawl + LLM      ┌────────────┐
│  collector   │ ─────────────────► │  Supabase  │
│  (Docker)    │   service role     │ (Postgres) │
└──────────────┘                    └─────┬──────┘
                                          │ anon key + RLS
┌──────────────┐                          │
│   tracker    │ ─── precio/stock ────────┤
└──────────────┘                          │
┌──────────────┐                          │
│   cortex     │ ─── jobs LLM ────────────┤
└──────────────┘                          │
┌──────────────┐                          ▼
│   janitor    │ ─── OpenDB sync ───►  ┌─────┐
└──────────────┘                       │ api │ ──► web (SSR)
                                       └─────┘
```

Lectura: `web → api → Supabase (RLS, anon key)`.
Escritura: sólo los workers del lado izquierdo, con service role.

---

## Tiendas integradas

7 crawlers en `apps/collector/src/crawlers/`:
**PC Express**, **SP Digital**, **Central Gamer**, **Centrale**,
**MyShop**, **NotebooksYa**, **TecTec**. La mayoría usa Puppeteer con
stealth; PC Express usa HTMLRewriter de Bun por velocidad.

Categorías cubiertas: GPU, CPU, PSU, motherboard, gabinete, RAM, HDD,
SSD, case fan, CPU cooler.

---

## Desarrollo local

```bash
bun install

# Por app
bun run dev:web         # apps/web
bun run dev:api         # apps/api (wrangler dev)
bun run dev:collector   # apps/collector
bun run dev:tracker     # apps/tracker

# Todo a la vez
bun run dev

# Build / type-check
bun run build
bun run check-types

# Lint + format (Biome, single tool)
bun run biome           # con --write
bun run biome:check     # CI mode

# Tests
bun run test
```

`apps/cortex` y `apps/janitor` se levantan con `bun run --cwd apps/<name> dev`.

### Base de datos

`packages/db` es la fuente de verdad del schema.

```bash
bun run --cwd packages/db migration:new <descripcion>
bun run db:push          # supabase db push (aplica al remote)
bun run generate:types   # regenera packages/db/src/types.ts
```

> No hay instancia local de Supabase: las migraciones se aplican
> directo a producción. Revísalas con cuidado y mantenlas no
> destructivas.

### Hooks de git

`simple-git-hooks`:
- **pre-commit**: `bun run biome` + `bun run generate:types`.
- **pre-push**: `bun run biome:check` + `bun run build`.

---

## Convenciones

- Bun exclusivamente. No `node`, `npm`, `yarn`, `pnpm`.
- TypeScript estricto, ESM. Workspace deps usan `workspace:*`.
- Path aliases `@/...` por app.
- Commits en español, Conventional Commits: `tipo(scope): descripción`.
- URL públicas en español, código y APIs internas en inglés.
- UI sigue sistema macOS-inspired documentado en `.github/instructions/web.instructions.md` (capas `bg-background`/`bg-card`/`bg-secondary`, secondary buttons que promueven a primary en hover, `backdrop-blur-md` en flotantes, squircle radii).

---

## Documentación adicional

- [`CLAUDE.md`](./CLAUDE.md) — guía operativa para asistentes / contribuidores nuevos.
- [`.github/instructions/<area>.instructions.md`](./.github/instructions/) — reglas por área (api, collector, db, tracker, web).
- [`.agents/skills/`](./.agents/skills/) — guidelines por tooling (Wrangler, RR framework mode, TanStack Query, Tailwind, Supabase, Biome, TypeScript).
- [`FUTURE.md`](./FUTURE.md) — roadmap.
- [`LICENSE`](./LICENSE) — términos legales (PolyForm Noncommercial 1.0.0 + trademark/brand notice).

---

## Contribuir

Pull requests son bienvenidas mientras estén alineadas con la
licencia (uso no comercial). Revisa `CLAUDE.md` y los archivos en
`.github/instructions/` antes de abrir cambios grandes.

Por favor mantén:
- Mensajes de commit en español, formato Conventional Commits.
- Sin línea `Co-Authored-By: Claude ...` en commits.
- Migraciones no destructivas y revisadas (van directo a producción).
- Cambios en URLs públicas con redirect 301 desde la versión vieja.

---

## Licencia y marca

Código bajo **PolyForm Noncommercial 1.0.0**. Uso comercial,
distribución como servicio pagado o reventa de la BD curada requieren
licencia comercial separada — escribe a **valentin13.mail@gmail.com**.

La marca **Framerate**, el dominio **framerate.cl**, el logo, la
paleta y el diseño visual **no** son parte de la licencia y siguen
siendo propiedad del autor. Si despliegas un fork, debes rebrandearlo.

Ver [`LICENSE`](./LICENSE) para los términos completos.
