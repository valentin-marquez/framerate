import type { QuoteCompatibility } from "@framerate/contracts";
import { IconAlertTriangle, IconBolt } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useTranslation } from "~/shared/hooks/use-translation";
import { formatCLP } from "~/shared/utils/format";
import { CompatibilityBar } from "./quote-compatibility";

interface QuoteTotalsProps {
  totalNormal: number;
  totalCash: number;
  hasOutOfStockItems?: boolean;
  compatibility?: QuoteCompatibility;
  /** Acciones al pie de la tarjeta ("Guardar como"). */
  children?: ReactNode;
}

/** Cerca del doble del consumo (una fuente rinde mejor cerca de la mitad de su carga), en múltiplos de 50 W. */
const recommendedPsuWatts = (estimatedWatts: number) => Math.ceil((estimatedWatts * 2) / 50) * 50;

/** Resumen del armado: total, estado de compatibilidad, consumo estimado y acciones. */
export function QuoteTotals({ totalNormal, totalCash, hasOutOfStockItems, compatibility, children }: QuoteTotalsProps) {
  const { t } = useTranslation();
  return (
    <div className="bg-card rounded-3xl border border-border/40 shadow-sm p-6 space-y-4">
      <div className="space-y-1">
        <span className="text-sm text-muted-foreground">{t("total_cash")}</span>
        <p className="text-title-h4 tabular-nums">{formatCLP(totalCash)}</p>
        <p className="text-sm text-muted-foreground">
          {t("total_normal")}{" "}
          <span className="tabular-nums line-through decoration-muted-foreground">{formatCLP(totalNormal)}</span>
        </p>
      </div>
      {hasOutOfStockItems && (
        <div className="flex items-start gap-2 text-warn bg-warn/10 p-3 rounded-lg border border-warn/20">
          <IconAlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span className="text-sm font-medium">{t("some_items_out_of_stock")}</span>
        </div>
      )}
      {compatibility && <CompatibilityBar compatibility={compatibility} />}
      {compatibility?.estimatedWatts && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-sm">
            <IconBolt size={16} className="text-warn" />
            <span className="tabular-nums">~{compatibility.estimatedWatts}W</span>
            <span className="text-muted-foreground">de consumo estimado</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("quote_psu_recommendation", { watts: recommendedPsuWatts(compatibility.estimatedWatts) })}
          </p>
        </div>
      )}
      {children}
    </div>
  );
}
