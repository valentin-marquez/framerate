import { IconTrendingDown } from "@tabler/icons-react";
import type { ProductDrop } from "@/services/products";
import { Carousel, CarouselContent, CarouselItem, CarouselNavigation } from "~/components/primitives/carousel";
import { CardProductDrop } from "~/components/product/card-product-drop";
import { useTranslation } from "~/hooks/use-translation";
import { SectionHeader } from "./section-header";

interface PriceDropsCarouselProps {
  drops: ProductDrop[];
}

export function PriceDropsCarousel({ drops }: PriceDropsCarouselProps) {
  const { t } = useTranslation();

  if (drops.length === 0) return null;

  return (
    <section className="container mx-auto px-4">
      <SectionHeader
        icon={<IconTrendingDown className="size-5" />}
        title={t("recent_offers")}
        description={t("recent_offers_desc")}
        badge={{ label: "HOT", variant: "destructive" }}
        action={{ label: t("view_all"), href: "/ofertas" }}
      />

      <div className="relative">
        <Carousel disableDrag className="w-full">
          <CarouselContent className="-ml-4">
            {drops.map((drop) => (
              <CarouselItem key={drop.product_id} className="pl-4 basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4">
                <CardProductDrop drop={drop} className="h-full" />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselNavigation
            alwaysShow
            className="absolute -left-4 -right-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none"
            classNameButton="pointer-events-auto shadow-lg"
          />
        </Carousel>
      </div>
    </section>
  );
}
