import type { ValidationIssue } from "@framerate/db";
import { IconAlertTriangle, IconCircleCheck, IconExclamationCircle } from "@tabler/icons-react";
import { useMemo } from "react";

interface QuoteValidationStatusProps {
  status: "valid" | "warning" | "incompatible" | "unknown";
  issues: ValidationIssue[] | null;
}

export function QuoteValidationStatus({ status, issues }: QuoteValidationStatusProps) {
  const uniqueIssues = useMemo(() => {
    if (!issues) return [];
    // Deduplicate issues based on code and message to avoid clutter
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

  if (status === "valid" && (!issues || issues.length === 0)) {
    return (
      <div className="rounded-xl border border-success/20 bg-success/10 p-4 flex items-start gap-3">
        <IconCircleCheck className="text-success mt-0.5 shrink-0" size={20} />
        <div>
          <h3 className="font-medium text-success dark:text-success-foreground">Compatibilidad Verificada</h3>
          <p className="text-sm text-success/90 dark:text-success-foreground/90 mt-1">
            Todos los componentes seleccionados son compatibles entre sí.
          </p>
        </div>
      </div>
    );
  }

  const isError = status === "incompatible";
  const borderColor = isError ? "border-destructive" : "border-warn";
  const bgColor = isError ? "bg-destructive/10" : "bg-warn/10";
  const iconColor = isError ? "text-destructive" : "text-warn";
  const titleColor = isError ? "text-destructive dark:text-destructive" : "text-warn dark:text-warn";
  const Icon = isError ? IconExclamationCircle : IconAlertTriangle;
  const title = isError ? "Problemas de Compatibilidad Detectados" : "Advertencias de Compatibilidad";

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-4 flex items-start gap-3`}>
      <Icon className={`${iconColor} mt-0.5 shrink-0`} size={20} />
      <div className="space-y-3 w-full">
        <div>
          <h3 className={`font-medium ${titleColor}`}>{title}</h3>
          <p className="text-sm opacity-90 mt-1">
            {isError
              ? "Esta configuración tiene conflictos que impiden su funcionamiento."
              : "Revisa las siguientes observaciones antes de comprar."}
          </p>
        </div>

        {uniqueIssues.length > 0 && (
          <div className="space-y-2">
            {uniqueIssues.map((issue, index) => (
              <div
                key={`${issue.code}-${index}`}
                className={`text-sm p-3 rounded-lg border ${
                  issue.severity === "error"
                    ? "bg-destructive/10 border-destructive/10 text-destructive dark:text-destructive-foreground"
                    : "bg-warn/10 border-warn/10 text-warn dark:text-warn"
                }`}
              >
                <div className="font-medium flex items-center gap-2">
                  {issue.severity === "error" ? <IconExclamationCircle size={14} /> : <IconAlertTriangle size={14} />}
                  {issue.message}
                </div>
                {issue.details && <div className="mt-1 opacity-80 text-xs ml-5.5">{issue.details}</div>}
                {(issue.componentA || issue.componentB) && (
                  <div className="mt-2 text-xs opacity-70 ml-5.5 border-t border-current/10 pt-1">
                    {issue.componentA && <div>• {issue.componentA}</div>}
                    {issue.componentB && <div>• {issue.componentB}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
