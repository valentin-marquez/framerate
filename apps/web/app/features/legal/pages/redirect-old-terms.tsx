import { redirect } from "react-router";

export function loader() {
  throw redirect("/terminos", 301);
}

export default function RedirectOldTerms() {
  return null;
}
