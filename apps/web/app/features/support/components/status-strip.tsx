import type { HealthIncident } from "@framerate/contracts";
import { IconAlertTriangle, IconArrowRight, IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { Link } from "react-router";
import { cn } from "~/shared/lib/utils";

/** Las incidencias de /admin/estado en una línea: quien atiende sabe si lo que le reportan ya es conocido. */
export function StatusStrip({ incidents }: { incidents: HealthIncident[] }) {
  if (incidents.length === 0) {
    return (
      <Link
        to="/admin/estado"
        className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm"
      >
        <IconCircleCheck className="size-4 text-success" aria-hidden />
        <span className="font-medium">Todos los sistemas en orden</span>
        <IconArrowRight className="ml-auto size-4 text-muted-foreground" aria-hidden />
      </Link>
    );
  }
  const errors = incidents.filter((i) => i.severity === "error");
  // Primero lo roto; lo atrasado sólo se nombra si no hay nada roto.
  const named = (errors.length > 0 ? errors : incidents).slice(0, 2);
  return (
    <Link
      to="/admin/estado"
      className={cn(
        "flex flex-col gap-2 rounded-2xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-4",
        errors.length > 0 ? "border-destructive/30 bg-destructive/5" : "border-warn/40 bg-warn/10",
      )}
    >
      <span className="flex shrink-0 items-center gap-2 font-medium">
        {errors.length > 0 ? (
          <IconCircleX className="size-4 text-destructive" aria-hidden />
        ) : (
          <IconAlertTriangle className="size-4 text-warn" aria-hidden />
        )}
        {incidents.length} {incidents.length === 1 ? "incidencia abierta" : "incidencias abiertas"}
      </span>
      <span className="min-w-0 flex-1 truncate text-muted-foreground">
        {named.map((i) => i.title).join(", ")}
        {incidents.length > named.length && ` y ${incidents.length - named.length} más`}
      </span>
      <span className="flex shrink-0 items-center gap-1 font-medium">
        Ver estado
        <IconArrowRight className="size-4" aria-hidden />
      </span>
    </Link>
  );
}
