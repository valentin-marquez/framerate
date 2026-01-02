import type { PsuSpecs } from "@framerate/db";
import { IconEye } from "@tabler/icons-react";
import { Link } from "react-router";
import { Badge } from "~/components/primitives/badge";
import { AddToQuote } from "~/components/product/add-to-quote";
import { cn } from "~/lib/utils";
import type { Product } from "~/services/products";
import { productsService } from "~/services/products";
import { PsuBadge } from "./psu-badge";

interface ProductCardProps {
  product: Product;
  className?: string;
}

function getSpecsSummary(product: Product): string[] {
  const { category, specs } = product;
  if (!category || !specs) return [];

  const s = specs as Record<string, string | undefined | null>;
  let summary: (string | undefined | null)[] = [];

  switch (category.slug) {
    case "gpu":
      summary = [s.gpu_model, s.memory, s.memory_type];
      break;
    case "cpu":
      summary = [s.cores_threads, s.frequency, s.socket];
      break;
    case "ram":
      summary = [s.capacity, s.type, s.speed];
      break;
    case "ssd":
      summary = [s.capacity, s.format, s.bus];
      break;
    case "hdd":
      summary = [s.capacity, s.rpm, s.cache];
      break;
    case "motherboard":
      summary = [s.socket, s.chipset, s.form_factor];
      break;
    case "psu":
      summary = [s.wattage, s.certification, s.modular];
      break;
    case "case":
      summary = [s.form_factor, s.side_panel, s.max_motherboard_size];
      break;
    case "cpu-cooler":
      summary = [s.type, s.fan_size || s.height, s.tdp];
      break;
    case "case-fan":
      summary = [s.size, s.rpm, s.illumination];
      break;
    default: {
      const genericKeys = ["capacity", "type", "size", "model"];
      summary = genericKeys.map((key) => s[key]).filter(Boolean);
      break;
    }
  }

  return summary.filter((item): item is string => !!item && item !== "Desconocido");
}

function formatViews(views: number): string {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}k`;
  return views.toString();
}

export function ProductCard({ product, className }: ProductCardProps) {
  const currentPrice = product.prices?.cash || product.prices?.normal;
  const normalPrice = product.prices?.normal;
  const discount =
    currentPrice && normalPrice && currentPrice !== normalPrice
      ? Math.round((1 - currentPrice / normalPrice) * 100)
      : 0;

  const specsSummary = getSpecsSummary(product);
  const hasViews = product.popularity_score && product.popularity_score > 0;

  // Lógica PSU
  const isPsu = product.category?.name;
  const psuCertification = isPsu ? (product.specs as PsuSpecs)?.certification : null;

  const handleProductClick = () => {
    if (product.slug) {
      productsService.trackView(product.slug).catch((err) => console.error("Failed to track view", err));
    }
  };

  return (
    <div
      className={cn(
        "group/card relative flex flex-col overflow-hidden rounded-xl h-105 md:h-100",
        "bg-card/70 border border-border",
        "hover:border-border transition-all duration-300 ease-in-out",
        className,
      )}
    >
      <Link
        to={`/producto/${product.slug}`}
        onClick={handleProductClick}
        className="relative w-full overflow-hidden bg-card block h-48 sm:h-56 md:h-60"
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name || "Imagen del producto"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-muted-foreground text-sm">Sin imagen</span>
          </div>
        )}

        {psuCertification && (
          <div className="absolute top-3 left-3 z-10">
            <PsuBadge certification={psuCertification} />
          </div>
        )}

        {discount > 0 && (
          <Badge className="absolute top-3 right-3 rounded-full bg-primary/90 px-2.5 py-1 text-xs font-medium z-10">
            -{discount}%
          </Badge>
        )}
      </Link>

      <div className="flex flex-col gap-2 p-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          {product.brand?.name && (
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {product.brand.name}
            </span>
          )}

          {hasViews && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
              <IconEye className="h-3 w-3" />
              <span className="font-medium">{formatViews(product.popularity_score)}</span>
            </div>
          )}
        </div>

        <h3 className="line-clamp-2 text-sm font-medium text-foreground group-hover/card:text-primary transition-colors duration-200 min-h-[2.5em] overflow-hidden">
          <Link to={`/producto/${product.slug}`} onClick={handleProductClick} className="hover:underline">
            {product.name}
          </Link>
        </h3>

        {specsSummary.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {specsSummary.slice(0, 3).map((spec, _index) => (
              <span
                key={`${spec}`}
                className="text-xs px-2 py-0.5 rounded-md bg-secondary/50 text-secondary-foreground truncate max-w-full"
                title={spec}
              >
                {spec}
              </span>
            ))}
          </div>
        )}

        {currentPrice ? (
          <div className="mt-auto pt-3 border-t border-border/50">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-semibold text-primary">${currentPrice.toLocaleString("es-CL")}</span>
                {discount > 0 && normalPrice && (
                  <span className="text-xs text-muted-foreground line-through">
                    ${normalPrice.toLocaleString("es-CL")}
                  </span>
                )}
              </div>
              <AddToQuote product={product} className="h-9 w-9" />
            </div>
          </div>
        ) : (
          <div className="mt-auto pt-3 border-t border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Ver tiendas</span>
              <AddToQuote product={product} className="size-9" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
