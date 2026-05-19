import { IconChevronRight } from "@tabler/icons-react";
import { useState } from "react";
import { redirect, useRevalidator } from "react-router";
import { requireAuth } from "~/features/auth/services/auth.server";
import { Button } from "~/shared/components/primitives/button";
import { ClaimWizard } from "../components/claim-wizard";
import { type ClaimRequest, claimsService } from "../services/claims";
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

  const { claims } = await claimsService.listMine(session.access_token);
  return { claims, token: session.access_token };
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
  const { claims, token } = loaderData;
  const { revalidate } = useRevalidator();
  const [resume, setResume] = useState<ClaimRequest | null>(null);
  const [wizardKey, setWizardKey] = useState(0);

  function reset() {
    setResume(null);
    setWizardKey((k) => k + 1);
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
