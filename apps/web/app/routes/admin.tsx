import { redirect } from "react-router";

export function loader() {
  throw redirect("/admin/moderation");
}

export default function AdminIndex() {
  return null;
}
