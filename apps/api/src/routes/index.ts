import auth from "@/routes/auth";
import categories from "@/routes/categories";
import products from "@/routes/products";
import profiles from "@/routes/profiles";
import quotes from "@/routes/quotes";
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
  // {
  //   path: `/${API_VERSION}/images`,
  //   route: images,
  // },
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
];
