import { IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";
import { Link, useFetcher } from "react-router";
import { toast } from "sonner";
import { requireAuth } from "~/features/auth/services/auth.server";
import { SESSION_TOKEN } from "~/features/auth/services/session";
import { Button } from "~/shared/components/primitives/button";
import { Input } from "~/shared/components/primitives/input";
import { Label } from "~/shared/components/primitives/label";
import { Textarea } from "~/shared/components/primitives/textarea";
import { ApiError } from "~/shared/lib/api";
import { StoreMemberList } from "../components/store-member-list";
import { type StoreMember, storesService } from "../services/stores";
import type { Route } from "./+types/store-admin";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);

  const store = await storesService.get(params.slug);

  // Pedir miembros: si responde 403, no es editor.
  try {
    const { members } = await storesService.listMembers(params.slug, SESSION_TOKEN);
    const meMembership = members.find((m: StoreMember) => m.userId === user.id) ?? null;
    return {
      store,
      members,
      meMembership,
      token: SESSION_TOKEN,
    };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
      throw new Response("Forbidden", { status: 403 });
    }
    throw err;
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireAuth(request);
  const token = SESSION_TOKEN;

  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "update-metadata") {
    const social: Record<string, string> = {};
    for (const key of ["x", "instagram", "facebook"] as const) {
      const v = form.get(`social_${key}`);
      if (typeof v === "string" && v.trim()) social[key] = v.trim();
    }
    const data = {
      display_name: ((form.get("display_name") as string) || "").trim() || null,
      description: (form.get("description") as string) || null,
      website: (form.get("website") as string) || null,
      social,
    };
    try {
      const updated = await storesService.update(params.slug, data, token);
      return { ok: true, store: updated };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Error" };
    }
  }

  if (intent === "add-member") {
    const username = ((form.get("username") as string) || "").trim();
    try {
      await storesService.addMember(params.slug, username, "editor");
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Error" };
    }
  }

  return { ok: false, error: "intent inválido" };
}

export default function StoreAdmin({ loaderData }: Route.ComponentProps) {
  const { store, members, meMembership, token } = loaderData;
  const fetcher = useFetcher<typeof action>();
  const isSubmitting = fetcher.state !== "idle";
  const [newUsername, setNewUsername] = useState("");
  const isOwner = meMembership?.role === "owner" || meMembership?.role === "admin";

  if (fetcher.data?.ok === false && fetcher.data.error && fetcher.state === "idle") {
    toast.error(fetcher.data.error);
  } else if (fetcher.data?.ok === true && fetcher.state === "idle") {
    toast.success("Guardado");
  }
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 pt-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-2xl">Admin · {store.name}</h1>
          <p className="text-muted-foreground text-sm">
            <Link to={`/tiendas/${store.slug}`} className="hover:text-foreground">
              ← Volver a la tienda pública
            </Link>
          </p>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-medium">Metadata</h2>
        <fetcher.Form method="post" className="mt-4 space-y-4">
          <input type="hidden" name="intent" value="update-metadata" />
          <div className="space-y-2">
            <Label htmlFor="display_name">Nombre público</Label>
            <Input
              id="display_name"
              name="display_name"
              defaultValue={store.display_name ?? ""}
              placeholder={store.canonical_name}
              maxLength={120}
            />
            <p className="text-muted-foreground text-xs">Vacío = usar el nombre catalogado ({store.canonical_name}).</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={store.description ?? ""}
              maxLength={500}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Sitio web</Label>
            <Input id="website" name="website" type="url" defaultValue={store.website ?? ""} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="social_x">X (Twitter)</Label>
              <Input id="social_x" name="social_x" defaultValue={(store.social as Record<string, string>)?.x ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="social_instagram">Instagram</Label>
              <Input
                id="social_instagram"
                name="social_instagram"
                defaultValue={(store.social as Record<string, string>)?.instagram ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="social_facebook">Facebook</Label>
              <Input
                id="social_facebook"
                name="social_facebook"
                defaultValue={(store.social as Record<string, string>)?.facebook ?? ""}
              />
            </div>
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <IconLoader2 className="size-4 animate-spin" />}
            Guardar metadata
          </Button>
        </fetcher.Form>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-medium">Miembros</h2>
        <div className="mt-4">
          <StoreMemberList slug={store.slug} members={members} currentUserIsOwner={isOwner} token={token} />
        </div>
        {isOwner && (
          <fetcher.Form method="post" className="mt-4 flex items-end gap-2">
            <input type="hidden" name="intent" value="add-member" />
            <div className="flex-1 space-y-2">
              <Label htmlFor="username">Sumar editor (nombre de usuario)</Label>
              <Input
                id="username"
                name="username"
                placeholder="nombre_de_usuario"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
            </div>
            <input type="hidden" name="role" value="editor" />
            <Button type="submit" disabled={!newUsername || isSubmitting}>
              Sumar
            </Button>
          </fetcher.Form>
        )}
      </section>
    </main>
  );
}
