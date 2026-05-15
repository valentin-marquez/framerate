import type {
  CaseFanSpecs,
  CaseSpecs,
  CpuCoolerSpecs,
  CpuSpecs,
  GpuSpecs,
  HddSpecs,
  MotherboardSpecs,
  ProductSpecs,
  PsuSpecs,
  RamSpecs,
  SsdSpecs,
} from "@framerate/db";
import { IconEye } from "@tabler/icons-react";
import { Link } from "react-router";
import { AddToQuote } from "~/features/product/components/add-to-quote";
import { type ProductDrop, productsService } from "~/features/product/services/products";
import { AsyncImage } from "~/shared/components/primitives/async-image";
import { Badge } from "~/shared/components/primitives/badge";
import { Button } from "~/shared/components/primitives/button";
import { cn } from "~/shared/lib/utils";
import { getImageUrl } from "~/shared/utils/images";

const clpDropFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
});

interface CardProductDropProps {
  drop: ProductDrop;
  className?: string;
}

function getSpecsSummary(categorySlug: string, specs: ProductSpecs | null): string[] {
  if (!categorySlug || !specs) return [];

  let summary: (string | undefined | null | number)[] = [];

  switch (categorySlug) {
    case "tarjetas-de-video": {
      const s = specs as GpuSpecs;
      summary = [s.chipset, s.memory_gb ? `${s.memory_gb}GB` : null];
      break;
    }
    case "procesadores": {
      const s = specs as CpuSpecs;
      summary = [
        s.cores?.total ? `${s.cores.total} Cores` : null,
        s.clocks?.boost_ghz ? `${s.clocks.boost_ghz}GHz` : null,
      ];
      break;
    }
    case "memorias-ram": {
      const s = specs as RamSpecs;
      summary = [s.total_capacity_gb ? `${s.total_capacity_gb}GB` : null, s.type];
      break;
    }
    case "ssd": {
      const s = specs as SsdSpecs;
      summary = [s.capacity_gb ? `${s.capacity_gb}GB` : null, s.form_factor];
      break;
    }
    case "discos-duros": {
      const s = specs as HddSpecs;
      summary = [s.capacity_gb ? `${s.capacity_gb}GB` : null, s.rpm ? `${s.rpm} RPM` : null];
      break;
    }
    case "placas-madre": {
      const s = specs as MotherboardSpecs;
      summary = [s.socket, s.chipset, s.form_factor];
      break;
    }
    case "fuentes-de-poder": {
      const s = specs as PsuSpecs;
      summary = [s.wattage ? `${s.wattage}W` : null, s.efficiency_rating];
      break;
    }
    case "gabinetes": {
      const s = specs as CaseSpecs;
      summary = [s.form_factor, s.side_panel];
      break;
    }
    case "coolers-cpu": {
      const s = specs as CpuCoolerSpecs;
      summary = [s.type, s.radiator_size_mm ? `${s.radiator_size_mm}mm` : s.fan_size_mm ? `${s.fan_size_mm}mm` : null];
      break;
    }
    case "ventiladores": {
      const s = specs as CaseFanSpecs;
      summary = [s.size_mm ? `${s.size_mm}mm` : null, s.rgb ? "RGB" : null];
      break;
    }
  }

  const result: string[] = [];
  for (const item of summary) {
    if (!item || item === "Desconocido") continue;
    result.push(String(item));
  }
  return result;
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

  const formattedCurrentPrice = clpDropFormatter.format(current_price);
  const formattedPreviousPrice = clpDropFormatter.format(previous_price);

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
          src={getImageUrl(product_image_url) || undefined}
          alt={product_name}
          className="size-full object-cover shadow-sm rounded-inherit dark:brightness-75"
          loading="lazy"
        />
      </Link>

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
              Ahorras {clpDropFormatter.format(previous_price - current_price)}
            </Badge>
          </div>

          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 font-bold">
            -{Math.round(discount_percentage)}%
          </Badge>
        </div>

        <h3
          className="mb-2 line-clamp-2 text-sm font-semibold tracking-tight leading-tight min-h-[2.5em] group-hover:text-primary transition-colors"
          title={product_name}
        >
          <Link to={productLink} onClick={handleProductClick}>
            {product_name}
          </Link>
        </h3>

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
              <span className="text-sm font-semibold text-muted-foreground leading-none mt-1 line-through decoration-muted-foreground">
                {formattedPreviousPrice}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size={"lg"}
              className="flex-1 inline-flex rounded-inherit items-center justify-center gap-2 bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-all hover:bg-primary/90"
            >
              <Link to={productLink}>
                <IconEye className="size-3.5" />
                Ver producto
              </Link>
            </Button>
            <AddToQuote product={{ id: product_id }} />
          </div>
        </div>
      </div>
    </div>
  );
}
