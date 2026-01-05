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
import type { Product } from "~/utils/db-types";

export function ProductSpecs({ product }: { product: Product }) {
  if (!product.specs || !product.category) return null;

  const category = product.category.slug;
  const items: string[] = [];

  switch (category) {
    case "cpu": {
      const specs = product.specs as CpuSpecs;
      if (specs.cores_threads) items.push(specs.cores_threads);
      if (specs.frequency) items.push(specs.frequency);
      if (specs.socket) items.push(specs.socket);
      break;
    }
    case "gpu": {
      const specs = product.specs as GpuSpecs;
      if (specs.memory) items.push(specs.memory);
      if (specs.bus) items.push(specs.bus);
      break;
    }
    case "motherboard": {
      const specs = product.specs as MotherboardSpecs;
      if (specs.socket) items.push(specs.socket);
      if (specs.chipset) items.push(specs.chipset);
      if (specs.form_factor) items.push(specs.form_factor);
      break;
    }
    case "ram": {
      const specs = product.specs as RamSpecs;
      if (specs.capacity) items.push(specs.capacity);
      if (specs.type) items.push(specs.type);
      if (specs.speed) items.push(specs.speed);
      if (specs.latency_cl) items.push(specs.latency_cl);
      break;
    }
    case "psu": {
      const specs = product.specs as PsuSpecs;
      if (specs.wattage) items.push(specs.wattage);
      if (specs.certification) items.push(specs.certification);
      if (specs.modular) items.push(specs.modular);
      break;
    }
    case "case": {
      const specs = product.specs as CaseSpecs;
      if (specs.max_motherboard_size) items.push(specs.max_motherboard_size);
      if (specs.side_panel) items.push(specs.side_panel);
      break;
    }
    case "ssd": {
      const specs = product.specs as SsdSpecs;
      if (specs.capacity) items.push(specs.capacity);
      if (specs.format) items.push(specs.format);
      if (specs.bus) items.push(specs.bus);
      break;
    }
    case "hdd": {
      const specs = product.specs as HddSpecs;
      if (specs.capacity) items.push(specs.capacity);
      if (specs.rpm) items.push(specs.rpm);
      break;
    }
    case "cpu-cooler": {
      const specs = product.specs as CpuCoolerSpecs;
      if (specs.type) items.push(specs.type);
      if (specs.height) items.push(`H: ${specs.height}`);
      break;
    }
    case "case-fan": {
      const specs = product.specs as CaseFanSpecs;
      if (specs.size) items.push(specs.size);
      if (specs.rpm) items.push(specs.rpm);
      if (specs.illumination && specs.illumination !== "No") items.push(specs.illumination);
      break;
    }
  }

  if (items.length === 0) return null;

  return <div className="text-xs text-muted-foreground mt-0.5 truncate">{items.join(" • ")}</div>;
}
