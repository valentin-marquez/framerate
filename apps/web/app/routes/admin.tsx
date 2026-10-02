import { redirect } from "react-router";

export function loader() {
  throw redirect("/admin/estado");
}

export default function AdminIndex() {
  return null;
}
