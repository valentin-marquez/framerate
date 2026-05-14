import type {
  CaseFanSpecs,
  CaseSpecs,
  CpuCoolerSpecs,
  CpuSpecs,
  GpuSpecs,
  HddSpecs,
  MotherboardSpecs,
  PsuSpecs,
  RamSpecs,
  SsdSpecs,
} from "@framerate/db";
import { IconEye } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { AddToQuote } from "~/features/product/components/add-to-quote";
import type { Product } from "~/features/product/services/products";
import { productsService } from "~/features/product/services/products";
import { AsyncImage } from "~/shared/components/primitives/async-image";
import { Badge } from "~/shared/components/primitives/badge";

import { productKeys } from "~/shared/lib/query-keys";
import { cn } from "~/shared/lib/utils";
import { getImageUrl } from "~/shared/utils/images";

import { PsuBadge } from "./psu-badge";

interface ProductCardProps {
  product: Product;
  className?: string;
  priority?: boolean;
}

function getSpecsSummary(product: Product): string[] {
  const { category, specs } = product;
  if (!category || !specs) return [];

  let summary: (string | undefined | null | number)[] = [];

  switch (category.slug) {
    case "tarjetas-de-video": {
      const s = specs as GpuSpecs;
      summary = [s.chipset, s.memory_gb ? `${s.memory_gb}GB` : null, s.memory_type];
      break;
    }
    case "procesadores": {
      const s = specs as CpuSpecs;
      summary = [
        s.cores?.total ? `${s.cores.total} Cores` : null,
        s.clocks?.boost_ghz ? `${s.clocks.boost_ghz}GHz` : null,
        s.socket,
      ];
      break;
    }
    case "memorias-ram": {
      const s = specs as RamSpecs;
      summary = [
        s.total_capacity_gb ? `${s.total_capacity_gb}GB` : null,
        s.type,
        s.speed_mt_s ? `${s.speed_mt_s}MHz` : null,
      ];
      break;
    }
    case "ssd": {
      const s = specs as SsdSpecs;
      summary = [s.capacity_gb ? `${s.capacity_gb}GB` : null, s.form_factor, s.interface];
      break;
    }
    case "discos-duros": {
      const s = specs as HddSpecs;
      summary = [
        s.capacity_gb ? `${s.capacity_gb}GB` : null,
        s.rpm ? `${s.rpm} RPM` : null,
        s.cache_mb ? `${s.cache_mb}MB` : null,
      ];
      break;
    }
    case "placas-madre": {
      const s = specs as MotherboardSpecs;
      summary = [s.socket, s.chipset, s.form_factor];
      break;
    }
    case "fuentes-de-poder": {
      const s = specs as PsuSpecs;
      summary = [s.wattage ? `${s.wattage}W` : null, s.efficiency_rating, s.modular];
      break;
    }
    case "gabinetes": {
      const s = specs as CaseSpecs;
      summary = [s.form_factor, s.side_panel];
      break;
    }
    case "coolers-cpu": {
      const s = specs as CpuCoolerSpecs;
      summary = [
        s.type,
        s.radiator_size_mm
          ? `${s.radiator_size_mm}mm`
          : s.fan_size_mm
            ? `${s.fan_size_mm}mm`
            : s.height_mm
              ? `${s.height_mm}mm`
              : null,
      ];
      break;
    }
    case "ventiladores": {
      const s = specs as CaseFanSpecs;
      summary = [s.size_mm ? `${s.size_mm}mm` : null, s.rpm?.max ? `${s.rpm.max} RPM` : null, s.rgb ? "RGB" : null];
      break;
    }
  }

  return summary.filter((item): item is string => !!item && item !== "Desconocido").map(String);
}

function formatViews(views: number): string {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}k`;
  return views.toString();
}

export function ProductCard({ product, className, priority = false }: ProductCardProps) {
  const queryClient = useQueryClient();
  const currentPrice = product.prices?.cash || product.prices?.normal;
  const normalPrice = product.prices?.normal;
  const discount =
    currentPrice && normalPrice && currentPrice !== normalPrice
      ? Math.round((1 - currentPrice / normalPrice) * 100)
      : 0;

  const specsSummary = getSpecsSummary(product);
  const hasViews = product.popularity_score && product.popularity_score > 0;

  // Lógica PSU
  const isPsu = product.category?.slug === "fuentes-de-poder";
  const psuSpecs = isPsu ? (product.specs as PsuSpecs | null) : null;
  const psuCertification = psuSpecs?.efficiency_rating ?? null;

  const handleProductClick = () => {
    if (product.slug) {
      productsService.trackView(product.slug).catch((err: unknown) => console.error("Failed to track view", err));
    }
  };

  const handlePrefetch = () => {
    const slug = product.slug;
    if (slug) {
      queryClient.prefetchQuery({
        queryKey: productKeys.detail(slug),
        queryFn: () => productsService.getBySlug(slug),
        staleTime: 60_000,
      });
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
        onMouseEnter={handlePrefetch}
        onFocus={handlePrefetch}
        aria-label={`Ver detalles de ${product.name}`}
        className="relative w-full overflow-hidden bg-card block h-48 sm:h-56 md:h-60"
      >
        {product.image_url ? (
          <AsyncImage
            src={getImageUrl(product.image_url)}
            alt={product.name || "Imagen del producto"}
            className="size-full object-cover"
            priority={priority}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
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
              <IconEye className="size-3" />
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
                  <span className="text-xs text-muted-foreground line-through decoration-muted-foreground">
                    ${normalPrice.toLocaleString("es-CL")}
                  </span>
                )}
              </div>
              <AddToQuote product={product} className="size-9" />
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
