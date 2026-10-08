import { redirect } from "react-router";

/** El evento Cyber pasó: su lista de bajas es el catálogo ordenado por mayor baja. */
export function loader() {
  throw redirect("/buscar?sort=discount", 301);
}

export default function RedirectOldCyber() {
  return null;
}
