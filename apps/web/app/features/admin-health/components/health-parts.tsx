import type { HealthIncident, HealthSystem, HealthSystemStatus } from "@framerate/contracts";
import { IconAlertTriangle, IconCircleX } from "@tabler/icons-react";
import { Link } from "react-router";
import { cn } from "~/shared/lib/utils";
import { formatDuration, timeAgo } from "../utils/time";

export const SYSTEM_LABELS: Record<HealthSystem, string> = {
  scraping: "Scraping",
  quarantine: "Cuarentena",
  matching: "Matching",
  support: "Soporte",
  moderation: "Moderación",
  stores: "Tiendas",
};

const SYSTEM_CAPTIONS: Record<HealthSystem, string> = {
  scraping: "tiendas y categorías seguidas",
  quarantine: "ofertas en 24 h",
  matching: "revisiones pendientes",
  support: "tickets abiertos",
  moderation: "reportes abiertos",
  stores: "congeladas o con reclamo caído",
};

export type Tone = "ok" | "warning" | "error";

const DOT: Record<Tone, string> = { ok: "bg-success", warning: "bg-warn", error: "bg-destructive" };

/** Las últimas corridas de scraping, de la más antigua a la más nueva: un segmento por corrida. */
function RunHistoryBar({ history }: { history: NonNullable<HealthSystemStatus["history"]> }) {
  return (
    <div className="flex h-5 items-end gap-px" role="img" aria-label={`Últimas ${history.length} corridas`}>
      {history.map((status, index) => (
        <span
          // El orden es el dato y no cambia: la posición es una clave estable.
          // biome-ignore lint/suspicious/noArrayIndexKey: ver arriba
          key={index}
          className={cn(
            "h-full flex-1 rounded-[2px]",
            status === "succeeded" && "bg-success/60",
            status === "failed" && "bg-destructive",
            status === "running" && "bg-warn",
          )}
        />
      ))}
    </div>
  );
}

interface SystemCardProps {
  system: HealthSystemStatus;
  tone: Tone;
  selected: boolean;
  to: string;
}

/** Una tarjeta por sistema: su cifra y si necesita atención. Al pulsarla filtra las incidencias de ese sistema. */
export function SystemCard({ system, tone, selected, to }: SystemCardProps) {
  return (
    <Link
      to={to}
      preventScrollReset
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-secondary/40",
        selected ? "border-foreground/40" : "border-border/60",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{SYSTEM_LABELS[system.id]}</span>
        <span className={cn("size-2 rounded-full", DOT[tone])} aria-hidden />
      </div>
      <div>
        <p className="text-3xl font-semibold tabular-nums tracking-tight">{system.value}</p>
        <p className="text-xs text-muted-foreground">{SYSTEM_CAPTIONS[system.id]}</p>
      </div>
      {system.history && system.history.length > 0 ? (
        <RunHistoryBar history={system.history} />
      ) : (
        <p className={cn("text-xs", system.attention > 0 ? "font-medium text-foreground" : "text-muted-foreground")}>
          {system.attention === 0
            ? "Sin pendientes"
            : `${system.attention} ${system.attention === 1 ? "necesita atención" : "necesitan atención"}`}
        </p>
      )}
    </Link>
  );
}

/** Una incidencia: ícono de gravedad, qué es, de qué sistema y desde cuándo. Lleva a donde se resuelve. */
export function IncidentRow({ incident, now }: { incident: HealthIncident; now: string }) {
  const Icon = incident.severity === "error" ? IconCircleX : IconAlertTriangle;
  return (
    <li>
      <Link
        to={incident.href}
        prefetch="intent"
        className="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-4 py-3 transition-colors hover:bg-secondary/40"
      >
        <Icon
          size={20}
          className={cn("mt-0.5", incident.severity === "error" ? "text-destructive" : "text-warn")}
          aria-label={incident.severity === "error" ? "Error" : "Advertencia"}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{incident.title}</p>
          {incident.detail && <p className="truncate text-sm text-muted-foreground">{incident.detail}</p>}
          <p className="mt-1 text-xs text-muted-foreground">{SYSTEM_LABELS[incident.system]}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground tabular-nums">
          <p>{timeAgo(incident.at, now)}</p>
          {incident.durationMs !== null && <p>{formatDuration(incident.durationMs)}</p>}
        </div>
      </Link>
    </li>
  );
}
