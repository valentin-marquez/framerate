import auth from "@/routes/auth";
import categories from "@/routes/categories";
// Fase 1: claims + stores
import claims from "@/routes/claims";
import products from "@/routes/products";
import profiles from "@/routes/profiles";
import quotes from "@/routes/quotes";
// Fase 2: store-reviews (sub-apps por slug y por id)
import { storeReviewsById, storeReviewsByStore } from "@/routes/store-reviews";
import stores from "@/routes/stores";
import translationFeedback from "@/routes/translation-feedback";

const API_VERSION = "v1";

export const routes = [
  {
    path: `/${API_VERSION}/auth`,
    route: auth,
  },
  {
    path: `/${API_VERSION}/categories`,
    route: categories,
  },
  // images route is mounted manually in index.ts to bypass global middleware
  {
    path: `/${API_VERSION}/products`,
    route: products,
  },
  {
    path: `/${API_VERSION}/profiles`,
    route: profiles,
  },
  {
    path: `/${API_VERSION}/quotes`,
    route: quotes,
  },
  {
    path: `/${API_VERSION}/translation-feedback`,
    route: translationFeedback,
  },
  // Fase 1: claims + stores
  {
    path: `/${API_VERSION}/claims`,
    route: claims,
  },
  {
    path: `/${API_VERSION}/stores`,
    route: stores,
  },
  // Fase 2: store-reviews montadas en mismo prefijo /v1/stores (Hono compone rutas
  // por path completo, así que coexisten con `stores` sin shadowearse) y /v1/reviews
  {
    path: `/${API_VERSION}/stores`,
    route: storeReviewsByStore,
  },
  {
    path: `/${API_VERSION}/reviews`,
    route: storeReviewsById,
  },
];
