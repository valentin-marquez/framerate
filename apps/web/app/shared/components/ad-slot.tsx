import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "~/shared/lib/utils";

const AD_CLIENT = "ca-pub-9835660497171893";
const SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Unidad responsiva de AdSense rotulada "Anuncio": toma el ancho que le dé la columna y el alto va fijo por CSS (sin
 * `data-ad-format`, AdSense respeta el tamaño del `<ins>`), para que el anuncio no empuje la página al llegar.
 */
export function AdSlot({ slot, className = "h-[100px] @3xl:h-[90px]" }: { slot: string; className?: string }) {
  // El script entra después de hidratar: si viene en el HTML, mete el suyo en el <head> y React no lo reconoce.
  const pushed = useRef(false);
  useEffect(() => {
    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const script = document.createElement("script");
      script.async = true;
      script.src = SCRIPT_SRC;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }
    // StrictMode corre el efecto dos veces en desarrollo: un segundo push con el <ins> ya ocupado lanza TagError, y como
    // sale del efecto tumbaba la página entera. Un fallo de AdSense nunca debe llegar al usuario.
    if (pushed.current) return;
    pushed.current = true;
    try {
      window.adsbygoogle = window.adsbygoogle ?? [];
      window.adsbygoogle.push({});
    } catch {}
  }, []);

  return (
    <aside aria-label="Anuncio" className="min-w-0 space-y-1">
      <p className="text-label-xs text-muted-foreground">Anuncio</p>
      {/* El aviso queda debajo del anuncio: lo tapa si carga y se ve si un bloqueador lo oculta o no hay anuncio. */}
      <div className={cn("relative", className)}>
        <p className="absolute inset-0 flex items-center justify-center rounded-xl border border-border border-dashed bg-card px-6 text-balance text-center text-muted-foreground text-paragraph-xs">
          Este espacio ayuda a que Framerate siga siendo gratis. Si te sirve, considera permitir anuncios aquí.
        </p>
        {/* Sin anuncio que servir, AdSense deja un iframe en blanco encima del aviso: un bloque blanco en modo oscuro. */}
        <ins
          className="adsbygoogle relative block size-full overflow-hidden rounded-xl data-[ad-status=unfilled]:hidden"
          data-ad-client={AD_CLIENT}
          data-ad-slot={slot}
        />
      </div>
    </aside>
  );
}

/**
 * Un bloque y el anuncio a su derecha. Responde al ancho de la columna (con el riel abierto o plegado), no al de la
 * pantalla: si no caben los dos, el anuncio baja.
 */
export function WithAd({ slot, children }: { slot: string; children: ReactNode }) {
  return (
    <div className="@container">
      <div className="grid gap-4 @3xl:grid-cols-[minmax(0,3fr)_minmax(16rem,2fr)] @3xl:items-end @3xl:gap-8">
        <div className="min-w-0">{children}</div>
        <AdSlot slot={slot} />
      </div>
    </div>
  );
}
