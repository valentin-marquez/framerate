import { IconShieldCheck, IconSparkles } from "@tabler/icons-react";
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
  const { store, viewerRole } = loaderData;
  const canManage = viewerRole !== null;
  // Banner público de "reclamala" mientras la tienda no tenga dueño. Se muestra
  // a todos (incluidos anónimos) — la página /reclamar se encarga de pedir login
  // si hace falta. Si `is_claimed=true`, no aparece porque ya hay account dueña.
  const showClaimCta = !store.is_claimed;
  // Cuando llegan vía deep-link autenticados, /reclamar arranca el wizard en el
  // paso DNS con la tienda preseleccionada.
  const claimHref = `/reclamar?store=${store.slug}`;

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

      {showClaimCta && !canManage && (
        <section
          aria-label="Reclamar tienda"
          className="flex flex-col gap-4 rounded-2xl border border-border/40 bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <IconSparkles className="size-5" />
            </span>
            <div className="space-y-1">
              <h2 className="font-semibold text-base text-foreground">¿Esta tienda es tuya?</h2>
              <p className="max-w-xl text-muted-foreground text-sm">
                Verificá la propiedad por DNS y vas a poder editar su perfil, responder reseñas y más.
              </p>
            </div>
          </div>
          <Link
            to={claimHref}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 self-start rounded-xl bg-secondary px-4 font-medium text-secondary-foreground text-sm transition-all hover:bg-primary hover:text-primary-foreground sm:self-auto"
          >
            Reclamar tienda
          </Link>
        </section>
      )}

      <StoreReviewsSection storeSlug={store.slug} canManage={canManage} />
    </main>
  );
}
