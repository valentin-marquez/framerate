import { HEALTH_SYSTEMS, type Health, type HealthSystem } from "@framerate/contracts";
import { IconCircleCheck, IconLoader2, IconRefresh } from "@tabler/icons-react";
import { Link, useRevalidator, useSearchParams } from "react-router";
import { requireRole } from "~/features/auth/services/auth.server";
import { Button } from "~/shared/components/primitives/button";
import { api } from "~/shared/lib/api";
import { cn } from "~/shared/lib/utils";
import { formatDateTime } from "~/shared/utils/format";
import { IncidentRow, SYSTEM_LABELS, SystemCard, type Tone } from "../components/health-parts";
import type { Route } from "./+types/health-page";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Estado de los sistemas - Framerate" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "moderator");
  return { health: await api.get<Health>("/v1/admin/health") };
}

/** Un filtro vive en la URL (`?sistema=scraping&gravedad=error`) para poder compartir y volver atrás. */
function filterUrl(params: URLSearchParams, change: Record<string, string | null>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(change)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  const query = next.toString();
  return query ? `?${query}` : ".";
}

function Chip({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      preventScrollReset
      replace
      aria-current={active ? "true" : undefined}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-foreground text-background" : "bg-secondary/60 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

export default function HealthPage({ loaderData }: Route.ComponentProps) {
  const { health } = loaderData;
  const [params] = useSearchParams();
  const revalidator = useRevalidator();

  const system = HEALTH_SYSTEMS.find((s) => s === params.get("sistema"));
  const severity = ["error", "warning"].find((s) => s === params.get("gravedad"));
  const incidents = health.incidents.filter(
    (i) => (!system || i.system === system) && (!severity || i.severity === severity),
  );

  const errors = health.incidents.filter((i) => i.severity === "error").length;
  const total = health.incidents.length;
  const toneOf = (id: HealthSystem): Tone => {
    const own = health.incidents.filter((i) => i.system === id);
    return own.some((i) => i.severity === "error") ? "error" : own.length > 0 ? "warning" : "ok";
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 md:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Estado de los sistemas</h1>
          <p className="text-sm text-muted-foreground">Actualizado {formatDateTime(health.generatedAt)}</p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          disabled={revalidator.state === "loading"}
          onClick={() => revalidator.revalidate()}
        >
          {revalidator.state === "loading" ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconRefresh className="size-4" />
          )}
          Actualizar
        </Button>
      </header>

      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl px-5 py-4",
          total === 0 && "bg-success/15 text-success",
          total > 0 && errors === 0 && "bg-warn/20 text-foreground",
          errors > 0 && "bg-destructive/10 text-destructive",
        )}
      >
        {total === 0 && <IconCircleCheck className="size-6 shrink-0" />}
        <div>
          <p className="font-semibold">
            {total === 0 ? "Todo en orden" : `${total} ${total === 1 ? "cosa necesita" : "cosas necesitan"} atención`}
          </p>
          {total > 0 && (
            <p className="text-sm opacity-80">
              {errors} con error, {total - errors}{" "}
              {total - errors === 1 ? "atrasada o esperando" : "atrasadas o esperando"}
            </p>
          )}
        </div>
      </div>

      <section aria-label="Sistemas" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {health.systems.map((s) => (
          <SystemCard
            key={s.id}
            system={s}
            tone={toneOf(s.id)}
            selected={system === s.id}
            to={filterUrl(params, { sistema: system === s.id ? null : s.id })}
          />
        ))}
      </section>

      <section aria-label="Incidencias" className="rounded-3xl bg-secondary/30 p-2">
        <div className="space-y-3 p-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">Incidencias</h2>
            <span className="text-sm text-muted-foreground tabular-nums">
              {incidents.length} {incidents.length === 1 ? "abierta" : "abiertas"}
            </span>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <Chip to={filterUrl(params, { sistema: null })} active={!system}>
              Todos los sistemas
            </Chip>
            {HEALTH_SYSTEMS.map((id) => (
              <Chip key={id} to={filterUrl(params, { sistema: id })} active={system === id}>
                {SYSTEM_LABELS[id]}
              </Chip>
            ))}
            <span className="mx-1 w-px shrink-0 bg-border" aria-hidden />
            <Chip to={filterUrl(params, { gravedad: null })} active={!severity}>
              Toda gravedad
            </Chip>
            <Chip to={filterUrl(params, { gravedad: "error" })} active={severity === "error"}>
              Errores
            </Chip>
            <Chip to={filterUrl(params, { gravedad: "warning" })} active={severity === "warning"}>
              Advertencias
            </Chip>
          </div>
        </div>

        {incidents.length === 0 ? (
          <p className="rounded-2xl bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            {total === 0 ? "Nada que atender por ahora." : "Ninguna incidencia con ese filtro."}
          </p>
        ) : (
          <ul className="divide-y divide-border/50 overflow-hidden rounded-2xl bg-card">
            {incidents.map((incident) => (
              <IncidentRow key={incident.id} incident={incident} now={health.generatedAt} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
