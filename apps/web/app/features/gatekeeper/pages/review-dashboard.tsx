import type { MatchReviewItem, MatchReviewsResponse } from "@framerate/contracts";
import { data, Link, useFetcher, useSearchParams } from "react-router";
import { requireRole } from "~/features/auth/services/auth.server";
import { Button } from "~/shared/components/primitives/button";
import { ApiError, api } from "~/shared/lib/api";
import { cn } from "~/shared/lib/utils";
import {
  describeListing,
  EvidenceChips,
  ProbabilityMeter,
  type ReviewEvidence,
  Side,
  VERDICT_LABELS,
  type Verdict,
  verdictOf,
} from "../components/review-parts";
import type { Route } from "./+types/review-dashboard";

const PAGE_SIZE = 100;
const ORDER: Verdict[] = ["accept", "guard", "pending", "reject", "none"];

export function meta(_: Route.MetaArgs) {
  return [{ title: "Gatekeeper - Framerate Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "moderator");
  try {
    const { items } = await api.get<MatchReviewsResponse>("/v1/admin/reviews", {
      params: { limit: String(PAGE_SIZE) },
    });
    return { items, truncated: items.length >= PAGE_SIZE };
  } catch (error) {
    console.error("Error fetching review queue:", error);
    return { items: [] as MatchReviewItem[], truncated: false };
  }
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, "moderator");
  const formData = await request.formData();
  const reviewId = Number(formData.get("reviewId"));
  const decision = formData.get("intent") === "reject" ? "reject" : "accept";
  if (!Number.isInteger(reviewId) || reviewId <= 0) return data({ success: false, error: "Falta el id" });
  try {
    await api.post(`/v1/admin/reviews/${reviewId}/${decision}`, {});
    return data({ success: true });
  } catch (error) {
    return data({ success: false, error: error instanceof ApiError ? error.message : "Error" });
  }
}

/** Una revisión: los dos lados, qué dijo el modelo y los dos botones. */
function ReviewCard({ item }: { item: MatchReviewItem }) {
  const fetcher = useFetcher();
  const evidence = item.evidence as ReviewEvidence;
  const busy = fetcher.state !== "idle";

  return (
    <li
      className={cn(
        "rounded-2xl border border-border/60 bg-card p-4 transition-opacity",
        busy && "pointer-events-none opacity-50",
      )}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-start">
        <Side
          label="Oferta"
          title={item.listing.title}
          subtitle={describeListing(item)}
          imageUrl={item.listing.imageUrl}
          href={item.listing.url}
        />
        <Side
          label="Producto candidato"
          title={item.candidate.name}
          subtitle={[item.candidate.brand, item.candidate.category].filter(Boolean).join("   ")}
          imageUrl={item.candidate.imageUrl}
          href={`/producto/${item.candidate.slug}`}
        />
        <div className="w-full space-y-3 lg:w-56">
          <ProbabilityMeter evidence={evidence} />
          <div className="flex gap-2">
            {(["reject", "accept"] as const).map((intent) => (
              <fetcher.Form key={intent} method="post" className="flex-1">
                <input type="hidden" name="reviewId" value={item.id} />
                <Button
                  name="intent"
                  value={intent}
                  type="submit"
                  size="sm"
                  variant={intent === "accept" ? "default" : "secondary"}
                  disabled={busy}
                  className="w-full"
                >
                  {intent === "accept" ? "El mismo" : "Distintos"}
                </Button>
              </fetcher.Form>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 border-border/50 border-t pt-3">
        <EvidenceChips evidence={evidence} score={item.score} />
      </div>
    </li>
  );
}

export default function ReviewDashboard({ loaderData }: Route.ComponentProps) {
  const { items, truncated } = loaderData;
  const [params] = useSearchParams();
  const active = ORDER.find((v) => v === params.get("veredicto"));

  const counts = new Map<Verdict, number>();
  for (const item of items) {
    const v = verdictOf(item.evidence as ReviewEvidence);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const shown = active ? items.filter((i) => verdictOf(i.evidence as ReviewEvidence) === active) : items;

  const chipUrl = (verdict: Verdict | null) => {
    const next = new URLSearchParams(params);
    if (verdict) next.set("veredicto", verdict);
    else next.delete("veredicto");
    const query = next.toString();
    return query ? `?${query}` : ".";
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8">
      <header className="space-y-1">
        <h1 className="font-semibold text-3xl tracking-tight md:text-4xl">Gatekeeper</h1>
        <p className="text-muted-foreground text-sm">
          {items.length === 0
            ? "Nada pendiente."
            : `${truncated ? `${PAGE_SIZE}+` : items.length} ${items.length === 1 ? "revisión pendiente" : "revisiones pendientes"}. El modelo ya decidió las claras; acá quedan las que necesitan ojo.`}
        </p>
      </header>

      {items.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Chip to={chipUrl(null)} active={!active}>
            Todas {items.length}
          </Chip>
          {ORDER.filter((v) => counts.get(v)).map((v) => (
            <Chip key={v} to={chipUrl(v)} active={active === v}>
              {VERDICT_LABELS[v]} {counts.get(v)}
            </Chip>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="rounded-2xl bg-secondary/40 px-4 py-12 text-center text-muted-foreground text-sm">
          {items.length === 0 ? "Todo al día: no hay revisiones pendientes." : "Ninguna revisión con ese filtro."}
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((item) => (
            <ReviewCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      preventScrollReset
      replace
      aria-current={active ? "true" : undefined}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 font-medium text-sm transition-colors",
        active ? "bg-foreground text-background" : "bg-secondary/60 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
