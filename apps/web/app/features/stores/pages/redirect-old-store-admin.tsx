import { redirect } from "react-router";
import type { Route } from "./+types/redirect-old-store-admin";

export function loader({ params }: Route.LoaderArgs) {
  throw redirect(`/tiendas/${params.slug}/admin`, 301);
}

export default function RedirectOldStoreAdmin() {
  return null;
}
