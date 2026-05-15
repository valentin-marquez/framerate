import { IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";
import { Link, redirect, useFetcher } from "react-router";
import { toast } from "sonner";
import { requireAuth } from "~/features/auth/services/auth.server";
import { Button } from "~/shared/components/primitives/button";
import { Input } from "~/shared/components/primitives/input";
import { Label } from "~/shared/components/primitives/label";
import { Textarea } from "~/shared/components/primitives/textarea";
import { ApiError } from "~/shared/lib/api";
import { StoreMemberList } from "../components/store-member-list";
import { type StoreMember, storesService } from "../services/stores";
import type { Route } from "./+types/store-admin";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase } = await requireAuth(request);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) throw redirect("/");

  const store = await storesService.get(params.slug);

  // Pedir miembros: si responde 403, no es editor.
  try {
    const { members } = await storesService.listMembers(params.slug, session.access_token);
    const me = session.user;
    const meMembership = members.find((m: StoreMember) => m.user_id === me.id) ?? null;
    return {
      store,
      members,
      meMembership,
      token: session.access_token,
    };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
      throw new Response("Forbidden", { status: 403 });
    }
    throw err;
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase } = await requireAuth(request);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw redirect("/");

  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "update-metadata") {
    const social: Record<string, string> = {};
    for (const key of ["twitter", "instagram", "facebook"] as const) {
      const v = form.get(`social_${key}`);
      if (typeof v === "string" && v.trim()) social[key] = v.trim();
    }
    const data = {
      description: (form.get("description") as string) || null,
      website: (form.get("website") as string) || null,
      banner_url: (form.get("banner_url") as string) || null,
      social,
    };
    try {
      const updated = await storesService.update(params.slug, data, session.access_token);
      return { ok: true, store: updated };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Error" };
    }
  }

  if (intent === "add-member") {
    const userId = form.get("user_id") as string;
    const role = (form.get("role") as "owner" | "editor") || "editor";
    try {
      await storesService.addMember(params.slug, userId, role, session.access_token);
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
  const [newUserId, setNewUserId] = useState("");
  const isOwner = meMembership?.role === "owner";

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
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={store.description ?? ""}
              maxLength={500}
              rows={3}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="website">Sitio web</Label>
              <Input id="website" name="website" type="url" defaultValue={store.website ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="banner_url">Banner URL</Label>
              <Input id="banner_url" name="banner_url" type="url" defaultValue={store.banner_url ?? ""} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="social_twitter">Twitter</Label>
              <Input
                id="social_twitter"
                name="social_twitter"
                defaultValue={(store.social as Record<string, string>)?.twitter ?? ""}
              />
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
              <Label htmlFor="user_id">Invitar editor (user_id)</Label>
              <Input
                id="user_id"
                name="user_id"
                placeholder="uuid del usuario"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
              />
            </div>
            <input type="hidden" name="role" value="editor" />
            <Button type="submit" disabled={!newUserId || isSubmitting}>
              Invitar
            </Button>
          </fetcher.Form>
        )}
      </section>
    </main>
  );
}
