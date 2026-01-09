import { IconChevronRight, IconCpu } from "@tabler/icons-react";
import { Link } from "react-router";
import type { Category } from "@/services/categories";
import { cn } from "~/lib/utils";
import { getCategoryConfig } from "~/utils/categories";

interface CategoryCardProps {
  category: Category;
  index: number;
}

export function CategoryCard({ category, index }: CategoryCardProps) {
  const config = getCategoryConfig(category.slug);
  const gradients = [
    "from-blue-500/20 to-purple-500/20",
    "from-emerald-500/20 to-teal-500/20",
    "from-orange-500/20 to-red-500/20",
    "from-pink-500/20 to-rose-500/20",
    "from-indigo-500/20 to-blue-500/20",
    "from-amber-500/20 to-yellow-500/20",
    "from-cyan-500/20 to-sky-500/20",
    "from-violet-500/20 to-purple-500/20",
    "from-lime-500/20 to-green-500/20",
    "from-fuchsia-500/20 to-pink-500/20",
  ];

  return (
    <Link
      to={`/categoria/${config.urlSlug}`}
      prefetch="intent"
      className={cn(
        "group relative flex flex-col items-center justify-center gap-3 p-6",
        "rounded-2xl border border-border/40 bg-card/70",
        "hover:border-primary/30 hover:bg-card transition-all duration-300",
        "hover:shadow-lg hover:shadow-primary/5",
      )}
    >
      <div
        className={cn(
          "absolute inset-0 rounded-2xl bg-linear-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300",
          gradients[index % gradients.length],
        )}
      />
      <div className="relative flex items-center justify-center size-12 rounded-xl bg-secondary/50 group-hover:bg-primary/10 transition-colors">
        <IconCpu className="size-6 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <span className="relative text-sm font-medium text-foreground text-center line-clamp-2">{config.label}</span>
      <IconChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
    </Link>
  );
}
