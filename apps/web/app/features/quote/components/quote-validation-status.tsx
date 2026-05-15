import type { ValidationIssue, ValidationSeverity } from "@framerate/db";
import {
  IconAlertTriangle,
  IconChevronDown,
  IconCircleCheck,
  IconExclamationCircle,
  IconInfoCircle,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { cn } from "~/shared/lib/utils";

interface QuoteValidationStatusProps {
  status: "valid" | "warning" | "incompatible" | "unknown";
  issues: ValidationIssue[] | null;
}

const GENERAL_GROUP_KEY = "__general__";
const GENERAL_GROUP_LABEL = "General";

const SEVERITY_RANK: Record<ValidationSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

function isInsufficientDataIssue(issue: ValidationIssue) {
  return issue.code === "INSUFFICIENT_DATA" || issue.severity === "info";
}

function dedupeIssues(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}-${issue.message}-${issue.componentA ?? ""}-${issue.componentB ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function groupIssuesByComponent(issues: ValidationIssue[]) {
  const groups = new Map<string, { label: string; issues: ValidationIssue[] }>();
  for (const issue of issues) {
    const key = issue.componentA ?? GENERAL_GROUP_KEY;
    const label = issue.componentA ?? GENERAL_GROUP_LABEL;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.issues.push(issue);
    } else {
      groups.set(key, { label, issues: [issue] });
    }
  }
  // Sort each group by severity
  for (const bucket of groups.values()) {
    bucket.issues.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  }
  // Stable order: General last, others alphabetical
  return Array.from(groups.entries()).sort(([keyA, a], [keyB, b]) => {
    if (keyA === GENERAL_GROUP_KEY) return 1;
    if (keyB === GENERAL_GROUP_KEY) return -1;
    return a.label.localeCompare(b.label);
  });
}

export function QuoteValidationStatus({ status, issues }: QuoteValidationStatusProps) {
  const [showInsufficient, setShowInsufficient] = useState(false);

  const { actionableIssues, insufficientIssues } = useMemo(() => {
    const all = dedupeIssues(issues ?? []);
    const insufficient: ValidationIssue[] = [];
    const actionable: ValidationIssue[] = [];
    for (const issue of all) {
      if (isInsufficientDataIssue(issue)) {
        insufficient.push(issue);
      } else {
        actionable.push(issue);
      }
    }
    return { actionableIssues: actionable, insufficientIssues: insufficient };
  }, [issues]);

  const actionableGroups = useMemo(() => groupIssuesByComponent(actionableIssues), [actionableIssues]);

  if (status === "unknown" && actionableIssues.length === 0 && insufficientIssues.length === 0) {
    return null;
  }

  // Estado válido sin observaciones accionables (los datos faltantes pueden mostrarse aparte).
  if (status === "valid" && actionableIssues.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-success/20 bg-success/5 p-5 flex items-center gap-5 animate-in fade-in slide-in-from-bottom-2">
          <div className="size-12 rounded-full bg-success/10 flex items-center justify-center shrink-0 shadow-[0_0_15px_-3px_var(--color-success)] shadow-success/20">
            <IconCircleCheck className="text-success" size={26} stroke={2} />
          </div>
          <div className="space-y-0.5">
            <h3 className="font-semibold text-lg tracking-tight text-foreground">Compatibilidad Verificada</h3>
            <p className="text-sm text-muted-foreground">
              Todos los componentes seleccionados son compatibles y funcionan bien juntos.
            </p>
          </div>
        </div>

        {insufficientIssues.length > 0 && (
          <InsufficientDataAccordion
            issues={insufficientIssues}
            isOpen={showInsufficient}
            onToggle={() => setShowInsufficient((prev) => !prev)}
          />
        )}
      </div>
    );
  }

  const isError = status === "incompatible";
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
    <div className="space-y-4">
      <div className={cn("rounded-2xl border p-5 animate-in fade-in slide-in-from-bottom-2", containerClasses)}>
        <div className="flex items-start gap-4 mb-5">
          <div
            className={cn(
              "size-10 rounded-full flex items-center justify-center shrink-0 shadow-[0_0_10px_-2px] transition-colors",
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

        {actionableGroups.length > 0 && (
          <div className="space-y-5">
            {actionableGroups.map(([key, group]) => (
              <div key={key} className="space-y-2">
                <p className="text-xs uppercase tracking-wider font-medium text-muted-foreground px-1">{group.label}</p>
                <div className="space-y-3">
                  {group.issues.map((issue, index) => (
                    <IssueCard key={`${issue.code}-${index}`} issue={issue} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {insufficientIssues.length > 0 && (
        <InsufficientDataAccordion
          issues={insufficientIssues}
          isOpen={showInsufficient}
          onToggle={() => setShowInsufficient((prev) => !prev)}
        />
      )}
    </div>
  );
}

function IssueCard({ issue }: { issue: ValidationIssue }) {
  const isIssueError = issue.severity === "error";

  const IssueIcon = isIssueError ? IconExclamationCircle : IconAlertTriangle;
  const iconColor = isIssueError ? "text-destructive" : "text-warn";
  const borderColor = isIssueError ? "border-destructive/20" : "border-warn/20";
  const accentColor = isIssueError ? "bg-destructive" : "bg-warn";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-background/60 backdrop-blur-md p-4 transition-all hover:bg-background/80",
        borderColor,
      )}
    >
      <div className="flex gap-4">
        <IssueIcon className={cn("mt-0.5 shrink-0", iconColor)} size={20} />
        <div className="space-y-1 w-full min-w-0">
          <p className={cn("font-medium text-sm leading-snug", isIssueError ? "text-destructive" : "text-foreground")}>
            {issue.message}
          </p>

          {issue.details && <p className="text-sm text-muted-foreground leading-relaxed">{issue.details}</p>}

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

      <div className={cn("absolute left-0 top-0 bottom-0 w-1", accentColor)} />
    </div>
  );
}

interface InsufficientDataAccordionProps {
  issues: ValidationIssue[];
  isOpen: boolean;
  onToggle: () => void;
}

function InsufficientDataAccordion({ issues, isOpen, onToggle }: InsufficientDataAccordionProps) {
  const count = issues.length;
  const headingId = "insufficient-data-heading";
  const panelId = "insufficient-data-panel";

  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-md overflow-hidden animate-in fade-in slide-in-from-bottom-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        id={headingId}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-secondary/40 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-3 min-w-0">
          <span className="size-8 rounded-full bg-secondary flex items-center justify-center shrink-0 border border-border/50">
            <IconInfoCircle size={16} className="text-muted-foreground" />
          </span>
          <span className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-foreground truncate">Datos faltantes ({count})</span>
            <span className="text-xs text-muted-foreground truncate">
              Información que mejoraría la precisión del análisis.
            </span>
          </span>
        </span>
        <IconChevronDown
          size={16}
          className={cn("shrink-0 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <section
          id={panelId}
          aria-labelledby={headingId}
          className="border-t border-border/40 px-5 py-4 space-y-2 bg-background/40"
        >
          {issues.map((issue, index) => (
            <InsufficientDataRow key={`${issue.code}-${index}`} issue={issue} />
          ))}
        </section>
      )}
    </div>
  );
}

function InsufficientDataRow({ issue }: { issue: ValidationIssue }) {
  return (
    <div className="flex items-start gap-3 rounded-lg px-2 py-1.5">
      <IconInfoCircle size={14} className="mt-0.5 shrink-0 text-muted-foreground/80" />
      <div className="space-y-0.5 min-w-0">
        <p className="text-xs text-muted-foreground leading-snug" title={issue.details ?? undefined}>
          {issue.message}
        </p>
        {issue.details && (
          <p className="text-[11px] text-muted-foreground/70 font-mono leading-snug truncate">{issue.details}</p>
        )}
      </div>
      {issue.componentA && (
        <span className="ml-auto text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70 shrink-0">
          {issue.componentA}
        </span>
      )}
    </div>
  );
}
