import { redirect } from "react-router";

/** El evento Cyber pasó. */
export function loader() {
  throw redirect("/", 301);
}

export default function RedirectOldCyber() {
  return null;
}
