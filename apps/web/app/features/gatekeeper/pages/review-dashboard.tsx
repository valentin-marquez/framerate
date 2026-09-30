import type { MatchReviewsResponse } from "@framerate/contracts";
import { data, useFetcher } from "react-router";
import { requireRole } from "~/features/auth/services/auth.server";
import { ApiError, api } from "~/shared/lib/api";
import type { Route } from "./+types/review-dashboard";

const PAGE_SIZE = 50;

export function meta(_: Route.MetaArgs) {
  return [{ title: "Gatekeeper | Framerate Admin" }, { name: "description", content: "Revisión de matches dudosos" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "moderator");

  try {
    const { items } = await api.get<MatchReviewsResponse>("/v1/admin/reviews", {
      params: { limit: String(PAGE_SIZE) },
    });
    return {
      queueDepth: items.length >= PAGE_SIZE ? `${PAGE_SIZE}+` : String(items.length),
      currentItem: items[0] ?? null,
    };
  } catch (error) {
    console.error("Error fetching review queue:", error);
    return { queueDepth: "?", currentItem: null };
  }
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, "moderator");

  const formData = await request.formData();
  const reviewId = Number(formData.get("reviewId"));
  const decision = formData.get("intent") === "reject" ? "reject" : "accept";
  if (!Number.isInteger(reviewId) || reviewId <= 0) return data({ success: false, error: "Missing ID" });

  try {
    await api.post(`/v1/admin/reviews/${reviewId}/${decision}`, {});
    return data({ success: true });
  } catch (error) {
    return data({ success: false, error: error instanceof ApiError ? error.message : "Error" });
  }
}

const money = (value: number) => `$${value.toLocaleString("es-CL")}`;

export default function ReviewDashboard({ loaderData }: Route.ComponentProps) {
  const { queueDepth, currentItem } = loaderData;
  const fetcher = useFetcher();

  if (!currentItem) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
        <h1 className="text-3xl font-semibold text-foreground mb-4">Todo al día 🎉</h1>
        <p className="text-muted-foreground">No hay matches pendientes de revisión.</p>
      </div>
    );
  }

  const { listing, candidate } = currentItem;

  return (
    <div className="min-h-screen bg-background p-8 pb-28">
      <header className="mb-8 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-foreground">Gatekeeper</h1>
        <div className="bg-card px-4 py-2 rounded-lg shadow-sm">
          <span className="text-muted-foreground text-sm">Pendientes:</span>
          <span className="ml-2 font-mono font-semibold text-primary">{queueDepth}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
        <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Oferta entrante</h2>
          <div className="space-y-4">
            <div>
              <span className="text-xs text-muted-foreground">Título en la tienda</span>
              <p className="text-lg font-medium text-foreground">{listing.title}</p>
            </div>
            <div className="flex gap-6">
              <div>
                <span className="text-xs text-muted-foreground">Tienda</span>
                <p className="font-mono text-sm">{listing.store.name}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Precio</span>
                <p className="font-mono text-sm">{money(listing.priceCash)}</p>
              </div>
              {listing.mpn ? (
                <div>
                  <span className="text-xs text-muted-foreground">MPN</span>
                  <p className="font-mono text-sm">{listing.mpn}</p>
                </div>
              ) : null}
            </div>
            <a
              href={listing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary underline underline-offset-2"
            >
              Ver en la tienda
            </a>
            <div className="p-4 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm rounded-md border border-amber-500/20">
              ⚠ Coincidencia dudosa (similitud: {currentItem.score})
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl shadow-sm border border-border ring-2 ring-primary/10">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wide mb-4">Producto sugerido</h2>
          <div className="space-y-4">
            <div>
              <span className="text-xs text-muted-foreground">Nombre</span>
              <p className="text-lg font-medium text-foreground">{candidate.name}</p>
            </div>
            <div className="flex gap-6">
              <div>
                <span className="text-xs text-muted-foreground">Marca</span>
                <p className="text-sm">{candidate.brand ?? "—"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Categoría</span>
                <p className="text-sm">{candidate.category}</p>
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Evidencia</span>
              <pre className="text-xs bg-secondary p-2 rounded border border-border mt-1 overflow-x-auto">
                {JSON.stringify(currentItem.evidence, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 flex justify-center gap-4 shadow-lg">
        {(["reject", "accept"] as const).map((intent) => (
          <fetcher.Form key={intent} method="post">
            <input type="hidden" name="reviewId" value={currentItem.id} />
            <button
              name="intent"
              value={intent}
              type="submit"
              disabled={fetcher.state !== "idle"}
              className={
                intent === "accept"
                  ? "px-8 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 shadow-md transition-colors"
                  : "px-8 py-3 bg-destructive/10 text-destructive font-medium rounded-lg hover:bg-destructive/15 transition-colors"
              }
            >
              {fetcher.state !== "idle"
                ? "Procesando..."
                : intent === "accept"
                  ? "Es el mismo producto"
                  : "Son productos distintos"}
            </button>
          </fetcher.Form>
        ))}
      </div>
    </div>
  );
}
