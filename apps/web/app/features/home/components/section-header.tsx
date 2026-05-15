import { IconArrowRight } from "@tabler/icons-react";
import { Link } from "react-router";
import { Badge } from "~/shared/components/primitives/badge";

interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    href: string;
  };
  badge?: {
    label: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
}

export function SectionHeader({ icon, title, description, action, badge }: SectionHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
            {icon}
          </div>
        )}
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">{title}</h2>
            {badge && (
              <Badge variant={badge.variant || "secondary"} className="text-xs font-medium">
                {badge.label}
              </Badge>
            )}
          </div>
          {description && <p className="text-sm text-muted-foreground max-w-xl">{description}</p>}
        </div>
      </div>
      {action && (
        <Link
          to={action.href}
          prefetch="intent"
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors shrink-0"
        >
          {action.label}
          <IconArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
