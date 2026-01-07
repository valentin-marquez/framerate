import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

  // Auth
  route("action/auth", "routes/action.auth.tsx"),
  route("auth/callback", "routes/auth.callback.tsx"),

  // Info
  route("privacy", "routes/privacy.tsx"),
  route("terms", "routes/terms.tsx"),

  // Products & Categories
  route("categoria/:slug", "routes/category.tsx"),
  route("producto/:slug", "routes/product.tsx"),

  // rutas protegidas (opcionales)
  route("profile", "routes/profile.tsx", { id: "profile-me" }),
  route("u/:username", "routes/profile.tsx", { id: "profile-user" }),
  route("cotizacion/:slug", "routes/quote.tsx"),

  // rutas privadas (requerir inicio de sesión)
  route("settings", "routes/settings/layout.tsx", [
    index("routes/settings/account.tsx", { id: "settings-index" }),
    route("account", "routes/settings/account.tsx", { id: "settings-account" }),
    route("preferences", "routes/settings/preferences.tsx"),
  ]),

  route("theme-switcher", "components/theme/theme-switcher.ts"),
] satisfies RouteConfig;
