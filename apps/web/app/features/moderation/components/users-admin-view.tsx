import type { AdminUser, AdminUserPage, ModerationAction, Role } from "@framerate/contracts";
import {
  IconBan,
  IconBrandDiscord,
  IconBrandGoogle,
  IconLoader2,
  IconSearch,
  IconUserCheck,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { Form, Link, useNavigation, useRevalidator, useSearchParams } from "react-router";
import { toast } from "sonner";
import { AdminTabs } from "~/shared/components/layout/admin-tabs";
import { Button } from "~/shared/components/primitives/button";
import { Input } from "~/shared/components/primitives/input";
import { Label } from "~/shared/components/primitives/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/shared/components/primitives/select";
import { Textarea } from "~/shared/components/primitives/textarea";
import { ApiError } from "~/shared/lib/api";
import { cn } from "~/shared/lib/utils";
import { formatDateTime } from "~/shared/utils/format";
import { moderationClient } from "../services/moderation";

export const ROLE_LABELS: Record<Role, string> = {
  user: "Usuario",
  support: "Soporte",
  moderator: "Moderador",
  admin: "Admin",
};

const ROLE_SCOPE: Record<Role, string> = {
  user: "Sin acceso al panel.",
  support: "Ve Soporte y el Estado de los sistemas.",
  moderator: "Además modera reportes y revisa el Gatekeeper.",
  admin: "Todo, incluido gestionar usuarios y roles.",
};

export type UserFilter = keyof AdminUserPage["counts"];

const FILTERS: { key: UserFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "staff", label: "Equipo" },
  { key: "admin", label: "Admin" },
  { key: "moderator", label: "Moderador" },
  { key: "support", label: "Soporte" },
  { key: "banned", label: "Suspendidos" },
];

const DURATIONS: Record<string, string> = { "1": "1 día", "7": "7 días", "30": "30 días", forever: "Sin término" };

const ACTION_TEXT: Partial<Record<ModerationAction["action"], (a: ModerationAction) => string>> = {
  user_banned: (a) => `Suspendido${a.reason ? `: ${a.reason}` : ""}`,
  user_unbanned: () => "Se levantó la suspensión",
  role_changed: (a) => `Rol cambiado a ${ROLE_LABELS[(a.after as { role: Role }).role] ?? "otro"}`,
};

const day = (iso: string) => formatDateTime(iso).slice(0, 10);

function useUrl() {
  const [params] = useSearchParams();
  return (change: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(change)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    return query ? `?${query}` : ".";
  };
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-secondary font-medium text-muted-foreground",
        className,
      )}
    >
      {name[0]?.toUpperCase()}
    </span>
  );
}

function RoleTag({ user }: { user: AdminUser }) {
  if (user.ban) {
    return <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive text-xs">Suspendido</span>;
  }
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs",
        user.role === "user" ? "text-muted-foreground" : "bg-secondary font-medium text-foreground",
      )}
    >
      {ROLE_LABELS[user.role]}
    </span>
  );
}

