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
  route("categorias/:slug", "routes/category.tsx"),
  route("producto/:slug", "routes/product.tsx"),

  // Protected routes (opcional - ejemplos)
  route("profile", "routes/profile.tsx", { id: "profile-me" }),
  route("u/:username", "routes/profile.tsx", { id: "profile-user" }),
  // route("favoritos", "routes/favorites.tsx"),
  // route("alertas", "routes/alerts.tsx"),

  route("cotizacion/:slug", "routes/quote.tsx"),
] satisfies RouteConfig;
