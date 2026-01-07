import type { ValidationIssue } from "@framerate/db";
import { IconAlertTriangle, IconCircleCheck, IconExclamationCircle, IconInfoCircle } from "@tabler/icons-react";
import { useMemo } from "react";
import { cn } from "~/lib/utils";

interface QuoteValidationStatusProps {
  status: "valid" | "warning" | "incompatible" | "unknown";
  issues: ValidationIssue[] | null;
}

export function QuoteValidationStatus({ status, issues }: QuoteValidationStatusProps) {
  const uniqueIssues = useMemo(() => {
    if (!issues) return [];
    const seen = new Set();
    return issues.filter((issue) => {
      const key = `${issue.code}-${issue.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [issues]);

  if (status === "unknown" && (!issues || issues.length === 0)) {
    return null;
  }

  // ✅ Estado Válido - Diseño Limpio y Premium
  if (status === "valid" && (!issues || issues.length === 0)) {
    return (
      <div className="rounded-2xl border border-success/20 bg-success/5 p-5 flex items-center gap-5 animate-in fade-in slide-in-from-bottom-2">
        <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center shrink-0 shadow-[0_0_15px_-3px_var(--color-success)] shadow-success/20">
          <IconCircleCheck className="text-success" size={26} stroke={2} />
        </div>
        <div className="space-y-0.5">
          <h3 className="font-semibold text-lg tracking-tight text-foreground">Compatibilidad Verificada</h3>
          <p className="text-sm text-muted-foreground">
            Todos los componentes seleccionados son compatibles y funcionan bien juntos.
          </p>
        </div>
      </div>
    );
  }

  // ⚠️ Estado de Advertencia o Error
  const isError = status === "incompatible";

  // Colores dinámicos basados en el estado
  const containerClasses = isError ? "border-destructive/20 bg-destructive/5" : "border-warn/20 bg-warn/5";

  const HeaderIcon = isError ? IconExclamationCircle : IconAlertTriangle;
  const headerIconColor = isError ? "text-destructive" : "text-warn";
  const headerIconBg = isError ? "bg-destructive/10" : "bg-warn/10";
  const headerShadow = isError ? "shadow-destructive/20" : "shadow-warn/20";

  const title = isError ? "Problemas de Compatibilidad" : "Observaciones del Build";
  const description = isError
    ? "Hay conflictos críticos que impiden el funcionamiento del equipo."
    : "Sugerencias para optimizar tu configuración y evitar problemas.";

  return (
    <div className={cn("rounded-2xl border p-5 animate-in fade-in slide-in-from-bottom-2", containerClasses)}>
      {/* Header del Status */}
      <div className="flex items-start gap-4 mb-5">
        <div
          className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center shrink-0 shadow-[0_0_10px_-2px] transition-colors",
            headerIconBg,
            headerShadow,
          )}
        >
          <HeaderIcon className={headerIconColor} size={22} stroke={2} />
        </div>
        <div>
          <h3 className="font-semibold text-lg tracking-tight text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>

      {/* Lista de Issues - Estilo "Cards" dentro del contenedor */}
      {uniqueIssues.length > 0 && (
        <div className="space-y-3">
          {uniqueIssues.map((issue, index) => {
            const isIssueError = issue.severity === "error";
            const isInfo = issue.severity === "info";

            let IssueIcon = IconAlertTriangle;
            let iconColor = "text-warn";
            let borderColor = "border-warn/20";

            if (isIssueError) {
              IssueIcon = IconExclamationCircle;
              iconColor = "text-destructive";
              borderColor = "border-destructive/20";
            } else if (isInfo) {
              IssueIcon = IconInfoCircle;
              iconColor = "text-blue-500";
              borderColor = "border-blue-500/20";
            }

            return (
              <div
                key={`${issue.code}-${index}`}
                className={cn(
                  "relative overflow-hidden rounded-xl border bg-background/60 backdrop-blur-sm p-4 transition-all hover:bg-background/80",
                  borderColor,
                )}
              >
                <div className="flex gap-4">
                  <IssueIcon className={cn("mt-0.5 shrink-0", iconColor)} size={20} />
                  <div className="space-y-1 w-full min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          "font-medium text-sm leading-none",
                          isIssueError ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {issue.message}
                      </p>
                      {/* Severity Badge opcional si se quiere ser explícito */}
                      {/* <span className={cn("text-[10px] uppercase font-bold tracking-wider opacity-70", iconColor)}>
                            {issue.severity}
                        </span> */}
                    </div>

                    {issue.details && <p className="text-sm text-muted-foreground leading-relaxed">{issue.details}</p>}

                    {/* Component Tags */}
                    {(issue.componentA || issue.componentB) && (
                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/40">
                        {issue.componentA && (
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border/50">
                            {issue.componentA}
                          </span>
                        )}
                        {issue.componentB && (
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border/50">
                            {issue.componentB}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Decorative side accent */}
                <div
                  className={cn(
                    "absolute left-0 top-0 bottom-0 w-1",
                    isIssueError ? "bg-destructive" : isInfo ? "bg-blue-500" : "bg-warn",
                  )}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
