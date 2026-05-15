import { IconBolt, IconCalendar, IconUser } from "@tabler/icons-react";
import { useTranslation } from "~/shared/hooks/use-translation";
import { CompatibilityBadge } from "./compatibility-badge";

interface QuoteHeaderProps {
  quoteName: string;
  userName?: string;
  updatedAt: string;
  compatibilityStatus: string;
  estimatedWattage?: number;
  isAnalyzing?: boolean;
}

export function QuoteHeader({
  quoteName,
  userName,
  updatedAt,
  compatibilityStatus,
  estimatedWattage,
  isAnalyzing = false,
}: QuoteHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="space-y-3">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground transition-colors">
          {quoteName}
        </h1>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground font-medium">
          <div className="flex items-center gap-2 group cursor-default">
            <div className="flex size-6 items-center justify-center rounded-full bg-secondary text-secondary-foreground group-hover:scale-105 transition-transform border border-border/50">
              <IconUser size={14} />
            </div>
            <span>{t("by", { name: userName ? userName.slice(0, -2) : t("user") })}</span>
          </div>

          <div className="flex items-center gap-2 group cursor-default">
            <div className="flex size-6 items-center justify-center rounded-full bg-secondary text-secondary-foreground group-hover:scale-105 transition-transform border border-border/50">
              <IconCalendar size={14} />
            </div>
            <span>
              {t("updated_on", {
                date: new Date(updatedAt).toLocaleDateString("es-CL", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }),
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start">
        <CompatibilityBadge status={compatibilityStatus} isAnalyzing={isAnalyzing} />

        {estimatedWattage ? (
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-muted-foreground text-sm font-medium border border-border/40"
            title={t("estimated_wattage")}
          >
            <IconBolt size={16} stroke={2} className="fill-blue-500/20" />
            <span className="font-semibold tabular-nums tracking-tight">{estimatedWattage}W</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
