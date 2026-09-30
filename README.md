# Framerate.cl

![Bun](https://img.shields.io/badge/Bun-Runtime-000000?style=flat&logo=bun)
![Turborepo](https://img.shields.io/badge/Turborepo-Monorepo-EF2D5E?style=flat&logo=turborepo)
![TypeScript](https://img.shields.io/badge/TypeScript-Language-007ACC?style=flat&logo=typescript&logoColor=white)
![React Router v7](https://img.shields.io/badge/React%20Router-v7-CA4245?style=flat&logo=reactrouter&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-API-E36002?style=flat&logo=hono&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat&logo=cloudflare&logoColor=white)
![Cloudflare D1](https://img.shields.io/badge/Cloudflare-D1-F38020?style=flat&logo=cloudflare&logoColor=white)
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
| **Moderación** (`/admin/*`) | Usuarios, sanciones, revisión de matches, corridas y cuarentena del scraping. |

URLs públicas siempre en español (`/tiendas`, `/reclamar`, `/categoria`, `/producto`, `/cotizacion`). APIs internas y nombres de paquetes en inglés.

---

## Cómo está construido

Monorepo Bun + Turborepo sobre Cloudflare (Workers, D1, Queues, R2). Detalle en
[`docs/architecture.md`](./docs/architecture.md).

| Workspace | Rol |
|---|---|
| `apps/web` | Frontend público: React Router v7 (SSR) en Workers, Tailwind v4. Todo pasa por la API. |
| `apps/server` | API HTTP (`api.framerate.cl`, Hono + D1): catálogo, identidad (Better Auth + Discord), tiendas, reclamos, reseñas y admin. |
| `apps/ingest` | Scraping (Cron + Queues + R2, sin HTTP público): adaptadores de tienda, normalización y matching. |
| `packages/contracts` | Esquemas Zod de la API y contrato RPC `server` ↔ `ingest`. |
| `packages/database` | Migraciones SQL de D1, tipos Kysely y utilidades de test. |
| `packages/matching` | Huella de producto y decisión de matching. |
| `packages/kit` | Texto, reloj, logger y DNS, sin dependencias. |
| `packages/config` | `biome.json` y `tsconfig.base.json` compartidos. |

```
tiendas ──fetch──► ingest ──► D1 ◄── server ◄── web
            (Cron 6 h → cola → adaptador → normalizar → matching)
```

---

## Tiendas integradas

TecTec y Dust2 (WooCommerce, Store API). Las candidatas y su orden de integración están en
[`docs/store-candidates.md`](./docs/store-candidates.md).

---

## Desarrollo local

```bash
bun install
bun run db:migrate:local   # migraciones D1 locales
bun run dev:server         # API
bun run dev:ingest         # scraping
bun run dev:web            # frontend
bun run test               # check-types + tests de todo el monorepo
```

Deploy con `wrangler` desde la máquina del desarrollador (no hay CI): ver [`CLAUDE.md`](./CLAUDE.md).

### Hooks de git

`simple-git-hooks`: **pre-commit** `bun run biome:check`; **pre-push** `bun run biome:check` + `bun run build`.

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

- [`CLAUDE.md`](./CLAUDE.md) — guía operativa (reglas, comandos, deploy).
- [`docs/`](./docs/) — arquitectura, modelo de datos, identidad, tiendas.
- [`.github/instructions/web.instructions.md`](./.github/instructions/web.instructions.md) — sistema de diseño de la web.
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
- Migraciones SQL a mano en `packages/database/migrations/`, no destructivas y revisadas.
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
