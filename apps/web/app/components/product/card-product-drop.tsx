import { IconEye } from "@tabler/icons-react";
import { Link } from "react-router";
import { AddToQuote } from "@/components/product/add-to-quote";
import { cn } from "@/lib/utils";
import { type ProductDrop, productsService } from "@/services/products";
import type { Product } from "@/utils/db-types";
import { AsyncImage } from "../primitives/async-image";
import { Badge } from "../primitives/badge";
import { Button } from "../primitives/button";

interface CardProductDropProps {
  drop: ProductDrop;
  className?: string;
}

function getSpecsSummary(categorySlug: string, specs: any): string[] {
  if (!categorySlug || !specs) return [];

  const s = specs as Record<string, string | undefined | null>;
  let summary: (string | undefined | null)[] = [];

  switch (categorySlug) {
    case "gpu":
      summary = [s.gpu_model, s.memory];
      break;
    case "cpu":
      summary = [s.cores_threads, s.frequency];
      break;
    case "ram":
      summary = [s.capacity, s.type, s.speed];
      break;
    case "ssd":
      summary = [s.capacity, s.format, s.bus];
      break;
    case "hdd":
      summary = [s.capacity, s.rpm];
      break;
    case "motherboard":
      summary = [s.socket, s.chipset, s.form_factor];
      break;
    case "psu":
      summary = [s.wattage, s.certification];
      break;
    case "case":
      summary = [s.side_panel, s.max_motherboard_size];
      break;
    case "cpu-cooler":
      summary = [s.type, s.fan_size || s.height];
      break;
    case "case-fan":
      summary = [s.size, s.rpm, s.illumination];
      break;
  }

  return summary.filter((item): item is string => !!item && item !== "Desconocido");
}

export function CardProductDrop({ drop, className }: CardProductDropProps) {
  const {
    product_id,
    product_name,
    product_slug,
    product_image_url,
    current_price,
    previous_price,
    discount_percentage,
    store_name,
    category_slug,
    product_specs,
  } = drop;

  const productLink = `/producto/${product_slug}`;
  const specsSummary = getSpecsSummary(category_slug, product_specs);

  const handleProductClick = () => {
    if (product_slug) {
      productsService.trackView(product_slug).catch((err) => console.error("Failed to track view", err));
    }
  };

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(amount);

  const formattedCurrentPrice = formatPrice(current_price);
  const formattedPreviousPrice = formatPrice(previous_price);

  // Construct a minimal product object for AddToQuote
  const productForQuote: Product = {
    id: product_id,
    name: product_name,
    slug: product_slug,
    image_url: product_image_url,
    prices: { cash: current_price, normal: current_price },
    brand: null,
    category: { slug: category_slug, name: category_slug },
    specs: product_specs,
    popularity_score: 0,
    created_at: "",
    updated_at: "",
    mpn: null,
    group_id: null,
  };

  return (
    <div
      className={cn(
        "container rounded-container h-96 group flex flex-col overflow-hidden border-2 border-border bg-card text-card-foreground transition-all duration-300 hover:border-primary/50 relative rounded-md before:absolute before:inset-0 before:-z-1 before:rounded-[inherit] before:bg-background before:shadow-sm light:border-[0.5px] light:border-currentColor/10 dark:inset-shadow-3xs dark:inset-shadow-white/15 dark:before:inset-ring-[0.5px] dark:before:inset-ring-white/7.5",
        className,
      )}
    >
      <Link
        to={productLink}
        className="nested-p-2half relative aspect-video overflow-hidden p-2.5"
        onClick={handleProductClick}
      >
        <AsyncImage
          src={product_image_url || undefined}
          alt={product_name}
          className="h-full w-full object-cover shadow-sm rounded-inherit dark:brightness-75"
          loading="lazy"
        />
      </Link>

      {/* Content */}
      <div className="nested-p-4 flex flex-1 flex-col p-4 pt-2">
        <div className="flex mb-2 items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0.5 h-5 border-primary/20 bg-accent text-primary truncate max-w-[100px]"
            >
              {store_name}
            </Badge>
            <Badge
              variant={"outline"}
              className="text-[10px] px-2 py-0.5 h-5 border-primary/20 bg-accent text-primary truncate "
            >
              Ahorras {formatPrice(previous_price - current_price)}
            </Badge>
          </div>

          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 font-bold">
            -{Math.round(discount_percentage)}%
          </Badge>
        </div>

        {/* Title */}
        <h3
          className="mb-2 line-clamp-2 text-sm font-bold tracking-tight leading-tight min-h-[2.5em] group-hover:text-primary transition-colors"
          title={product_name}
        >
          <Link to={productLink} onClick={handleProductClick}>
            {product_name}
          </Link>
        </h3>

        {/* Specs Summary */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {specsSummary.slice(0, 3).map((spec, i) => (
            <span
              key={i + spec}
              className="text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md border border-border/50 truncate max-w-[calc(33%-8px)]"
            >
              {spec}
            </span>
          ))}
        </div>

        <div className="mt-auto pt-3 border-t border-border/50">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-medium uppercase">Oferta</span>
              <span className="text-lg font-bold text-destructive tracking-tight leading-none">
                {formattedCurrentPrice}
              </span>
            </div>
            <div className="flex flex-col items-end border-l border-border/50 pl-2">
              <span className="text-[10px] text-muted-foreground font-medium uppercase">Antes</span>
              <span className="text-sm font-semibold text-muted-foreground leading-none mt-1 line-through">
                {formattedPreviousPrice}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size={"lg"}
              className="flex-1 inline-flex rounded-inherit items-center justify-center gap-2 bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-all hover:bg-primary/90"
              asChild
            >
              <Link to={productLink}>
                <IconEye className="h-3.5 w-3.5" />
                Ver producto
              </Link>
            </Button>
            <AddToQuote product={productForQuote} />
          </div>
        </div>
      </div>
    </div>
  );
}
