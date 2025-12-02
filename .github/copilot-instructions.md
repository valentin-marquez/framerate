# General Project Instructions

These instructions apply to the entire workspace and should be followed for all code generation and modification tasks.

## 1. Monorepo Structure
- **Tool**: **Turborepo** is used to manage the monorepo.

## 2. Runtime & Package Manager
- **Runtime**: **Bun** is the exclusive runtime. Do NOT use Node.js.
- **Package Manager**: **Bun** is used for dependency management.
  - Always use `bun install`, `bun add`, `bun run`, etc.
  - Do not suggest `npm`, `yarn`, or `pnpm` commands.

## 3. Code Quality & Formatting
- **Tool**: **BiomeJS** is used for both linting and formatting across the project.
- **Language**: TypeScript is the primary language.

## 4. Frontend (apps/web)
- **Architecture**: Simple Single Page Application (SPA).
- **Stack**:
  - **React** + **TypeScript**.
  - **Vite** with **SWC** compiler.
  - **Tailwind CSS v4** for styling.

## 5. Backend / API (apps/api)
- **Framework**: **Hono**.
- **Platform**: Cloudflare Workers / Pages Functions.

## 6. Database
- **Provider**: **Supabase**.

## 7. Deployment
- **Platform**: **Cloudflare Pages** for both Web and API (or Cloudflare Workers for API).

## 8. Packages
- **packages/db**:
  - Manages Supabase database schema and migrations.
  - Exports generated TypeScript types (`Database` definitions).
  - Use for all database-related changes.
- Future plans include shared configurations for `tsconfig` and `biome`.
