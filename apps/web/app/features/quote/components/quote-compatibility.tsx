import type { CompatCheck, QuoteCompatibility } from "@framerate/contracts";
import {
  IconAlertTriangle,
  IconChevronDown,
  IconCircleCheck,
  IconCircleX,
  IconHelpCircle,
  type IconProps,
} from "@tabler/icons-react";
import type { ComponentType } from "react";
import { cn } from "~/shared/lib/utils";

const LOOK: Record<CompatCheck["result"], { icon: ComponentType<IconProps>; tone: string }> = {
  incompatible: { icon: IconCircleX, tone: "text-destructive" },
  warning: { icon: IconAlertTriangle, tone: "text-warn" },
  unknown: { icon: IconHelpCircle, tone: "text-muted-foreground" },
  ok: { icon: IconCircleCheck, tone: "text-success" },
};
const ORDER: CompatCheck["result"][] = ["incompatible", "warning", "unknown", "ok"];

export const STATUS_DOT: Record<CompatCheck["result"], string> = {
  incompatible: "bg-destructive",
  warning: "bg-warn",
  unknown: "bg-muted-foreground/40",
  ok: "bg-success",
};

/** Lo que hay que corregir en un ítem: va en línea, bajo su nombre, como el aviso de stock. */
export const issuesOf = (compatibility: QuoteCompatibility | undefined, itemId: number) =>
  compatibility?.checks.filter(
    (c) => c.itemIds.includes(itemId) && (c.result === "incompatible" || c.result === "warning"),
  ) ?? [];

/** El peor resultado de los chequeos que involucran al ítem; `undefined` si ninguno lo revisa. */
export const statusOf = (compatibility: QuoteCompatibility | undefined, itemId: number) => {
  const mine = compatibility?.checks.filter((c) => c.itemIds.includes(itemId)).map((c) => c.result) ?? [];
  return ORDER.find((r) => mine.includes(r));
};

export function CompatibilityIssue({ check }: { check: CompatCheck }) {
  const { icon: Icon, tone } = LOOK[check.result];
  return (
    <p className={cn("text-xs font-medium flex items-start gap-1", tone)}>
      <Icon size={12} className="mt-0.5 shrink-0" />
      {check.message}
    </p>
  );
}

function summary({ status, checks }: QuoteCompatibility) {
  const count = (r: CompatCheck["result"]) => checks.filter((c) => c.result === r).length;
  const incompatible = count("incompatible");
  const warnings = count("warning");
  const parts = [
    incompatible && `${incompatible} ${incompatible === 1 ? "incompatibilidad" : "incompatibilidades"}`,
    warnings && `${warnings} ${warnings === 1 ? "advertencia" : "advertencias"}`,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(" y ");
  if (status === "valid") return "Los componentes son compatibles";
  return checks.length === 0
    ? "Agrega procesador, placa y RAM para revisar la compatibilidad"
    : "No pudimos revisar todo: faltan datos de algunos productos";
}

const BAR_TONE: Record<QuoteCompatibility["status"], string> = {
  incompatible: "bg-destructive/10 border-destructive/20 text-destructive",
  warning: "bg-warn/10 border-warn/20 text-warn",
  unknown: "bg-secondary/40 border-border/40 text-muted-foreground",
  valid: "bg-success/10 border-success/20 text-success",
};
const BAR_RESULT: Record<QuoteCompatibility["status"], CompatCheck["result"]> = {
  incompatible: "incompatible",
  warning: "warning",
  unknown: "unknown",
  valid: "ok",
};

/** Estado general en una línea. */
export function CompatibilityBar({ compatibility }: { compatibility: QuoteCompatibility }) {
  const Icon = LOOK[BAR_RESULT[compatibility.status]].icon;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border p-3 text-sm font-medium",
        BAR_TONE[compatibility.status],
      )}
    >
      <Icon size={20} className="shrink-0" />
      <span>{summary(compatibility)}</span>
    </div>
  );
}

/** Todos los chequeos: lo que falla primero y los que pasan plegados. */
export function CompatibilityList({
  compatibility,
  className,
}: {
  compatibility: QuoteCompatibility;
  className?: string;
}) {
  const sorted = [...compatibility.checks].sort((a, b) => ORDER.indexOf(a.result) - ORDER.indexOf(b.result));
  const open = sorted.filter((c) => c.result !== "ok");
  const passed = sorted.filter((c) => c.result === "ok");
  return (
    <section
      id="compatibilidad"
      className={cn("bg-card rounded-3xl border border-border/40 shadow-sm overflow-hidden", className)}
    >
      <div className="p-6 border-b border-border/40 bg-secondary/5">
        <h2 className="text-xl font-semibold tracking-tight">Compatibilidad</h2>
      </div>
      {open.length > 0 && (
        <ul className="divide-y divide-border/40">
          {open.map((check) => (
            <CheckRow key={check.rule} check={check} />
          ))}
        </ul>
      )}
      {passed.length > 0 && (
        <details className="group border-t border-border/40">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-6 py-4 text-sm text-muted-foreground hover:text-foreground">
            <IconCircleCheck size={16} className="text-success" />
            <span className="flex-1">
              {passed.length} {passed.length === 1 ? "chequeo en orden" : "chequeos en orden"}
            </span>
            <IconChevronDown size={16} className="transition-transform group-open:rotate-180" />
          </summary>
          <ul className="divide-y divide-border/40 border-t border-border/40">
            {passed.map((check) => (
              <CheckRow key={check.rule} check={check} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function CheckRow({ check }: { check: CompatCheck }) {
  const { icon: Icon, tone } = LOOK[check.result];
  return (
    <li className="flex items-start gap-3 px-6 py-4 text-sm">
      <Icon size={18} className={cn("mt-0.5 shrink-0", tone)} />
      <span>{check.message}</span>
    </li>
  );
}
