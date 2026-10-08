import { redirect } from "react-router";

export function loader() {
  throw redirect("/desarrolladores", 301);
}

export default function RedirectOldDevelopers() {
  return null;
}
