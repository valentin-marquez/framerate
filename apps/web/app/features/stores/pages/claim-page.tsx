import { IconChevronRight } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { redirect, useRevalidator } from "react-router";
import { toast } from "sonner";
import { requireAuth } from "~/features/auth/services/auth.server";
import { Button } from "~/shared/components/primitives/button";
import { ApiError } from "~/shared/lib/api";
import { ClaimWizard } from "../components/claim-wizard";
import { type ClaimRequest, claimsService } from "../services/claims";
import { type ClaimableStore, storesService } from "../services/stores";
import type { Route } from "./+types/claim-page";

export function meta() {
  return [{ title: "Reclamar tienda · Framerate" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = await requireAuth(request);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw redirect("/");

  // Deep-link: /reclamar?store=<slug> preselecciona la tienda en el wizard.
  // Si el slug no existe o la tienda ya tiene dueño, caemos al picker normal
  // con un toast informativo (manejado en cliente vía `preselectError`).
  const url = new URL(request.url);
  const preselectSlug = url.searchParams.get("store")?.trim() || null;

  let preselectStore: ClaimableStore | null = null;
  let preselectError: "not_found" | "already_claimed" | null = null;
  if (preselectSlug) {
    try {
      const detail = await storesService.get(preselectSlug);
      if (detail.is_claimed) {
        preselectError = "already_claimed";
      } else {
        preselectStore = {
          id: detail.id,
          name: detail.name,
          slug: detail.slug,
          icon_url: detail.icon_url,
          // El wizard usa `res.domain` de la respuesta del API al crear el
          // claim — no requerimos el dominio en este lado.
          domain: detail.website ?? detail.url ?? null,
          is_claimed: detail.is_claimed,
        };
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        preselectError = "not_found";
      } else {
        throw err;
      }
    }
  }

  const { claims } = await claimsService.listMine(session.access_token);
  return { claims, token: session.access_token, preselectStore, preselectError };
}

const STATUS_LABEL: Record<ClaimRequest["status"], string> = {
  pending: "Pendiente",
  verified: "Verificado",
  failed: "Falló",
  expired: "Expirado",
  revoked: "Revocado",
  stale: "Sin revalidar",
};

function isResumable(status: ClaimRequest["status"]) {
  return status === "pending" || status === "verified";
}

export default function ClaimPage({ loaderData }: Route.ComponentProps) {
  const { claims, token, preselectStore, preselectError } = loaderData;
  const { revalidate } = useRevalidator();
  // Si el usuario YA tiene un claim activo (pending/verified) para esta tienda,
  // saltamos directamente al modo "resume" en lugar de crear uno nuevo. Esto
  // también nos protege del 409 que devolvería POST /v1/claims.
  const existingForPreselect = preselectStore
    ? (claims.find(
        (c: ClaimRequest) => c.store_id === preselectStore.id && (c.status === "pending" || c.status === "verified"),
      ) ?? null)
    : null;

  const [resume, setResume] = useState<ClaimRequest | null>(existingForPreselect);
  const [wizardKey, setWizardKey] = useState(0);
  const initialStore = existingForPreselect ? null : preselectStore;

  // Feedback inicial vía toast cuando el deep-link no resolvió bien la tienda.
  // El loader devuelve el mismo valor mientras no se renavegue al endpoint
  // con otro query, así que el efecto efectivamente corre una sola vez por
  // valor de `preselectError`.
  useEffect(() => {
    if (preselectError === "not_found") {
      toast.error("No encontramos esa tienda en el catálogo");
    } else if (preselectError === "already_claimed") {
      toast.message("Esa tienda ya fue reclamada por otra cuenta.");
    }
  }, [preselectError]);

  function reset() {
    // No remontamos el wizard (sin bump de wizardKey): el propio wizard hace
    // la transición interna a "pick" y anima el alto de la caja. Sólo
    // limpiamos el resume y revalidamos la lista de reclamos.
    setResume(null);
    revalidate();
  }

  function continueClaim(c: ClaimRequest) {
    setResume(c);
    setWizardKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 pt-8">
      <header>
        <h1 className="font-semibold text-2xl tracking-tight">Reclamá tu tienda</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Elegí tu tienda del catálogo y verificá que el dominio es tuyo. Una vez verificado, vas a poder gestionar su
          perfil, responder reseñas y más.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <ClaimWizard
          key={wizardKey}
          token={token}
          initialClaim={resume ?? undefined}
          initialStore={initialStore ?? undefined}
          onDone={revalidate}
          onCancel={reset}
        />
      </section>

      {claims.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium text-sm">Tus reclamos</h2>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border">
            {claims.map((c: ClaimRequest) => {
              const resumable = isResumable(c.status);
              return (
                <li key={c.id} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-sm">{c.claimed_domain}</div>
                    <div className="text-muted-foreground text-xs">
                      Creado{" "}
                      {
                        // react-doctor-disable-next-line rendering-hydration-mismatch-time -- timezone-stabilized output (es-CL, America/Santiago)
                        new Date(c.created_at).toLocaleDateString("es-CL", { timeZone: "America/Santiago" })
                      }{" "}
                      · expira{" "}
                      {
                        // react-doctor-disable-next-line rendering-hydration-mismatch-time -- timezone-stabilized output (es-CL, America/Santiago)
                        new Date(c.expires_at).toLocaleDateString("es-CL", { timeZone: "America/Santiago" })
                      }
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                  {resumable && (
                    <Button variant="secondary" size="sm" onClick={() => continueClaim(c)}>
                      Continuar
                      <IconChevronRight className="size-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: ClaimRequest["status"] }) {
  const tone =
    status === "verified"
      ? "bg-primary/10 text-primary"
      : status === "pending"
        ? "bg-secondary/60 text-secondary-foreground/80"
        : "bg-secondary/40 text-muted-foreground";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${tone}`}>{STATUS_LABEL[status]}</span>;
}
