import type { Route } from "./+types/home";
import { Welcome } from "@/components/welcome/welcome";
import { productsService } from "@/services/products";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Framerate" }, { name: "description", content: "Hardware price comparison" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const products = await productsService.getAll({ limit: 5 });
    return { products };
  } catch (error) {
    console.error("Failed to fetch products", error);
    return { products: { data: [] } };
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { products } = loaderData;
  return <Welcome products={products?.data} />;
}
