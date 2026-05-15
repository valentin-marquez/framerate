import { IconAlertTriangle, IconCheck, IconLoader2, IconRefresh } from "@tabler/icons-react";

interface CompatibilityBadgeProps {
  status: string;
  isAnalyzing?: boolean;
}

export function CompatibilityBadge({ status, isAnalyzing = false }: CompatibilityBadgeProps) {
  const baseStyles =
    "flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-muted-foreground text-sm font-medium border transition-colors";

  const spinner = isAnalyzing ? (
    <IconLoader2 size={14} className="animate-spin opacity-70" aria-label="Analizando" />
  ) : null;

  switch (status) {
    case "valid":
      return (
        <div className={`${baseStyles} border-success/20`}>
          <IconCheck size={16} />
          <span>Compatible</span>
          {spinner}
        </div>
      );
    case "warning":
      return (
        <div className={`${baseStyles} border-warn/20`}>
          <IconAlertTriangle size={16} />
          <span>Advertencia</span>
          {spinner}
        </div>
      );
    case "incompatible":
      return (
        <div className={`${baseStyles} border-destructive/20`}>
          <IconAlertTriangle size={16} />
          <span>Incompatible</span>
          {spinner}
        </div>
      );
    case "empty":
      return (
        <div className={`${baseStyles} border-border/40 opacity-70`}>
          <span>Vacía</span>
          {spinner}
        </div>
      );
    default:
      return (
        <div className={`${baseStyles} border-border/40`}>
          <IconRefresh size={16} />
          <span>Sin verificar</span>
          {spinner}
        </div>
      );
  }
}
