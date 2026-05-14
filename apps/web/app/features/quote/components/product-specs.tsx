import type {
  CaseFanSpecs,
  CaseSpecs,
  CpuCoolerSpecs,
  CpuSpecs,
  GpuSpecs,
  MotherboardSpecs,
  PsuSpecs,
  RamSpecs,
  StorageSpecs,
} from "@framerate/db";
import type { Product } from "~/shared/utils/db-types";

export function ProductSpecs({ product }: { product: Product }) {
  if (!product.specs || !product.category) return null;

  const category = product.category.slug;
  const items: string[] = [];

  switch (category) {
    case "procesadores": {
      const specs = product.specs as CpuSpecs;
      if (specs.cores?.total) items.push(`${specs.cores.total} Cores`);
      if (specs.clocks?.boost_ghz) items.push(`${specs.clocks.boost_ghz} GHz`);
      if (specs.socket) items.push(specs.socket);
      break;
    }
    case "tarjetas-de-video": {
      const specs = product.specs as GpuSpecs;
      if (specs.memory_gb) items.push(`${specs.memory_gb}GB`);
      if (specs.memory_type) items.push(specs.memory_type);
      break;
    }
    case "placas-madre": {
      const specs = product.specs as MotherboardSpecs;
      if (specs.socket) items.push(specs.socket);
      if (specs.chipset) items.push(specs.chipset);
      if (specs.form_factor) items.push(specs.form_factor);
      break;
    }
    case "memorias-ram": {
      const specs = product.specs as RamSpecs;
      if (specs.total_capacity_gb) items.push(`${specs.total_capacity_gb}GB`);
      if (specs.type) items.push(specs.type);
      if (specs.speed_mt_s) items.push(`${specs.speed_mt_s} MT/s`);
      if (specs.cas_latency) items.push(`CL${specs.cas_latency}`);
      break;
    }
    case "fuentes-de-poder": {
      const specs = product.specs as PsuSpecs;
      if (specs.wattage) items.push(`${specs.wattage}W`);
      if (specs.efficiency_rating) items.push(specs.efficiency_rating);
      if (specs.modular) items.push(specs.modular);
      break;
    }
    case "gabinetes": {
      const specs = product.specs as CaseSpecs;
      if (specs.form_factor) items.push(specs.form_factor);
      if (specs.side_panel) items.push(specs.side_panel);
      break;
    }
    case "ssd": {
      const specs = product.specs as StorageSpecs;
      if (specs.capacity_gb) items.push(`${specs.capacity_gb}GB`);
      if (specs.form_factor) items.push(specs.form_factor);
      if (specs.interface) items.push(specs.interface);
      break;
    }
    case "discos-duros": {
      const specs = product.specs as StorageSpecs;
      if (specs.capacity_gb) items.push(`${specs.capacity_gb}GB`);
      if (specs.rpm) items.push(`${specs.rpm} RPM`);
      break;
    }
    case "coolers-cpu": {
      const specs = product.specs as CpuCoolerSpecs;
      if (specs.type) items.push(specs.type);
      if (specs.radiator_size_mm) items.push(`Radiador ${specs.radiator_size_mm}mm`);
      else if (specs.fan_size_mm) items.push(`Fan ${specs.fan_size_mm}mm`);
      else if (specs.height_mm) items.push(`H: ${specs.height_mm}mm`);
      break;
    }
    case "ventiladores": {
      const specs = product.specs as CaseFanSpecs;
      if (specs.size_mm) items.push(`${specs.size_mm}mm`);
      if (specs.rpm?.max) items.push(`${specs.rpm.max} RPM`);
      if (specs.rgb) items.push("RGB");
      break;
    }
  }

  if (items.length === 0) return null;

  return <div className="text-xs text-muted-foreground mt-0.5 truncate">{items.join(" • ")}</div>;
}
