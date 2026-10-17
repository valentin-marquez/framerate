import type { QuoteAuthor } from "@framerate/contracts";
import { IconCalendar, IconUser } from "@tabler/icons-react";
import { Link } from "react-router";
import { useTranslation } from "~/shared/hooks/use-translation";

interface QuoteHeaderProps {
  quoteName: string;
  author: QuoteAuthor;
  updatedAt: string;
}

export function QuoteHeader({ quoteName, author, updatedAt }: QuoteHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-500">
      <h1 className="text-title-h4 md:text-title-h3 lg:text-title-h2 text-foreground transition-colors">{quoteName}</h1>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground font-medium">
        <Link to={`/u/${author.username}`} className="flex items-center gap-2 group hover:text-foreground">
          <div className="flex size-6 items-center justify-center rounded-full bg-secondary text-secondary-foreground group-hover:scale-105 transition-transform border border-border/50">
            <IconUser size={14} />
          </div>
          <span>{t("by", { name: author.displayName })}</span>
        </Link>

        <div className="flex items-center gap-2 cursor-default">
          <div className="flex size-6 items-center justify-center rounded-full bg-secondary text-secondary-foreground border border-border/50">
            <IconCalendar size={14} />
          </div>
          <span>
            {t("updated_on", {
              // react-doctor-disable-next-line rendering-hydration-mismatch-time -- timezone-stabilized output (es-CL, America/Santiago)
              date: new Date(updatedAt).toLocaleDateString("es-CL", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "America/Santiago",
              }),
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
