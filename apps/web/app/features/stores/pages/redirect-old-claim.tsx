import { redirect } from "react-router";

export function loader() {
  throw redirect("/reclamar", 301);
}

export default function RedirectOldClaim() {
  return null;
}
