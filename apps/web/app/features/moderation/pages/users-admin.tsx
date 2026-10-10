import type { ModerationAction } from "@framerate/contracts";
import { requireRole } from "~/features/auth/services/auth.server";
import { type UserFilter, UsersAdminView } from "../components/users-admin-view";
import { moderationClient } from "../services/moderation";
import type { Route } from "./+types/users-admin";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Usuarios - Framerate Admin" }, { name: "robots", content: "noindex" }];
}

const FILTERS: UserFilter[] = ["all", "staff", "user", "support", "moderator", "admin", "banned"];

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireRole(request, "admin");
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim() ?? "";
  const filter = FILTERS.find((f) => f === params.get("filter")) ?? "all";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const selectedId = params.get("u");

  const [data, history] = await Promise.all([
    moderationClient.listUsers({ q: q.length >= 2 ? q : undefined, filter, page }),
    selectedId
      ? moderationClient.listActions({ targetType: "user", targetId: selectedId, pageSize: 20 }).then((r) => r.items)
      : ([] as ModerationAction[]),
  ]);
  const selected = data.items.find((u) => u.id === selectedId) ?? null;

  return { data, q, filter, page, selected, history: selected ? history : [], currentUserId: user.id };
}

export default function UsersAdmin({ loaderData }: Route.ComponentProps) {
  return <UsersAdminView {...loaderData} />;
}
