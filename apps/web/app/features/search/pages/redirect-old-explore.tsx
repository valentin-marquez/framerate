import { redirect } from "react-router";
import type { Route } from "./+types/redirect-old-explore";

// `/buscar` pasó a ser `/buscar`. Los enlaces viejos con `?category=` van directo a la categoría.
export function loader({ url }: Route.LoaderArgs) {
  const params = new URLSearchParams(url.search);
  const category = params.get("category");
  params.delete("category");
  const search = params.get("search");
  if (search !== null) {
    params.delete("search");
    params.set("q", search);
  }
  const query = params.toString();
  throw redirect(`${category ? `/categoria/${category}` : "/buscar"}${query ? `?${query}` : ""}`, 301);
}

export default function RedirectOldExplore() {
  return null;
}
