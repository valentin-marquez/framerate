import { type CompatCheck, psuSizing, type QuoteDetail } from "@framerate/contracts";
import { IconAlertTriangle, IconCircleCheck, IconCircleX, IconHelpCircle, type IconProps } from "@tabler/icons-react";
import { type ComponentType, type ReactNode, useState } from "react";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cn } from "~/shared/lib/utils";
import { formatCLP } from "~/shared/utils/format";
import { CompatibilityList } from "./quote-compatibility";

const COMPAT: Record<
  QuoteDetail["compatibility"]["status"],
  { label: string; tone: string; icon: ComponentType<IconProps> }
> = {
  valid: { label: "Compatible", tone: "text-success", icon: IconCircleCheck },
  warning: { label: "Con advertencias", tone: "text-warn", icon: IconAlertTriangle },
  incompatible: { label: "Incompatible", tone: "text-destructive", icon: IconCircleX },
  unknown: { label: "Sin revisar", tone: "text-muted-foreground", icon: IconHelpCircle },
};

const isIssue = (c: CompatCheck) => c.result === "incompatible" || c.result === "warning";

function Stat({ label, value, children }: { label: string; value: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5 p-4">
      <span className="block text-muted-foreground text-label-xs">{label}</span>
      <span className="block truncate text-foreground text-title-h5 tabular-nums md:text-title-h4">{value}</span>
      <div className="text-muted-foreground text-paragraph-xs">{children}</div>
    </div>
  );
}

/** Tres cifras hermanas: total, consumo estimado y compatibilidad, que despliega la lista de chequeos. */
export function QuoteTotals({ quote }: { quote: Pick<QuoteDetail, "items" | "totals" | "compatibility"> }) {
  const { t } = useTranslation();
  const [showChecks, setShowChecks] = useState(false);
  const { compatibility, totals } = quote;
  const watts = compatibility.estimatedWatts;
  const look = COMPAT[compatibility.status];
  const checks = compatibility.checks.length;
  const issues = compatibility.checks.filter(isIssue).length;
  const outOfStock = quote.items.some((item) => item.isSelected && !item.offer);

  return (
    <>
      {/* En teléfono, una columna: a media pantalla "Con advertencias" no cabe. */}
      <div className="grid divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Stat label={t("total_cash")} value={formatCLP(totals.cash)}>
          {t("total_normal")} <span className="tabular-nums">{formatCLP(totals.card)}</span>
          {outOfStock && <p className="text-warn">{t("some_items_out_of_stock")}</p>}
        </Stat>
        <Stat label="Consumo estimado" value={watts ? `~${watts} W` : "Sin datos"}>
          {watts ? (
            <span className="tabular-nums">{t("quote_psu_recommendation", psuSizing(watts))}</span>
          ) : (
            "Agrega procesador y tarjeta para estimarlo"
          )}
        </Stat>
        <Stat
          label="Compatibilidad"
          value={
            <span className={cn("flex items-center gap-1.5", look.tone)}>
              <look.icon className="size-6 shrink-0" />
              <span className="truncate">{look.label}</span>
            </span>
          }
        >
          {checks === 0 ? (
            "Agrega procesador, placa y RAM para revisarla"
          ) : (
            <button
              type="button"
              aria-expanded={showChecks}
              aria-controls="compatibilidad"
              onClick={() => setShowChecks((v) => !v)}
              className="cursor-pointer text-left underline-offset-2 hover:text-foreground hover:underline"
            >
              <span className="tabular-nums">
                {issues === 0 ? "Sin avisos" : `${issues} ${issues === 1 ? "aviso" : "avisos"}`} en {checks}{" "}
                {checks === 1 ? "chequeo" : "chequeos"}
              </span>
            </button>
          )}
        </Stat>
      </div>
      {showChecks && <CompatibilityList compatibility={compatibility} className="rounded-2xl shadow-none" />}
    </>
  );
}
