import { redirect } from "react-router";
import type { Route } from "./+types/redirect-old-store";

export function loader({ params }: Route.LoaderArgs) {
  throw redirect(`/tiendas/${params.slug}`, 301);
}

export default function RedirectOldStore() {
  return null;
}
