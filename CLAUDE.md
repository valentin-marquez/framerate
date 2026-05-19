# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Runtime & Tooling

- **Runtime:** Bun (exclusive). Do not use `node`, `npm`, `yarn`, or `pnpm`. Use `bun install`, `bun add`, `bun run`, `bunx`.
- **Monorepo:** Turborepo. Tasks declared in `turbo.json`; workspaces in `apps/*` and `packages/*`.
- **Lint/Format:** Biome (`@biomejs/biome`) — single tool for both. Config at root `biome.json` extends `@framerate/config/biome`.
- **Git hooks** (`simple-git-hooks`): pre-commit runs `bun run biome && bun run generate:types`; pre-push runs `bun run biome:check && bun run build`.

## Common Commands

Run from repo root unless noted.

```bash
# Dev (per app)
bun run dev:web         # apps/web (React Router v7)
bun run dev:api         # apps/api (Hono on Workers via wrangler dev)
bun run dev:collector   # apps/collector (Bun + Hono, scraper service)
bun run dev:tracker     # apps/tracker (Bun + Elysia, price tracker)
bun run dev             # all apps via turbo

# Build / type-check
bun run build
bun run check-types

# Lint / format
bun run biome           # write fixes (lint + format, --unsafe)
bun run biome:check     # CI-mode check
bun run lint            # turbo: biome:lint per package

# Tests
bun run test            # turbo run test
bun test path/to/file.test.ts             # single file (run inside the app dir)
bun test --filter "regex pattern"          # filter

# Database (packages/db) — Supabase, NO local instance, applied directly to production
bun run --cwd packages/db migration:new <description>
bun run db:push          # supabase db push (applies migrations to remote)
bun run generate:types   # regenerates packages/db/src/types.ts from remote schema
```

The `cortex` and `janitor` apps are background services started with `bun run --cwd apps/<name> dev`.

### Logs (consultar la terminal)

The shared `Logger` (`@framerate/utils`, `packages/utils/src/logger.ts`) mirrors every `info/warn/error/http` print to a file **in addition to the console**, so you can review what a running process/worker printed without having its terminal. In Bun apps it writes to `LOG_FILE` (if set) or `logs/dev.log` relative to the process cwd — with turbo that's the app dir, e.g. **`apps/collector/logs/dev.log`** (crawler/pipeline output), `apps/tracker/logs/dev.log`, etc. To inspect: `tail -f apps/collector/logs/dev.log` or `grep -E "\[ERROR\]|product_renamed" apps/collector/logs/dev.log`. Append mode, truncated past ~10 MB; disabled in tests (`NODE_ENV=test`) and with `LOG_TO_FILE=0`. Cloudflare Workers (api, web SSR) have no filesystem → console only. `logs/` is gitignored.

## Architecture

Framerate.cl is a PC-component price comparison platform for Chile. The system enforces strict separation between scraping, storage, API, and presentation. See `README.md` for the full design doc.

### Apps

- **`apps/web`** — React Router v7 (framework mode, SSR), Tailwind v4, deployed to Cloudflare via `@cloudflare/vite-plugin`. **Never** accesses Supabase directly; always goes through `apps/api`. Filter state lives in URL search params.
- **`apps/api`** — Hono on Cloudflare Workers. API gateway: read-only Supabase access via anon key + RLS. Routes under `/v1/*`. Per-route rate limit tiers applied in `src/index.ts` (`search`, `strict`, `moderate`, `lenient`). Uses Cloudflare Cache API (not KV) for response caching: listings 5m, details 1h, image proxy 1y. Cache disables automatically in local Bun dev since Cache API is unavailable.
- **`apps/collector`** — Bun + Hono service. **Only** writer to Supabase (service role key). Scrapes stores, normalizes data, extracts specs (regex + LLM), uploads images to Supabase Storage. Crawlers in `src/crawlers/` extend `BaseCrawler`; current implementations: PC Express (HTMLRewriter), SP Digital, Central Gamer, Centrale, MyShop, NotebooksYa, TecTec (most use Puppeteer with stealth). Pipelines/strategies/processors live under `src/collector/` and `src/processors/`. Runs in Docker (see `base.Dockerfile` — bundles Chromium for Puppeteer).
- **`apps/tracker`** — Bun + Elysia HTTP service. **High-frequency**, lightweight price/stock checks for *existing* listings only. **No browsers** — `fetch` + `cheerio`/`HTMLRewriter` only. Triggered via `POST /track/batch`. Anything that needs JS rendering belongs in `collector`, not here.
- **`apps/cortex`** — Bun background workers. Polls `ai_extraction_jobs` in Postgres (Postgres is used as the queue — there is no Redis), runs LLM matchers/syncers (DeepSeek via OpenAI SDK), uses `@framerate/matcher` for product matching. Entry: `src/index.ts` starts poller + matcher + syncer + janitor in parallel.
- **`apps/janitor`** — Bun service. Watches an `OpenDB` git repo (synced into a volume by `git-sync` in `docker-compose.yml`), diffs commits, and upserts canonical product specs into `products_canonical` keyed by filename UUID. Tracks `git_commit_hash` per row.

