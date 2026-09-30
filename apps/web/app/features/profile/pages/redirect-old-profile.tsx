import { redirect } from "react-router";

export function loader() {
  throw redirect("/perfil", 301);
}

export default function RedirectOldProfile() {
  return null;
}
