import { IconArrowRight, IconFlame } from "@tabler/icons-react";
import { Link } from "react-router";
import { SectionHeader } from "~/features/home/components/section-header";
import { ProductCard } from "~/features/product/components/card-product";
import { Button } from "~/shared/components/primitives/button";
import { useTranslation } from "~/shared/hooks/use-translation";
import type { Product } from "~/shared/utils/db-types";

interface PopularProductsProps {
  products: Product[];
  totalProducts: number;
}

export function PopularProducts({ products, totalProducts }: PopularProductsProps) {
  const { t } = useTranslation();

  if (products.length === 0) {
    return (
      <section className="container mx-auto px-4">
        <SectionHeader
          icon={<IconFlame className="size-5" />}
          title={t("popular_products")}
          description={t("popular_products_desc")}
        />
        <div className="flex items-center justify-center py-20 rounded-2xl bg-card/50 border border-border/40">
          <p className="text-muted-foreground">{t("no_products")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="container mx-auto px-4">
      <SectionHeader
        icon={<IconFlame className="size-5" />}
        title={t("popular_products")}
        description={t("popular_products_desc")}
        badge={{ label: `${totalProducts.toLocaleString()} productos`, variant: "secondary" }}
        action={totalProducts > products.length ? { label: t("view_all"), href: "/explorar" } : undefined}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {products.slice(0, 20).map((product, index) => (
          <ProductCard key={product.id} product={product} priority={index < 10} />
        ))}
      </div>

      {products.length > 20 && (
        <div className="flex justify-center mt-8">
          <Button
            variant="secondary"
            size="lg"
            className="rounded-xl"
            render={
              <Link to="/explorar" prefetch="intent">
                Ver más productos
                <IconArrowRight className="size-4 ml-2" />
              </Link>
            }
          ></Button>
        </div>
      )}
    </section>
  );
}