### Packages

- **`@framerate/db`** — Supabase schema authority. Owns `supabase/migrations/`, generated `src/types.ts` (`Database`, `Tables`, `TablesInsert`), per-category spec interfaces (`GpuSpecs`, `CpuSpecs`, …), Storage helpers. **Never edit `types.ts` manually** — regenerate. Migrations are applied directly to production; review carefully and keep them non-destructive.
- **`@framerate/core`** — Shared business logic (e.g., PC builder under `src/builder`).
- **`@framerate/matcher`** — Product matching (Orama + Jaro-Winkler).
- **`@framerate/opendb`** — Schemas/types for the external OpenDB hardware spec repo.
- **`@framerate/utils`** — Shared logger and helpers.
- **`@framerate/config`** — Shared `biome.json` and `tsconfig.base.json`.

### Credential & Trust Boundary

| Layer | Key | Permissions |
|-------|-----|-------------|
| `collector`, `cortex`, `janitor`, `tracker` | `SUPABASE_SERVICE_ROLE_KEY` | Read/write |
| `api` | `SUPABASE_PUBLISHABLE_KEY` (anon) | Read-only via RLS |
| `web` | none | Goes through `api` only |

All tables have RLS enabled with public read; writes restricted to service role.

### Product Matching

Matching across stores currently uses **MPN (Manufacturer Part Number)** as the unique key (`findExistingProduct` in collector). The `EAN` field was removed. Spec extraction has a regex-first pipeline with an LLM fallback (DeepSeek); LLM extractions are cached in `extraction_jobs` keyed by MPN.

## Conventions

- TypeScript strict, ESM throughout.
- Workspace deps use `workspace:*`. Path aliases use `@/...` (per-app `tsconfig.json`).
- **URLs públicas en español.** El sitio sirve audiencia chilena. Las rutas visibles del frontend (`apps/web` route segments y los `<Link>` que las consumen) deben estar en español: `/tiendas/:slug`, `/reclamar`, `/explorar`, `/categoria/:slug`, `/producto/:slug`, `/cotizacion/:slug`. Cuando renombres una ruta existente, mantén la versión en inglés como redirect 301 (ver `apps/web/app/features/stores/pages/redirect-old-*.tsx`) hasta que expiren los caches públicos y enlaces externos. Las APIs internas (`/v1/*` de `apps/api`), nombres de workspaces (`apps/api`, `apps/web`, `packages/*`), tablas SQL, y código en general se mantienen en inglés.
- Los mensajes de commit siguen **Conventional Commits en español**. Formato: `tipo(scope): descripción en español`. Tipos válidos: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`, `perf`. Ejemplos: `feat(web): agregar filtro por marca`, `fix(api): corregir límite de rate limiting`, `chore: actualizar dependencias`. El scope es opcional pero recomendado cuando el cambio es acotado a un app o package.
- **No agregar** la línea `Co-Authored-By: Claude ...` en ningún commit.
- `apps/web` UI follows the macOS-inspired design system documented in `.github/instructions/web.instructions.md` (layered surfaces `bg-background` / `bg-card` / `bg-secondary`, secondary buttons that promote to primary on hover, `backdrop-blur-md` for floating elements, squircle radii — `rounded-md` for inputs, `rounded-xl`/`rounded-2xl` for cards, `rounded-3xl` for modals).

## Pointers

- `.github/instructions/<area>.instructions.md` — per-area rules (api, collector, db, tracker, web).
- `.agents/skills/` — additional guideline docs (Wrangler, React Router framework mode, TanStack Query, Tailwind, Supabase, Biome, TypeScript).
- `README.md` — full architecture doc (Spanish), current state vs pending items.
- `FUTURE.md` — roadmap notes.