/** Corre una acción contra la API, avisa el resultado y recarga los datos. */
function useAction() {
  const revalidator = useRevalidator();
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      revalidator.revalidate();
      return true;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo completar");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

function UserPanel({
  user,
  history,
  isSelf,
  closeTo,
}: {
  user: AdminUser;
  history: ModerationAction[];
  isSelf: boolean;
  closeTo: string;
}) {
  const [role, setRole] = useState<Role>(user.role);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("7");
  const { busy, run } = useAction();

  const ban = () => {
    const expiresAt =
      duration === "forever" ? undefined : new Date(Date.now() + Number(duration) * 86_400_000).toISOString();
    return run(
      () => moderationClient.ban({ user_id: user.id, reason: reason.trim() || undefined, expires_at: expiresAt }),
      "Usuario suspendido",
    ).then((ok) => ok && setReason(""));
  };

  return (
    <aside
      aria-label={`Ficha de ${user.displayName}`}
      className="fixed inset-0 z-50 overflow-y-auto bg-background p-4 lg:static lg:z-auto lg:max-h-[calc(100vh-3rem)] lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:p-5"
    >
      <div className="flex items-start gap-3">
        <Avatar name={user.displayName} className="size-12 text-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{user.displayName}</p>
          <Link to={`/u/${user.username}`} className="truncate text-muted-foreground text-sm hover:underline">
            @{user.username}
          </Link>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Cerrar"
          nativeButton={false}
          render={<Link to={closeTo} preventScrollReset replace />}
        >
          <IconX className="size-4" />
        </Button>
      </div>

      <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {user.email && (
          <>
            <dt className="text-muted-foreground">Correo</dt>
            <dd className="truncate">{user.email}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Entra con</dt>
        <dd className="flex flex-wrap items-center gap-3">
          {user.providers.length === 0 && "Sin proveedor"}
          {user.providers.map((p) => {
            const Icon = p === "discord" ? IconBrandDiscord : p === "google" ? IconBrandGoogle : null;
            return (
              <span key={p} className="flex items-center gap-1.5 capitalize">
                {Icon && <Icon className="size-4" aria-hidden />}
                {p}
              </span>
            );
          })}
        </dd>
        <dt className="text-muted-foreground">Alta</dt>
        <dd>{formatDateTime(user.createdAt)}</dd>
        <dt className="text-muted-foreground">Último acceso</dt>
        <dd>{user.lastSeenAt ? formatDateTime(user.lastSeenAt) : "Nunca"}</dd>
      </dl>

      <section className="mt-6 space-y-2 border-border border-t pt-5">
        <Label htmlFor="role">Rol</Label>
        <Select value={role} onValueChange={(v) => setRole(v as Role)} disabled={isSelf}>
          <SelectTrigger id="role" className="w-full">
            <SelectValue>{(v: string) => ROLE_LABELS[v as Role]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          {isSelf ? "No puedes cambiar tu propio rol." : ROLE_SCOPE[role]}
        </p>
        {role !== user.role && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => run(() => moderationClient.changeRole(user.id, role), `Ahora es ${ROLE_LABELS[role]}`)}
          >
            {busy && <IconLoader2 className="size-4 animate-spin" />}
            Cambiar a {ROLE_LABELS[role]}
          </Button>
        )}
      </section>

      {!isSelf && (
        <section className="mt-6 space-y-2 border-border border-t pt-5">
          <h3 className="font-medium text-sm">Suspensión</h3>
          {user.ban ? (
            <>
              <p className="text-sm">
                Suspendido {user.ban.expiresAt ? `hasta ${formatDateTime(user.ban.expiresAt)}` : "sin término"}.
                {user.ban.reason && <span className="block text-muted-foreground">Motivo: {user.ban.reason}</span>}
              </p>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => run(() => moderationClient.unban({ user_id: user.id }), "Suspensión levantada")}
              >
                <IconUserCheck className="size-4" />
                Levantar suspensión
              </Button>
            </>
          ) : (
            <>
              <Textarea
                aria-label="Motivo"
                placeholder="Motivo (lo ve el equipo, no el usuario)"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex gap-2">
                <Select value={duration} onValueChange={(v) => setDuration(v as string)}>
                  <SelectTrigger className="flex-1" aria-label="Duración">
                    <SelectValue>{(v: string) => DURATIONS[v]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DURATIONS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="destructive" disabled={busy} onClick={ban}>
                  <IconBan className="size-4" />
                  Suspender
                </Button>
              </div>
            </>
          )}
        </section>
      )}

      <section className="mt-6 space-y-2 border-border border-t pt-5">
        <h3 className="font-medium text-sm">Historial</h3>
        {history.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sin cambios de rol ni sanciones.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {history.map((a) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span>
                  {ACTION_TEXT[a.action]?.(a) ?? a.action}
                  {a.actor && <span className="block text-muted-foreground text-xs">por {a.actor.displayName}</span>}
                </span>
                <time className="shrink-0 text-muted-foreground text-xs">{day(a.createdAt)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}

interface UsersAdminViewProps {
  data: AdminUserPage;
  q: string;
  filter: UserFilter;
  page: number;
  selected: AdminUser | null;
  history: ModerationAction[];
  currentUserId: string;
}

/** /admin/users: todos los registrados con chips por rol, buscador y la ficha de uno en un panel lateral. */
export function UsersAdminView({ data, q, filter, page, selected, history, currentUserId }: UsersAdminViewProps) {
  const url = useUrl();
  // Mientras carga otra ficha, la anterior no acepta acciones: suspender a quien ya no se está mirando es fácil.
  const navigating = useNavigation().state !== "idle";
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8">
      <AdminTabs current="/admin/users" />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-title-h4 md:text-title-h3">Usuarios</h1>
          <p className="text-muted-foreground text-sm">
            {q ? `${data.counts.all} coinciden con "${q}"` : `${data.counts.all} registrados`}, {data.counts.staff} en
            el equipo
          </p>
        </div>
        <Form method="get" role="search" className="relative w-full sm:w-72">
          <IconSearch className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" aria-hidden />
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <Input
            type="search"
            name="q"
            aria-label="Buscar usuarios"
            placeholder="Nombre, usuario o correo exacto"
            key={q}
            defaultValue={q}
            minLength={2}
            className="pl-9"
          />
        </Form>
      </header>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map(({ key, label }) => (
          <Link
            key={key}
            to={url({ filter: key === "all" ? null : key, page: null, u: null })}
            preventScrollReset
            replace
            aria-current={filter === key ? "true" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-sm transition-colors",
              filter === key
                ? "bg-foreground text-background"
                : "bg-secondary/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            <span className="tabular-nums opacity-70">{data.counts[key]}</span>
          </Link>
        ))}
      </div>

      <div className={cn("grid items-start gap-4", selected && "lg:grid-cols-[1fr_340px]")}>
        <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="hidden grid-cols-[1fr_7rem_6rem_7rem] gap-4 border-border border-b px-4 py-2 text-muted-foreground text-xs md:grid">
            <span>Usuario</span>
            <span>Rol</span>
            <span>Alta</span>
            <span>Último acceso</span>
          </div>
          <ul className="divide-y divide-border">
            {data.items.map((u) => (
              <li key={u.id}>
                <Link
                  to={url({ u: u.id })}
                  preventScrollReset
                  replace
                  aria-current={u.id === selected?.id ? "true" : undefined}
                  className={cn(
                    "grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-secondary/40 md:grid-cols-[1fr_7rem_6rem_7rem]",
                    u.id === selected?.id && "bg-secondary/60",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={u.displayName} className="size-9" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-sm">{u.displayName}</span>
                      <span className="block truncate text-muted-foreground text-xs">
                        @{u.username} {u.email}
                      </span>
                    </span>
                  </span>
                  <span>
                    <RoleTag user={u} />
                  </span>
                  <span className="hidden text-muted-foreground text-sm md:block">{day(u.createdAt)}</span>
                  <span className="hidden text-muted-foreground text-sm md:block">
                    {u.lastSeenAt ? day(u.lastSeenAt) : "Nunca"}
                  </span>
                </Link>
              </li>
            ))}
            {data.items.length === 0 && (
              <li className="p-8 text-center text-muted-foreground text-sm">Nadie coincide.</li>
            )}
          </ul>
          {(page > 1 || data.hasMore) && (
            <nav aria-label="Páginas" className="flex justify-between border-border border-t px-4 py-3 text-sm">
              {page > 1 ? (
                <Link to={url({ page: page === 2 ? null : String(page - 1), u: null })}>Anteriores</Link>
              ) : (
                <span />
              )}
              {data.hasMore && <Link to={url({ page: String(page + 1), u: null })}>Siguientes</Link>}
            </nav>
          )}
        </section>
        {selected && (
          <div inert={navigating} className={cn("transition-opacity lg:sticky lg:top-6", navigating && "opacity-50")}>
            <UserPanel
              key={`${selected.id}:${selected.role}:${selected.ban !== null}`}
              user={selected}
              history={history}
              isSelf={selected.id === currentUserId}
              closeTo={url({ u: null })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
