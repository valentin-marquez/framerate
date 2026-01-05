import { IconBolt } from "@tabler/icons-react";
import { CompatibilityBadge } from "./compatibility-badge";

interface QuoteHeaderProps {
  quoteName: string;
  userName?: string;
  updatedAt: string;
  compatibilityStatus: string;
  estimatedWattage?: number;
}

export function QuoteHeader({
  quoteName,
  userName,
  updatedAt,
  compatibilityStatus,
  estimatedWattage,
}: QuoteHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">{quoteName}</h1>
        <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="text-sm">Creado por</span>
            <span className="font-medium text-foreground">{userName ? userName.slice(0, -2) : "Usuario"}</span>
          </div>
          <span className="text-border/40">|</span>
          <div className="flex items-center gap-2">
            <span className="text-sm">Actualizado</span>
            <span className="font-medium text-foreground">{new Date(updatedAt).toLocaleDateString("es-CL")}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <CompatibilityBadge status={compatibilityStatus} />
        {estimatedWattage && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-medium border border-blue-500/20">
            <IconBolt size={16} />
            <span>{estimatedWattage}W est.</span>
          </div>
        )}
      </div>
    </div>
  );
}
