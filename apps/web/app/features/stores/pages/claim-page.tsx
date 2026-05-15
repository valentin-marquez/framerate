import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { redirect } from "react-router";
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

export default function ClaimPage({ loaderData }: Route.ComponentProps) {
  const { claims, token } = loaderData;
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 pt-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-2xl">Reclamar tienda</h1>
          <p className="text-muted-foreground text-sm">Verificá la propiedad de un dominio para gestionar su tienda.</p>
        </div>
        <Button onClick={() => setWizardOpen((v) => !v)}>
          <IconPlus className="size-4" />
          {wizardOpen ? "Cerrar" : "Nuevo reclamo"}
        </Button>
      </header>

      {wizardOpen && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <ClaimWizard token={token} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-medium">Mis reclamos</h2>
        {claims.length === 0 ? (
          <p className="text-muted-foreground text-sm">Todavía no creaste ningún reclamo.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {claims.map((c: ClaimRequest) => (
              <li key={c.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium">{c.claimed_domain}</div>
                  <div className="text-muted-foreground text-xs">
                    {c.status} · creado {new Date(c.created_at).toLocaleDateString()} · expira{" "}
                    {new Date(c.expires_at).toLocaleDateString()}
                  </div>
                </div>
                <code className="rounded bg-secondary/50 px-2 py-1 text-xs">{c.status}</code>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
