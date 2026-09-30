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
import type { Product } from "~/features/product/services/products";

/** Hasta tres especificaciones que identifican el producto dentro de su categoría (para tarjetas). */
export function getSpecsSummary(product: Product): string[] {
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
        s.cores?.total ? `${s.cores.total} núcleos` : null,
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

  return summary
    .filter((item): item is string | number => !!item && item !== "Desconocido")
    .map(String)
    .slice(0, 3);
}
