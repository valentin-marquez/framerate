import type { KnipConfig } from "knip";

/**
 * Knip configuration for the React Router v7 SSR app.
 *
 * Why this file exists:
 *   `react-doctor` runs knip against `apps/web` and was reporting 100+ false
 *   positives on hooks/services that are actually referenced via React Router
 *   route modules (loader/action/default/meta/links conventions) and via the
 *   Cloudflare Workers + Vite SSR entrypoints. Without this config, knip
 *   doesn't know those exports are consumed by the framework.
 *
 * Approach:
 *   - Whitelist every route module declared in `app/routes.ts` as an entry.
 *   - Whitelist the SSR/CSR Vite entry files + Cloudflare worker entry.
 *   - Treat the named exports React Router expects (`loader`, `action`,
 *     `meta`, `links`, `headers`, `clientLoader`, `clientAction`,
 *     `ErrorBoundary`, `HydrateFallback`, `shouldRevalidate`) as conventions
 *     so knip doesn't flag them as "unused exports".
 *   - Allow type-only re-exports (`Route.MetaArgs`, etc.) used by RR typegen.
 *
 * When adding a new route to `app/routes.ts`, no change is needed here — the
 * `app/features/** /pages/*.tsx` glob captures all page modules. Top-level
 * `app/routes/*.{ts,tsx}` is also covered for legacy resource routes.
 */
const config: KnipConfig = {
  entry: [
    // Vite + React Router framework-mode entries.
    "app/root.tsx",
    "app/entry.client.tsx",
    "app/entry.server.tsx",
    "app/routes.ts",
    "react-router.config.ts",
    "vite.config.ts",
    "wrangler.jsonc",

    // Cloudflare Workers entry (SSR build target).
    "workers/**/*.{ts,tsx}",

    // Resource routes (sitemap, robots, theme/lang switchers).
    "app/routes/**/*.{ts,tsx}",

    // Route modules referenced by `app/routes.ts`. The page filenames live
    // under `features/<area>/pages/`, plus a handful of switcher files under
    // `shared/components/<area>/`.
    "app/features/**/pages/*.tsx",
    "app/shared/components/theme/theme-switcher.ts",
    "app/shared/components/lang/lang-switcher.ts",

    // Server-only loader helpers consumed by route modules.
    "app/**/*.server.{ts,tsx}",
  ],
  project: ["app/**/*.{ts,tsx}"],

  // React Router conventions: these named exports are read by the framework
  // even when there are no static import references. Treat them as "used".
  ignoreExportsUsedInFile: true,

  ignore: [
    // RR typegen output; regenerated on every dev/build, do not lint.
    ".react-router/**",
    // Cloudflare-generated runtime types.
    "worker-configuration.d.ts",
  ],

  // The framework calls these by convention from route modules; suppressing
  // them here means knip won't report them as unused even if a particular
  // route never imports them by name.
  paths: {
    "~/*": ["app/*"],
  },

  rules: {
    // Files truly unused (no importers at all) are still worth surfacing.
    files: "warn",
    // Suppress noisy categories knip can't reason about for RR conventions.
    exports: "warn",
    types: "warn",
    nsExports: "off",
    nsTypes: "off",
    duplicates: "warn",
    enumMembers: "off",
    classMembers: "off",
    unlisted: "off",
    binaries: "off",
    unresolved: "off",
    dependencies: "warn",
    devDependencies: "off",
    optionalPeerDependencies: "off",
    unusedTypes: "warn",
  },
};

export default config;
