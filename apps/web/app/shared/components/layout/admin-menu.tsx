import { IconGavel, IconLifebuoy, IconShieldCheck, IconUsers } from "@tabler/icons-react";
import { Link } from "react-router";
import { useUser } from "~/features/auth/hooks/useAuth";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "~/shared/components/primitives/dropdown-menu";

interface AdminMenuProps {
  /** Si false, no lee la sesión (skip cuando el dropdown está cerrado). */
  enabled: boolean;
}

/**
 * Sección "Administración" del dropdown del avatar. Sólo aparece si el usuario
 * tiene rol `moderator` o `admin`. Da acceso a los paneles internos que
 * de otro modo no tienen entrada de navegación.
 */
export function AdminMenu({ enabled }: AdminMenuProps) {
  const role = useUser()?.role ?? "user";

  if (!enabled || role === "user") return null;

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="flex items-center gap-2">
        <IconShieldCheck className="size-4" />
        <span>Administración</span>
      </DropdownMenuLabel>
      <DropdownMenuItem>
        <Link to="/admin/support" className="flex items-center gap-2.5 w-full" prefetch="intent">
          <IconLifebuoy className="size-5" />
          <span>Soporte</span>
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Link to="/admin/moderation" className="flex items-center gap-2.5 w-full" prefetch="intent">
          <IconGavel className="size-5" />
          <span>Moderación</span>
        </Link>
      </DropdownMenuItem>
      {role === "admin" && (
        <DropdownMenuItem>
          <Link to="/admin/users" className="flex items-center gap-2.5 w-full" prefetch="intent">
            <IconUsers className="size-5" />
            <span>Usuarios</span>
          </Link>
        </DropdownMenuItem>
      )}
    </>
  );
}
