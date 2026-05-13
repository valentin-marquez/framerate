import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "~/shared/hooks/use-translation";
import { formatCLP } from "~/shared/utils/format";

interface QuoteTotalsProps {
  totalNormal: number;
  totalCash: number;
  hasOutOfStockItems?: boolean;
}

export function QuoteTotals({ totalNormal, totalCash, hasOutOfStockItems }: QuoteTotalsProps) {
  const { t } = useTranslation();
  return (
    <div className="bg-secondary/10 p-6 border-t border-border/40">
      {hasOutOfStockItems && (
        <div className="mb-4 flex items-center gap-2 text-warn bg-warn/10 p-3 rounded-lg border border-warn/20">
          <IconAlertTriangle size={20} />
          <span className="text-sm font-medium">{t("some_items_out_of_stock")}</span>
        </div>
      )}
      <div className="flex flex-col gap-4 md:flex-row md:justify-end md:gap-12">
        <div className="flex justify-between items-center md:flex-col md:items-end gap-1">
          <span className="text-muted-foreground text-sm">{t("total_normal")}</span>
          <span className="text-xl font-medium text-muted-foreground line-through decoration-muted-foreground">
            {formatCLP(totalNormal)}
          </span>
        </div>
        <div className="flex justify-between items-center md:flex-col md:items-end gap-1">
          <span className="text-muted-foreground text-sm font-medium">{t("total_cash")}</span>
          <span className="text-3xl font-bold text-foreground tracking-tight">{formatCLP(totalCash)}</span>
        </div>
      </div>
    </div>
  );
}
