import { IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";
import { Link, redirect, useFetcher } from "react-router";
import { toast } from "sonner";
import { requireAuth } from "~/features/auth/services/auth.server";
import { Button } from "~/shared/components/primitives/button";
import { Input } from "~/shared/components/primitives/input";
import { Label } from "~/shared/components/primitives/label";
import { Textarea } from "~/shared/components/primitives/textarea";
import { StoreLogo } from "~/shared/components/store-logo";
import { ApiError } from "~/shared/lib/api";
import { getImageUrl } from "~/shared/utils/images";
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
  const token = session.access_token;

  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "update-metadata") {
    const social: Record<string, string> = {};
    for (const key of ["twitter", "instagram", "facebook"] as const) {
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

  if (intent === "upload-asset") {
    const kind = form.get("kind");
    const file = form.get("file");
    if (kind !== "icon" && kind !== "banner") {
      return { ok: false, error: "Tipo de asset inválido" };
    }
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Selecciona un archivo" };
    }
    try {
      await storesService.uploadAsset(params.slug, kind, file, token);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Error" };
    }
  }

  if (intent === "add-member") {
    const userId = form.get("user_id") as string;
    const role = (form.get("role") as "owner" | "admin" | "editor") || "editor";
    try {
      await storesService.addMember(params.slug, userId, role, token);
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
  const assetFetcher = useFetcher<typeof action>();
  const isSubmitting = fetcher.state !== "idle";
  const isUploading = assetFetcher.state !== "idle";
  const [newUserId, setNewUserId] = useState("");
  const isOwner = meMembership?.role === "owner" || meMembership?.role === "admin";

  if (fetcher.data?.ok === false && fetcher.data.error && fetcher.state === "idle") {
    toast.error(fetcher.data.error);
  } else if (fetcher.data?.ok === true && fetcher.state === "idle") {
    toast.success("Guardado");
  }
  if (assetFetcher.data?.ok === false && assetFetcher.data.error && assetFetcher.state === "idle") {
    toast.error(assetFetcher.data.error);
  } else if (assetFetcher.data?.ok === true && assetFetcher.state === "idle") {
    toast.success("Imagen actualizada");
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
        <h2 className="font-medium">Identidad</h2>
        <p className="mt-1 text-muted-foreground text-xs">
          El icono y el banner se alojan en nuestro almacenamiento (no dependen de tu sitio).
        </p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Icono</Label>
            <div className="flex items-center gap-3">
              <StoreLogo store={store} className="size-14 rounded-xl" />
              <assetFetcher.Form method="post" encType="multipart/form-data" className="flex-1 space-y-2">
                <input type="hidden" name="intent" value="upload-asset" />
                <input type="hidden" name="kind" value="icon" />
                <Input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml" />
                <Button type="submit" size="sm" variant="secondary" disabled={isUploading}>
                  {isUploading && <IconLoader2 className="size-4 animate-spin" />}
                  Subir icono
                </Button>
              </assetFetcher.Form>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Banner</Label>
            {store.banner_url ? (
              <div
                className="h-16 w-full rounded-lg bg-cover bg-center"
                style={{ backgroundImage: `url(${getImageUrl(store.banner_url)})` }}
                aria-hidden
              />
            ) : (
              <div className="h-16 w-full rounded-lg bg-secondary/40" aria-hidden />
            )}
            <assetFetcher.Form method="post" encType="multipart/form-data" className="space-y-2">
              <input type="hidden" name="intent" value="upload-asset" />
              <input type="hidden" name="kind" value="banner" />
              <Input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/avif" />
              <Button type="submit" size="sm" variant="secondary" disabled={isUploading}>
                {isUploading && <IconLoader2 className="size-4 animate-spin" />}
                Subir banner
              </Button>
            </assetFetcher.Form>
          </div>
        </div>
      </section>

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
