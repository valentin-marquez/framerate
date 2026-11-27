import type { ProductSummary } from "@framerate/contracts";
import { imageVariant } from "@framerate/kit";
import { IconArrowRight, IconRosetteDiscount } from "@tabler/icons-react";
import { Link } from "react-router";
import { BLACK_FRIDAY_UNTIL } from "~/shared/lib/black-friday";
import { enterClass, enterStyle } from "~/shared/lib/initial-load";
import { cn } from "~/shared/lib/utils";

/** Aviso del evento en la portada: la franja entera es el enlace, con las fotos de las mayores bajas a la derecha. */
export function BlackFridayBanner({ drops }: { drops: ProductSummary[] }) {
  const photos = drops.filter((p) => p.imageUrl).slice(0, 3);
  return (
    <Link
      to="/black-friday"
      prefetch="intent"
      className={cn(
        "group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-border/70 bg-card p-4 transition-[background-color,scale] hover:bg-secondary/60 active:scale-[0.995] md:gap-6 md:p-5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        enterClass(),
      )}
      style={enterStyle(120)}
    >
      <span aria-hidden="true" data-variant="event" className="beam pointer-events-none absolute inset-0 rounded-2xl">
        <span className="beam-glow" />
        <span className="beam-line" />
        <span className="beam-line beam-top" />
      </span>
      <IconRosetteDiscount className="size-8 shrink-0 text-amber-600 md:size-10 dark:text-amber-400" stroke={1.5} />
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs md:text-sm">{BLACK_FRIDAY_UNTIL}</p>
        <p className="text-title-h6 text-foreground md:text-title-h5">Black Friday</p>
        <p className="text-pretty text-muted-foreground text-sm">
          Lo que está más barato que su precio habitual, comparado entre tiendas.
        </p>
      </div>
      {photos.length > 0 && (
        <div aria-hidden="true" className="hidden shrink-0 -space-x-4 sm:flex">
          {photos.map((p) => (
            <img
              key={p.id}
              src={imageVariant(p.imageUrl ?? "", 400)}
              alt=""
              loading="lazy"
              className="size-16 rounded-xl border border-border/70 bg-white object-contain p-1.5 md:size-20"
            />
          ))}
        </div>
      )}
      <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 py-2 font-medium text-background text-sm md:inline-flex">
        Ver las bajas
        <IconArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" stroke={2} />
      </span>
      <IconArrowRight className="size-5 shrink-0 text-muted-foreground md:hidden" stroke={1.75} />
    </Link>
  );
}
