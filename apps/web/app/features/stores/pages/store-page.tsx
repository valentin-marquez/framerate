import { Link } from "react-router";
import { ApiError } from "~/shared/lib/api";
import { StoreHeader } from "../components/store-header";
import { storesService } from "../services/stores";
import type { Route } from "./+types/store-page";

export function meta({ data }: Route.MetaArgs) {
  if (!data?.store) return [{ title: "Tienda no encontrada · Framerate" }];
  return [
    { title: `${data.store.name} · Framerate` },
    { name: "description", content: data.store.description ?? `Tienda ${data.store.name} en Framerate.cl` },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  try {
    const store = await storesService.get(params.slug);
    return { store };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw new Response("Not found", { status: 404 });
    }
    throw err;
  }
}

export default function StorePage({ loaderData }: Route.ComponentProps) {
  const { store } = loaderData;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 pt-8">
      <StoreHeader store={store} />

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-muted-foreground text-xs uppercase">Sitio</div>
          <div className="mt-1 truncate text-sm">{store.website ? new URL(store.website).hostname : "—"}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-muted-foreground text-xs uppercase">Miembros</div>
          <div className="mt-1 text-sm">{store.member_count}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-muted-foreground text-xs uppercase">Rating</div>
          <div className="mt-1 text-sm">
            {store.rating.average !== null
              ? `${store.rating.average.toFixed(1)} ★ (${store.rating.count})`
              : "Sin reviews"}
          </div>
        </div>
      </section>

      {/* Fase 2 integrará top productos y reviews aquí */}
      <section className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
        Top productos y reviews de la tienda — próximamente
      </section>

      <div className="flex justify-end">
        <Link
          to={`/stores/${store.slug}/admin`}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-secondary/70 px-3 text-secondary-foreground/80 text-sm font-medium transition-all hover:bg-primary hover:text-primary-foreground"
        >
          Panel de admin
        </Link>
      </div>
    </main>
  );
}
