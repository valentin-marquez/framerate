import auth from "@/routes/auth";
import categories from "@/routes/categories";
import images from "@/routes/images";
import products from "@/routes/products";
import quotes from "@/routes/quotes";

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
  {
    path: `/${API_VERSION}/images`,
    route: images,
  },
  {
    path: `/${API_VERSION}/products`,
    route: products,
  },
  {
    path: `/${API_VERSION}/quotes`,
    route: quotes,
  },
];
