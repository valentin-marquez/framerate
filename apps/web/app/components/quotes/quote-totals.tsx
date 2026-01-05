import { IconAlertTriangle } from "@tabler/icons-react";
import { formatCLP } from "~/utils/format";

interface QuoteTotalsProps {
  totalNormal: number;
  totalCash: number;
  hasOutOfStockItems?: boolean;
}

export function QuoteTotals({ totalNormal, totalCash, hasOutOfStockItems }: QuoteTotalsProps) {
  return (
    <div className="bg-secondary/10 p-6 border-t border-border/40">
      {hasOutOfStockItems && (
        <div className="mb-4 flex items-center gap-2 text-warn bg-warn/10 p-3 rounded-lg border border-warn/20">
          <IconAlertTriangle size={20} />
          <span className="text-sm font-medium">
            Algunos productos no tienen stock disponible. El total puede variar.
          </span>
        </div>
      )}
      <div className="flex flex-col gap-4 md:flex-row md:justify-end md:gap-12">
        <div className="flex justify-between items-center md:flex-col md:items-end gap-1">
          <span className="text-muted-foreground text-sm">Total Normal</span>
          <span className="text-xl font-medium text-muted-foreground line-through decoration-border/60">
            {formatCLP(totalNormal)}
          </span>
        </div>
        <div className="flex justify-between items-center md:flex-col md:items-end gap-1">
          <span className="text-muted-foreground text-sm font-medium">Total Efectivo</span>
          <span className="text-3xl font-bold text-foreground tracking-tight">{formatCLP(totalCash)}</span>
        </div>
      </div>
    </div>
  );
}
