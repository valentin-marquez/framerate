import { IconAlertTriangle, IconCheck, IconRefresh } from "@tabler/icons-react";

export function CompatibilityBadge({ status }: { status: string }) {
  switch (status) {
    case "valid":
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 text-success-foreground text-sm font-medium border border-success/20">
          <IconCheck size={16} />
          <span>Compatible</span>
        </div>
      );
    case "warning":
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-warn/10 text-warn text-sm font-medium border border-warn/20">
          <IconAlertTriangle size={16} />
          <span>Advertencia</span>
        </div>
      );
    case "incompatible":
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 text-destructive-foreground text-sm font-medium border border-destructive/20">
          <IconAlertTriangle size={16} />
          <span>Incompatible</span>
        </div>
      );
    default:
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-muted-foreground text-sm font-medium border border-border/40">
          <IconRefresh size={16} />
          <span>Sin verificar</span>
        </div>
      );
  }
}
