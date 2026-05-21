import { IconGavel, IconLifebuoy, IconShieldCheck, IconUsers } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuthStore } from "~/features/auth/store/auth";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "~/shared/components/primitives/dropdown-menu";

type Role = "user" | "moderator" | "admin";

/** Decodifica el claim `user_role` del access token (sin verificar la firma). */
function decodeRole(token: string): Role {
  const parts = token.split(".");
  if (parts.length !== 3) return "user";
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const json = JSON.parse(atob(padded)) as { user_role?: unknown };
    return json.user_role === "admin" || json.user_role === "moderator" ? json.user_role : "user";
  } catch {
    return "user";
  }
}

interface AdminMenuProps {
  /** Si false, no lee la sesión (skip cuando el dropdown está cerrado). */
  enabled: boolean;
}

/**
 * Sección "Administración" del dropdown del avatar. Sólo aparece si el JWT del
 * usuario trae rol `moderator` o `admin`. Da acceso a los paneles internos que
 * de otro modo no tienen entrada de navegación.
 */
export function AdminMenu({ enabled }: AdminMenuProps) {
  const [role, setRole] = useState<Role>("user");

  useEffect(() => {
    if (!enabled) return;
    const supabase = useAuthStore.getState().supabase;
    if (!supabase) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (!cancelled && token) setRole(decodeRole(token));
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (role === "user") return null;

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
