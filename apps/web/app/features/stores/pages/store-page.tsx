import { IconLockOpen2, IconShieldCheck } from "@tabler/icons-react";
import { Link } from "react-router";
import { getSession } from "~/features/auth/services/auth.server";
import { StoreReviewsSection } from "~/features/store-reviews/components/store-reviews-section";
import { ApiError } from "~/shared/lib/api";
import { StoreHeader } from "../components/store-header";
import { storesService, type ViewerStoreRole } from "../services/stores";
import type { Route } from "./+types/store-page";

export function meta({ data }: Route.MetaArgs) {
  if (!data?.store) return [{ title: "Tienda no encontrada · Framerate" }];
  return [
    { title: `${data.store.name} · Framerate` },
    { name: "description", content: data.store.description ?? `Tienda ${data.store.name} en Framerate.cl` },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const [store, { session }] = await Promise.all([storesService.get(params.slug), getSession(request)]);

    let viewerRole: ViewerStoreRole | null = null;
    const isAuthenticated = !!session?.access_token;
    if (session?.access_token) {
      try {
        const me = await storesService.getMyRole(params.slug, session.access_token);
        viewerRole = me.role;
      } catch {
        viewerRole = null;
      }
    }

    return { store, viewerRole, isAuthenticated };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw new Response("Not found", { status: 404 });
    }
    throw err;
  }
}

export default function StorePage({ loaderData }: Route.ComponentProps) {
  const { store, viewerRole, isAuthenticated } = loaderData;
  const canManage = viewerRole !== null;
  const showClaimCta = isAuthenticated && !canManage && !store.verified_at;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 pt-8">
      <StoreHeader store={store} />

      {canManage && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <IconShieldCheck className="size-4 text-primary" />
            <span className="text-foreground">
              Administras esta tienda como <span className="font-medium">{viewerRole}</span>.
            </span>
          </div>
          <Link
            to={`/tiendas/${store.slug}/admin`}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 font-medium text-primary-foreground text-sm transition-all hover:opacity-90"
          >
            Panel de administración
          </Link>
        </div>
      )}

      {showClaimCta && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/30 px-4 py-3">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <IconLockOpen2 className="size-4" />
            <span>¿Eres dueño de esta tienda? Verifica tu dominio para gestionarla.</span>
          </div>
          <Link
            to="/reclamar"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-secondary/70 px-3 font-medium text-secondary-foreground/80 text-sm transition-all hover:bg-primary hover:text-primary-foreground"
          >
            Reclamar tienda
          </Link>
        </div>
      )}

      <StoreReviewsSection storeSlug={store.slug} canManage={canManage} />
    </main>
  );
}
