import auth from "./auth";
import categories from "./categories";
import images from "./images";
import products from "./products";

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
];
