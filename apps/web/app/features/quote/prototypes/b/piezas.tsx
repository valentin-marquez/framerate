import { imageVariant } from "@framerate/kit";
import { cn } from "~/shared/lib/utils";

export const componentes = (n: number) => `${n} ${n === 1 ? "componente" : "componentes"}`;

/** Las cuatro primeras fotos del armado en 2x2 sobre el fondo de producto; donde falta una, queda el fondo. */
export function Collage({ images, small, className }: { images: string[]; small?: boolean; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 grid-rows-2 bg-[var(--product-stage)]", small ? "p-1" : "p-3", className)}>
      {images.slice(0, 4).map((src) => (
        <img
          key={src}
          src={small ? imageVariant(src, 400) : src}
          alt=""
          loading="lazy"
          className={cn("size-full min-h-0 object-contain mix-blend-multiply", small ? "p-1" : "p-3")}
        />
      ))}
    </div>
  );
}

/** Una foto por componente, en fila: la "lista" del armado a simple vista. */
export function Thumbs({ images, className }: { images: string[]; className?: string }) {
  return (
    <ul className={cn("flex gap-2", className)}>
      {images.slice(0, 4).map((src) => (
        <li key={src} className="size-14 shrink-0 overflow-hidden rounded-xl bg-[var(--product-stage)] p-1">
          <img
            src={imageVariant(src, 400)}
            alt=""
            loading="lazy"
            className="size-full object-contain mix-blend-multiply"
          />
        </li>
      ))}
    </ul>
  );
}

/** El número del ranking, sobrio: sin trofeos ni colores de podio. */
export function Rank({ n, className }: { n: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-card px-2 text-label-sm text-foreground tabular-nums shadow-sm",
        className,
      )}
    >
      {n}
    </span>
  );
}
