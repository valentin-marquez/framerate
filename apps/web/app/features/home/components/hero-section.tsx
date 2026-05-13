import { IconArrowRight, IconDeviceDesktop, IconSparkles } from "@tabler/icons-react";
import { Link } from "react-router";
import { Badge } from "~/shared/components/primitives/badge";
import { Button } from "~/shared/components/primitives/button";
import { Separator } from "~/shared/components/primitives/separator";

interface HeroSectionProps {
  totalProducts: number;
  totalCategories: number;
}

export function HeroSection({ totalProducts, totalCategories }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/4 size-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 size-96 bg-chart-2/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 pt-8 pb-16 md:pt-12 md:pb-24">
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto space-y-6">
          <Badge variant="outline" className="px-4 py-1.5 text-xs font-medium border-primary/20 bg-primary/5">
            <IconSparkles className="size-3.5 mr-1.5 text-primary" />
            Compara precios en tiempo real
          </Badge>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
            Arma tu PC al <span className="text-primary">mejor precio</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl">
            Encuentra los mejores precios de hardware en Chile. Compara ofertas de múltiples tiendas y crea cotizaciones
            inteligentes para tu próximo build.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
            <Button
              size="lg"
              className="h-12 px-8 text-base rounded-xl"
              render={
                <Link to="/explorar" prefetch="intent">
                  <IconDeviceDesktop className="size-5 mr-2" />
                  Explorar productos
                </Link>
              }
            />
            <Button
              variant="outline"
              size="lg"
              className="h-12 px-8 text-base rounded-xl"
              render={
                <Link to="/categoria/tarjetas-de-video" prefetch="intent">
                  Ver ofertas
                  <IconArrowRight className="size-4 ml-2" />
                </Link>
              }
            />
          </div>

          {/* Stats */}
          <div className="flex items-center gap-8 pt-8">
            <div className="flex flex-col items-center">
              <span className="text-2xl md:text-3xl font-bold text-foreground">{totalProducts.toLocaleString()}+</span>
              <span className="text-xs text-muted-foreground">Productos</span>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div className="flex flex-col items-center">
              <span className="text-2xl md:text-3xl font-bold text-foreground">{totalCategories}</span>
              <span className="text-xs text-muted-foreground">Categorías</span>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div className="flex flex-col items-center">
              <span className="text-2xl md:text-3xl font-bold text-foreground">10+</span>
              <span className="text-xs text-muted-foreground">Tiendas</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
