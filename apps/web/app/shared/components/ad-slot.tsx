import { type ReactNode, useEffect } from "react";

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
export function AdSlot({ slot }: { slot: string }) {
  // El script entra después de hidratar: si viene en el HTML, mete el suyo en el <head> y React no lo reconoce.
  useEffect(() => {
    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const script = document.createElement("script");
      script.async = true;
      script.src = SCRIPT_SRC;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }
    window.adsbygoogle = window.adsbygoogle ?? [];
    window.adsbygoogle.push({});
  }, []);

  return (
    <aside aria-label="Anuncio" className="min-w-0 space-y-1">
      <p className="text-label-xs text-muted-foreground">Anuncio</p>
      {/* El aviso queda debajo del anuncio: lo tapa si carga y se ve si un bloqueador lo oculta o no hay anuncio. */}
      <div className="relative h-[100px] @3xl:h-[90px]">
        <p className="absolute inset-0 flex items-center justify-center rounded-xl border border-border border-dashed bg-card px-6 text-balance text-center text-muted-foreground text-paragraph-xs">
          Este espacio ayuda a que Framerate siga siendo gratis. Si te sirve, considera permitir anuncios aquí.
        </p>
        <ins
          className="adsbygoogle relative block size-full overflow-hidden rounded-xl"
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
