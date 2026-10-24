import { getAuthUser } from "~/features/auth/services/auth.server";
import { ApiError } from "~/shared/lib/api";
import { StoreView } from "../components/store-view";
import { type StoreProductsResponse, storesService, type ViewerStoreRole } from "../services/stores";
import type { Route } from "./+types/store-page";

export function meta({ loaderData: data }: Route.MetaArgs) {
  if (!data?.store) return [{ title: "Tienda no encontrada - Framerate" }];
  return [
    { title: `${data.store.name}: precios y productos en Chile - Framerate` },
    {
      name: "description",
      content:
        data.store.description ??
        `Precios de ${data.products.total.toLocaleString("es-CL")} productos de ${data.store.name} comparados con otras tiendas de Chile, con historial de precios y stock.`,
    },
  ];
}

// Fallback cuando el endpoint de productos falla: la página igual renderiza.
const emptyProducts = (slug: string): StoreProductsResponse => ({
  store: { slug, name: "" },
  total: 0,
  categories: [],
});

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const [store, { user }, products] = await Promise.all([
      storesService.getPublic(params.slug),
      getAuthUser(request),
      storesService.getProducts(params.slug, params.slug).catch(() => emptyProducts(params.slug)),
    ]);

    let viewerRole: ViewerStoreRole | null = null;
    const isAuthenticated = !!user;
    if (user) {
      try {
        const me = await storesService.getMyRole(params.slug);
        viewerRole = me.role;
      } catch {
        viewerRole = null;
      }
    }

    return { store, viewerRole, isAuthenticated, products };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw new Response("Not found", { status: 404 });
    }
    throw err;
  }
}

export default function StorePage({ loaderData }: Route.ComponentProps) {
  const { store, viewerRole, isAuthenticated, products } = loaderData;
  return (
    <StoreView
      store={store}
      categories={products.categories}
      viewerRole={viewerRole}
      isAuthenticated={isAuthenticated}
    />
  );
}
