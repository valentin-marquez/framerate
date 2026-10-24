import { useEffect, useState } from "react";
import { useRevalidator } from "react-router";
import { toast } from "sonner";
import { requireAuth } from "~/features/auth/services/auth.server";
import { ApiError } from "~/shared/lib/api";
import { ClaimView } from "../components/claim-view";
import { ClaimWizard } from "../components/claim-wizard";
import { type ClaimRequest, claimsService } from "../services/claims";
import { type ClaimableStore, storesService } from "../services/stores";
import type { Route } from "./+types/claim-page";

export function meta() {
  return [{ title: "Verificar tienda - Framerate" }];
}

export async function loader({ request, url }: Route.LoaderArgs) {
  await requireAuth(request);

  // Deep-link: /reclamar?store=<slug> preselecciona la tienda en el wizard.
  // Si el slug no existe o la tienda ya tiene dueño, caemos al picker normal
  // con un toast informativo (manejado en cliente vía `preselectError`).
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

  const { claims } = await claimsService.listMine();
  return { claims, preselectStore, preselectError };
}

export default function ClaimPage({ loaderData }: Route.ComponentProps) {
  const { claims, preselectStore, preselectError } = loaderData;
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
      toast.message("Esa tienda ya la verificó otra cuenta.");
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
    <ClaimView
      claims={claims}
      onContinue={continueClaim}
      wizard={
        <ClaimWizard
          key={wizardKey}
          initialClaim={resume ?? undefined}
          initialStore={initialStore ?? undefined}
          onDone={revalidate}
          onCancel={reset}
        />
      }
    />
  );
}
