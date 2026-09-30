import type { Icon } from "@tabler/icons-react";
import { cn } from "~/shared/lib/utils";

/** Sección de ajustes: título, descripción opcional y una acción a la derecha (p. ej. "Añadir"). */
export function SettingsSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4 border-border border-t pt-8 first:border-t-0 first:pt-0", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-semibold text-foreground text-xl">{title}</h2>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Tarjeta que agrupa filas relacionadas, separadas por líneas finas. */
export function SettingsGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card", className)}>
      {children}
    </div>
  );
}

/** Fila: ícono, título, descripción y control a la derecha. En móvil el control baja bajo el texto. */
export function SettingsRow({
  icon: RowIcon,
  title,
  description,
  badge,
  action,
}: {
  icon?: Icon;
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-start gap-3">
        {RowIcon && <RowIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" stroke={1.75} />}
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <span className="truncate">{title}</span>
            {badge}
          </p>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0 sm:ml-4">{action}</div>}
    </div>
  );
}

/** Insignia pequeña para una fila ("Principal", "Conectado"). */
export function SettingsBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-secondary px-1.5 py-0.5 font-medium text-[11px] text-muted-foreground">
      {children}
    </span>
  );
}
