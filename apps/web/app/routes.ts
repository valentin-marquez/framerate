import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("action/set-theme", "routes/action.set-theme.ts"),
  route("categorias/:slug", "routes/category.tsx"),
  route("product/:slug", "routes/product.tsx"),
] satisfies RouteConfig;
