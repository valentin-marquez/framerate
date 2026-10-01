import { redirect } from "react-router";

export function loader() {
  throw redirect("/privacidad", 301);
}

export default function RedirectOldPrivacy() {
  return null;
}
