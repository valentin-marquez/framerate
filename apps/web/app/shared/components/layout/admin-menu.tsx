import { hasRole } from "@framerate/contracts";
import { IconActivityHeartbeat, IconGavel, IconLifebuoy, IconShieldCheck, IconUsers } from "@tabler/icons-react";
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
 * tiene un rol del equipo (`support` o superior), con los paneles que alcanza.
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
      <DropdownMenuItem render={<Link to="/admin/estado" prefetch="intent" />}>
        <IconActivityHeartbeat className="size-5" />
        <span>Estado</span>
      </DropdownMenuItem>
      <DropdownMenuItem render={<Link to="/admin/support" prefetch="intent" />}>
        <IconLifebuoy className="size-5" />
        <span>Soporte</span>
      </DropdownMenuItem>
      {hasRole(role, "moderator") && (
        <DropdownMenuItem render={<Link to="/admin/moderation" prefetch="intent" />}>
          <IconGavel className="size-5" />
          <span>Moderación</span>
        </DropdownMenuItem>
      )}
      {role === "admin" && (
        <DropdownMenuItem render={<Link to="/admin/users" prefetch="intent" />}>
          <IconUsers className="size-5" />
          <span>Usuarios</span>
        </DropdownMenuItem>
      )}
    </>
  );
}
