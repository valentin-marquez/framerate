import { IconStar, IconStarFilled } from "@tabler/icons-react";
import { cn } from "~/shared/lib/utils";

interface RatingStarsProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  onChange?: (value: number) => void;
  className?: string;
}

const SIZE_MAP = {
  sm: "size-3",
  md: "size-4",
  lg: "size-6",
} as const;

/**
 * Estrellas de rating. Si `onChange` está definido, es interactivo.
 */
export function RatingStars({ value, max = 5, size = "md", onChange, className }: RatingStarsProps) {
  const sizeCls = SIZE_MAP[size];
  const interactive = !!onChange;
  const label = `${value} de ${max} estrellas`;

  const stars = Array.from({ length: max }).map((_, i) => {
    const idx = i + 1;
    const filled = idx <= Math.round(value);
    const Icon = filled ? IconStarFilled : IconStar;
    const star = (
      <Icon className={cn(sizeCls, filled ? "text-amber-400" : "text-muted-foreground/30")} aria-hidden="true" />
    );
    if (!interactive) {
      // biome-ignore lint/suspicious/noArrayIndexKey: Estrella estática en posición fija
      return <span key={i}>{star}</span>;
    }
    return (
      <button
        // biome-ignore lint/suspicious/noArrayIndexKey: Estrella interactiva en posición fija
        key={i}
        type="button"
        aria-pressed={value === idx}
        aria-label={`${idx} estrella${idx > 1 ? "s" : ""}`}
        onClick={() => onChange?.(idx)}
        className="cursor-pointer rounded-md p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {star}
      </button>
    );
  });

  if (interactive) {
    return (
      <fieldset className={cn("inline-flex items-center gap-0.5 border-0 p-0 m-0", className)}>
        <legend className="sr-only">{label}</legend>
        {stars}
      </fieldset>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={label} role="img">
      {stars}
    </span>
  );
}
