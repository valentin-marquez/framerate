import { redirect } from "react-router";

/** El evento Cyber pasó: sus enlaces van a las bajas del evento vigente. */
export function loader() {
  throw redirect("/black-friday", 302);
}

export default function RedirectOldCyber() {
  return null;
}
