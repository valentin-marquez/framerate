import {
  type HealthIncident,
  type HealthSystem,
  type HealthSystemStatus,
  NORM_STATUSES,
  type NormStatus,
  type PipelineHealth,
} from "@framerate/contracts";
import {
  IconAlertTriangle,
  IconBan,
  IconBuildingStore,
  IconCircleX,
  IconFlag,
  IconGitMerge,
  IconLifebuoy,
  IconSparkles,
  IconWorldSearch,
} from "@tabler/icons-react";
import { Link } from "react-router";
import { cn } from "~/shared/lib/utils";
import { formatDateTime } from "~/shared/utils/format";
import { formatDuration, timeAgo } from "../utils/time";

export const SYSTEM_LABELS: Record<HealthSystem, string> = {
  scraping: "Scraping",
  quarantine: "Cuarentena",
  pipeline: "Pipeline",
  matching: "Matching",
  support: "Soporte",
  moderation: "Moderación",
  stores: "Tiendas",
};

const SYSTEM_CAPTIONS: Record<HealthSystem, string> = {
  scraping: "tiendas y categorías seguidas",
  quarantine: "ofertas en 24 h",
  pipeline: "ofertas normalizándose",
  matching: "revisiones pendientes",
  support: "tickets abiertos",
  moderation: "reportes abiertos",
  stores: "congeladas o con reclamo caído",
};

const SYSTEM_ICONS: Record<HealthSystem, typeof IconWorldSearch> = {
  scraping: IconWorldSearch,
  quarantine: IconBan,
  pipeline: IconSparkles,
  matching: IconGitMerge,
  support: IconLifebuoy,
  moderation: IconFlag,
  stores: IconBuildingStore,
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
  const Icon = SYSTEM_ICONS[system.id];
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
        <span className="flex min-w-0 items-center gap-2">
          <Icon size={16} className="shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate text-sm font-medium">{SYSTEM_LABELS[system.id]}</span>
        </span>
        <span className={cn("size-2 shrink-0 rounded-full", DOT[tone])} aria-hidden />
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

const STATUS_LABELS: Record<NormStatus, string> = {
  legacy: "Sin normalizar",
  pending: "En cola",
  normalized: "Con identidad",
  linked: "Vinculadas",
  fallback: "Por regex",
  failed: "Fallidas",
};

const PURPOSE_LABELS: Record<PipelineHealth["aiUsage"][number]["purpose"], string> = {
  normalize: "Normalización",
  judge: "Juez",
  extract: "Modelos",
};

const count = (n: number) => n.toLocaleString("es-CL");
const usd = (n: number) => `US$ ${n >= 1 || n === 0 ? n.toFixed(2) : n.toFixed(4)}`;

function PipelineBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}

/** El pipeline de normalización por dentro: ofertas por etapa, lo que falta publicar y cuánto costó la IA. */
export function PipelinePanel({ pipeline, now }: { pipeline: PipelineHealth; now: string }) {
  const todayUsd = pipeline.aiUsage.reduce((sum, u) => sum + u.todayUsd, 0);
  const cycleUsd = pipeline.aiUsage.reduce((sum, u) => sum + u.cycleUsd, 0);
  const paused = pipeline.pausedUntil !== null && Date.parse(pipeline.pausedUntil) > Date.parse(now);
  return (
    <section aria-label="Pipeline de normalización" className="grid gap-3 md:grid-cols-3">
      <PipelineBox title="Ofertas por etapa">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {NORM_STATUSES.map((status) => (
            <div key={status} className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{STATUS_LABELS[status]}</dt>
              <dd
                className={cn(
                  "font-medium tabular-nums",
                  status === "failed" && pipeline.byStatus.failed > 0 && "text-destructive",
                )}
              >
                {count(pipeline.byStatus[status])}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">
          {pipeline.oldestPendingAt ? `En cola ${timeAgo(pipeline.oldestPendingAt, now)}` : "Nada esperando en la cola"}
        </p>
      </PipelineBox>

      <PipelineBox title="Sin publicar">
        <div>
          <p className="text-3xl font-semibold tabular-nums tracking-tight">{count(pipeline.hidden)}</p>
          <p className="text-xs text-muted-foreground">
            {pipeline.oldestHiddenAt
              ? `ofertas ocultas, la más vieja ${timeAgo(pipeline.oldestHiddenAt, now)}`
              : "ofertas ocultas hasta pasar el pipeline"}
          </p>
        </div>
        <p className={cn("text-sm", paused ? "font-medium text-destructive" : "text-muted-foreground")}>
          {paused && pipeline.pausedUntil
            ? `En pausa hasta ${formatDateTime(pipeline.pausedUntil)}: sin crédito de Anthropic`
            : "Sin pausa global"}
        </p>
      </PipelineBox>

      <PipelineBox title="Gasto de IA">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="text-left font-normal">
                Propósito
              </th>
              <th scope="col" className="text-right font-normal">
                Hoy
              </th>
              <th scope="col" className="text-right font-normal">
                Ciclo
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {pipeline.aiUsage.map((u) => (
              <tr key={u.purpose}>
                <td className="text-muted-foreground">{PURPOSE_LABELS[u.purpose]}</td>
                <td className="text-right">{usd(u.todayUsd)}</td>
                <td className="text-right">{usd(u.cycleUsd)}</td>
              </tr>
            ))}
            <tr className="font-medium">
              <td>Total</td>
              <td className="text-right">{usd(todayUsd)}</td>
              <td className="text-right">{usd(cycleUsd)}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground">
          {pipeline.dailyCapUsd === null
            ? `Ciclo desde ${formatDateTime(pipeline.cycleStart)}`
            : `Tope de hoy ${usd(pipeline.dailyCapUsd)}, ciclo desde ${formatDateTime(pipeline.cycleStart)}`}
        </p>
      </PipelineBox>
    </section>
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
