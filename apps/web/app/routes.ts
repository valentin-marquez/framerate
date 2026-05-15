import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("features/home/pages/home-page.tsx"),

  // Auth
  route("action/auth", "features/auth/pages/auth-action.tsx"),
  route("auth/callback", "features/auth/pages/auth-callback.tsx"),

  // Info
  route("privacy", "features/legal/pages/privacy-page.tsx"),
  route("terms", "features/legal/pages/terms-page.tsx"),

  // Products & Categories
  route("explorar", "features/explore/pages/explore-page.tsx"),
  route("categoria/:slug", "features/category/pages/category-page.tsx"),
  route("producto/:slug", "features/product/pages/product-details.tsx"),

  // rutas protegidas (opcionales)
  route("profile", "features/profile/pages/profile-page.tsx", { id: "profile-me" }),
  route("u/:username", "features/profile/pages/profile-page.tsx", { id: "profile-user" }),
  route("cotizacion/:slug", "features/quote/pages/quote-details.tsx"),

  // rutas privadas (requerir inicio de sesión)
  route("settings", "features/settings/pages/layout.tsx", [
    index("features/settings/pages/account.tsx", { id: "settings-index" }),
    route("account", "features/settings/pages/account.tsx", { id: "settings-account" }),
    route("preferences", "features/settings/pages/preferences.tsx"),
  ]),

  // Fase 1: stores + claim flow
  route("stores/:slug", "features/stores/pages/store-page.tsx"),
  route("stores/:slug/admin", "features/stores/pages/store-admin.tsx"),
  route("claim", "features/stores/pages/claim-page.tsx"),

  // Admin
  route("admin/gatekeeper", "features/gatekeeper/pages/review-dashboard.tsx"),

  route("theme-switcher", "shared/components/theme/theme-switcher.ts"),
  route("lang-switcher", "shared/components/lang/lang-switcher.ts"),
  route("robots.txt", "routes/robots.ts"),
] satisfies RouteConfig;
