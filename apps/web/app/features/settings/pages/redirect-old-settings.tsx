import { redirect } from "react-router";
import type { Route } from "./+types/redirect-old-settings";

const SECTIONS: Record<string, string> = { account: "cuenta", preferences: "preferencias", tickets: "tickets" };

/** `/settings/*` (inglés) → `/ajustes/*`. */
export function loader({ params }: Route.LoaderArgs) {
  const section = SECTIONS[params["*"] ?? ""];
  throw redirect(section ? `/ajustes/${section}` : "/ajustes", 301);
}

export default function RedirectOldSettings() {
  return null;
}
