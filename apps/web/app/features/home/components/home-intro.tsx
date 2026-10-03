import { enterClass, enterStyle } from "~/shared/lib/initial-load";
import { cn } from "~/shared/lib/utils";

interface HomeIntroProps {
  productCount: number;
  storeCount: number;
}

/** Encabezado mínimo: dice qué es el sitio con cifras reales y deja los precios en el primer pliegue. */
export function HomeIntro({ productCount, storeCount }: HomeIntroProps) {
  return (
    <section className="space-y-1 pt-4 pb-8 md:pb-10">
      <h1 className={cn("font-semibold text-2xl text-foreground tracking-tight md:text-3xl", enterClass())}>
        Hardware al <span className="text-primary">mejor precio</span>
      </h1>
      <p className={cn("text-muted-foreground text-sm md:text-base", enterClass())} style={enterStyle(80)}>
        {productCount > 0 && storeCount > 0
          ? `${productCount} productos de ${storeCount} tiendas de Chile, actualizados cada 6 horas.`
          : "Precios de tiendas de Chile, actualizados cada 6 horas."}
      </p>
    </section>
  );
}
