import { redirect } from "react-router";
import { isBlackFriday } from "~/shared/lib/black-friday";

/** El evento Cyber pasó: sus enlaces van a las bajas del evento vigente. */
export function loader() {
  throw redirect(isBlackFriday() ? "/black-friday" : "/", 302);
}

export default function RedirectOldCyber() {
  return null;
}
