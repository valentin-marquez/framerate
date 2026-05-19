import { useState } from "react";
import { cn } from "~/shared/lib/utils";
import { getImageUrl } from "~/shared/utils/images";

interface StoreLogoProps {
  store: { name: string; slug?: string | null; icon_url?: string | null };
  /** Controla el tamaño/estilo del cuadrado. Default `size-10`. */
  className?: string;
}

/**
 * Identidad visual consistente de una tienda: un cuadrado redondeado con el
 * icono cuadrado curado (`stores.icon_url`, apple-touch-icon/favicon — trae su
 * propio fondo) renderizado edge-to-edge. Si no hay icono o falla la carga, cae
 * a un monograma con color determinístico por slug. NO usa `logo_url`
 * (logos de header con fondos dispares) ni el flag `appearance`.
 */
export function StoreLogo({ store, className }: StoreLogoProps) {
  const [broken, setBroken] = useState(false);
  const box = cn("relative inline-flex shrink-0 overflow-hidden rounded-lg size-10", className);

  // El icono vive en nuestro bucket store-assets → se proxia por /v1/images
  // (CDN). data-uri legacy (sin migrar) se pasa tal cual.
  const iconSrc = store.icon_url
    ? store.icon_url.startsWith("data:")
      ? store.icon_url
      : getImageUrl(store.icon_url)
    : "";

  if (iconSrc && !broken) {
    return (
      <span className={cn(box, "border border-border/40 bg-secondary/30")}>
        <img
          src={iconSrc}
          alt={store.name}
          loading="lazy"
          decoding="async"
          // Iconos de terceros: sin Referer evita protecciones anti-hotlink.
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      </span>
    );
  }

  return (
    <span
      role="img"
      className={cn(box, "items-center justify-center select-none font-semibold text-white text-sm")}
      style={{ backgroundColor: `hsl(${hueFrom(store.slug || store.name)} 42% 42%)` }}
      aria-label={store.name}
      title={store.name}
    >
      {initials(store.name)}
    </span>
  );
}

function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Hash estable → hue 0..359 (mismo color siempre para la misma tienda).
function hueFrom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}
