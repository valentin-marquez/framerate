import { hasRole, type Role } from "@framerate/contracts";
import { IconActivityHeartbeat, IconGavel, IconGitMerge, IconLifebuoy, IconUsers } from "@tabler/icons-react";
import { Link } from "react-router";
import { useUser } from "~/features/auth/hooks/useAuth";
import { cn } from "~/shared/lib/utils";

const TABS = [
  { to: "/admin/estado", label: "Estado", Icon: IconActivityHeartbeat, min: "support" },
  { to: "/admin/support", label: "Soporte", Icon: IconLifebuoy, min: "support" },
  { to: "/admin/moderation", label: "Moderación", Icon: IconGavel, min: "moderator" },
  { to: "/admin/gatekeeper", label: "Gatekeeper", Icon: IconGitMerge, min: "moderator" },
  { to: "/admin/users", label: "Usuarios", Icon: IconUsers, min: "admin" },
] as const satisfies readonly { to: string; label: string; Icon: unknown; min: Role }[];

/** Pestañas entre los paneles internos; cada rol ve sólo los que alcanza. */
export function AdminTabs({ current }: { current: (typeof TABS)[number]["to"] }) {
  const role = useUser()?.role ?? "user";
  return (
    <nav aria-label="Administración" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex w-max gap-1 border-border border-b">
        {TABS.filter((t) => hasRole(role, t.min)).map(({ to, label, Icon }) => (
          <li key={to}>
            <Link
              to={to}
              prefetch="intent"
              aria-current={current === to ? "page" : undefined}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 font-medium text-sm transition-colors",
                current === to
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
