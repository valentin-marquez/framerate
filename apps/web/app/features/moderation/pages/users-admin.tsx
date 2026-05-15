import { IconBan, IconLoader2, IconUserCheck, IconUserShield } from "@tabler/icons-react";
import { useState } from "react";
import { useRevalidator } from "react-router";
import { toast } from "sonner";
import { requireAuth, requireRole } from "~/features/auth/services/auth.server";
import { Button } from "~/shared/components/primitives/button";
import { Input } from "~/shared/components/primitives/input";
import { Label } from "~/shared/components/primitives/label";
import { Textarea } from "~/shared/components/primitives/textarea";
import { ApiError } from "~/shared/lib/api";
import { cn } from "~/shared/lib/utils";
import { moderationClient } from "../services/moderation";
import type { Route } from "./+types/users-admin";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Users admin | Framerate" }, { name: "robots", content: "noindex" }];
}

interface ProfileSearchResult {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  banned: boolean;
  ban_reason: string | null;
  ban_expires_at: string | null;
  role: "user" | "moderator" | "admin";
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  const { supabase } = await requireAuth(request);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();

  let results: ProfileSearchResult[] = [];
  if (q && q.length >= 2) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .ilike("username", `%${q}%`)
      .limit(20);

    if (profiles && profiles.length > 0) {
      const ids = profiles.map((p) => p.id);
      const [{ data: bans }, { data: roles }] = await Promise.all([
        supabase.from("user_bans").select("user_id, reason, expires_at, lifted_at").in("user_id", ids),
        supabase.from("user_roles").select("user_id, role").in("user_id", ids),
      ]);

      const banMap = new Map((bans ?? []).filter((b) => b.lifted_at === null).map((b) => [b.user_id, b]));
      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));

      results = profiles.map((p) => {
        const ban = banMap.get(p.id);
        return {
          id: p.id,
          username: p.username,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          banned: !!ban,
          ban_reason: ban?.reason ?? null,
          ban_expires_at: ban?.expires_at ?? null,
          role: (roleMap.get(p.id) ?? "user") as ProfileSearchResult["role"],
        };
      });
    }
  }

  return { q: q ?? "", results, token: session.access_token };
}

export default function UsersAdmin({ loaderData }: Route.ComponentProps) {
  const { q, results, token } = loaderData;
  const revalidator = useRevalidator();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("");

  async function handleBan(userId: string) {
    setBusyId(userId);
    try {
      await moderationClient.ban({ user_id: userId, reason: banReason.trim() || undefined }, token);
      toast.success("Usuario baneado");
      setBanReason("");
      revalidator.revalidate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Error baneando");
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnban(userId: string) {
    setBusyId(userId);
    try {
      await moderationClient.unban({ user_id: userId }, token);
      toast.success("Ban levantado");
      revalidator.revalidate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Error desbaneando");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <header className="mx-auto max-w-4xl mb-6 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
          <IconUserShield className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="text-sm text-muted-foreground">Admin only. Busca un user por username y gestiona su ban.</p>
        </div>
      </header>

      <form method="get" className="mx-auto max-w-4xl mb-6 flex gap-2">
        <Input
          type="search"
          name="q"
          placeholder="Buscar por username (min 2 caracteres)"
          defaultValue={q}
          className="flex-1"
        />
        <Button type="submit">Buscar</Button>
      </form>

      <main className="mx-auto max-w-4xl">
        {results.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            {q ? "Ningun resultado." : "Escribi un username para buscar."}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {results.map((u) => (
              <div
                key={u.id}
                className={cn(
                  "rounded-2xl border bg-card p-4 flex items-center gap-4",
                  u.banned ? "border-destructive/30 bg-destructive/5" : "border-border",
                )}
              >
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="size-12 rounded-full object-cover" />
                ) : (
                  <div className="size-12 rounded-full bg-secondary grid place-items-center text-muted-foreground font-medium">
                    {u.username?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{u.full_name ?? u.username ?? "—"}</p>
                    <span className="text-xs rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
                      {u.role}
                    </span>
                    {u.banned ? (
                      <span className="text-xs rounded-full bg-destructive/10 text-destructive px-2 py-0.5 font-medium">
                        Baneado
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    @{u.username} · {u.id.slice(0, 8)}
                  </p>
                  {u.banned && u.ban_reason ? (
                    <p className="text-xs text-destructive mt-1">Motivo: {u.ban_reason}</p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 min-w-[12rem]">
                  {u.banned ? (
                    <Button size="sm" variant="secondary" disabled={busyId === u.id} onClick={() => handleUnban(u.id)}>
                      {busyId === u.id ? (
                        <IconLoader2 className="size-4 animate-spin" />
                      ) : (
                        <IconUserCheck className="size-4" />
                      )}
                      Levantar ban
                    </Button>
                  ) : (
                    <details>
                      <summary className="cursor-pointer text-sm text-destructive hover:underline">
                        <IconBan className="size-4 inline" /> Banear
                      </summary>
                      <div className="mt-2 flex flex-col gap-2">
                        <Label htmlFor={`reason-${u.id}`} className="text-xs">
                          Motivo
                        </Label>
                        <Textarea
                          id={`reason-${u.id}`}
                          value={banReason}
                          onChange={(e) => setBanReason(e.target.value)}
                          rows={2}
                          className="text-xs"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busyId === u.id}
                          onClick={() => handleBan(u.id)}
                        >
                          {busyId === u.id ? <IconLoader2 className="size-4 animate-spin" /> : null}
                          Confirmar ban
                        </Button>
                      </div>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
