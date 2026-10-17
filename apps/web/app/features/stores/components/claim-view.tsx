import { IconChevronRight } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { buttonVariants } from "~/shared/components/primitives/button";
import { StoreLogo } from "~/shared/components/store-logo";
import { cn } from "~/shared/lib/utils";
import type { ClaimRequest } from "../services/claims";

const STATUS: Record<ClaimRequest["status"], { label: string; tone: string }> = {
  pending: { label: "Esperando el DNS", tone: "bg-warn/15 text-foreground" },
  verified: { label: "Dominio verificado", tone: "bg-success/15 text-success" },
  confirmed: { label: "Tienda tuya", tone: "bg-success/15 text-success" },
  expired: { label: "Venció", tone: "bg-secondary text-muted-foreground" },
  revoked: { label: "Revocado", tone: "bg-secondary text-muted-foreground" },
  stale: { label: "Sin revalidar", tone: "bg-secondary text-muted-foreground" },
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", timeZone: "America/Santiago" });

const STEPS = [
  ["Elige tu tienda", "Búscala en el catálogo. Si no está, escríbenos a soporte."],
  ["Agrega un registro TXT", "Te decimos qué copiar en el DNS de tu dominio. No toca tu sitio ni tu correo."],
  ["Listo", "Al encontrarlo, la tienda pasa a tu cuenta: editas su perfil y respondes reseñas."],
];

/**
 * /reclamar (la ruta se mantiene): el asistente va en la columna principal y al lado se explica en tres pasos qué va
 * a pasar. Las verificaciones anteriores quedan abajo, como filas.
 */
export function ClaimView({
  claims,
  wizard,
  onContinue,
}: {
  claims: ClaimRequest[];
  /** El asistente, con su estado (reanudar, tienda preseleccionada). */
  wizard: ReactNode;
  onContinue: (claim: ClaimRequest) => void;
}) {
  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-8">
      <header className="max-w-2xl space-y-2">
        <h1 className="text-title-h4 text-foreground">Verifica tu tienda</h1>
        <p className="text-muted-foreground">
          Verifica que el dominio es tuyo y administra el perfil de tu tienda en Framerate.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <section className="min-w-0 rounded-3xl border border-border bg-card p-5 sm:p-6">{wizard}</section>

        <aside className="space-y-4">
          <h2 className="font-medium text-foreground text-sm">Cómo funciona</h2>
          <ol className="space-y-4">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary font-medium text-foreground text-xs tabular-nums">
                  {i + 1}
                </span>
                <span className="space-y-0.5">
                  <span className="block font-medium text-foreground text-sm">{title}</span>
                  <span className="block text-muted-foreground text-sm">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {claims.length > 0 && (
        <section className="space-y-4 border-border border-t pt-8">
          <div className="space-y-1">
            <h2 className="text-foreground text-title-h6">Tus verificaciones</h2>
            <p className="text-muted-foreground text-sm">
              Una verificación pendiente vence a los 7 días si no encontramos el registro.
            </p>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
            {claims.map((c) => {
              const open = c.status === "pending" || c.status === "verified";
              const status = STATUS[c.status];
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
                  <StoreLogo store={{ name: c.store_name, slug: c.store_id }} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{c.store_name}</span>
                      <span className={cn("rounded-md px-1.5 py-0.5 font-medium text-[11px]", status.tone)}>
                        {status.label}
                      </span>
                    </p>
                    <p className="flex flex-wrap gap-x-3 text-muted-foreground text-xs">
                      <span>{c.claimed_domain}</span>
                      <span>Creado el {day(c.created_at)}</span>
                      {open && <span>Vence el {day(c.expires_at)}</span>}
                    </p>
                  </div>
                  {open && (
                    <button
                      type="button"
                      onClick={() => onContinue(c)}
                      className={buttonVariants({ variant: "secondary", size: "sm" })}
                    >
                      Continuar
                      <IconChevronRight className="size-4" />
                    </button>
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
