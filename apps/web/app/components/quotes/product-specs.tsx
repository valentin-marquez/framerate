import type { Product } from "~/utils/db-types";

export function ProductSpecs({ product }: { product: Product }) {
  if (!product.specs || !product.category) return null;

  const category = product.category.slug;
  const items: string[] = [];

  switch (category) {
    case "procesadores": {
      const specs = product.specs as any;
      if (specs.cores?.total) items.push(`${specs.cores.total} Cores`);
      else if (specs.cores_threads) items.push(specs.cores_threads);

      if (specs.clocks?.boost_ghz) items.push(`${specs.clocks.boost_ghz} GHz`);
      else if (specs.frequency) items.push(specs.frequency);

      if (specs.socket) items.push(specs.socket);
      break;
    }
    case "tarjetas-de-video": {
      const specs = product.specs as any;
      if (specs.memory_gb) items.push(`${specs.memory_gb}GB`);
      else if (specs.memory) items.push(specs.memory);

      if (specs.memory_type) items.push(specs.memory_type);
      break;
    }
    case "placas-madre": {
      const specs = product.specs as any;
      if (specs.socket) items.push(specs.socket);
      if (specs.chipset) items.push(specs.chipset);
      if (specs.form_factor) items.push(specs.form_factor);
      break;
    }
    case "memorias-ram": {
      const specs = product.specs as any;
      if (specs.total_capacity_gb) items.push(`${specs.total_capacity_gb}GB`);
      else if (specs.capacity) items.push(specs.capacity);

      if (specs.type) items.push(specs.type);

      if (specs.speed_mt_s) items.push(`${specs.speed_mt_s} MT/s`);
      else if (specs.speed) items.push(specs.speed);

      if (specs.cas_latency) items.push(`CL${specs.cas_latency}`);
      else if (specs.latency_cl) items.push(specs.latency_cl);
      break;
    }
    case "fuentes-de-poder": {
      const specs = product.specs as any;
      if (specs.wattage) items.push(`${specs.wattage}W`);
      if (specs.efficiency_rating) items.push(specs.efficiency_rating);
      else if (specs.certification) items.push(specs.certification);

      if (specs.modular) items.push(specs.modular);
      break;
    }
    case "gabinetes": {
      const specs = product.specs as any;
      if (specs.form_factor) items.push(specs.form_factor);
      else if (specs.max_motherboard_size) items.push(specs.max_motherboard_size);

      if (specs.side_panel) items.push(specs.side_panel);
      break;
    }
    case "ssd": {
      const specs = product.specs as any;
      if (specs.capacity_gb) items.push(`${specs.capacity_gb}GB`);
      else if (specs.capacity) items.push(specs.capacity);

      if (specs.form_factor) items.push(specs.form_factor);
      else if (specs.format) items.push(specs.format);

      if (specs.interface) items.push(specs.interface);
      else if (specs.bus) items.push(specs.bus);
      break;
    }
    case "discos-duros": {
      const specs = product.specs as any;
      if (specs.capacity_gb) items.push(`${specs.capacity_gb}GB`);
      else if (specs.capacity) items.push(specs.capacity);

      if (specs.rpm) items.push(`${specs.rpm} RPM`);
      break;
    }
    case "coolers-cpu": {
      const specs = product.specs as any;
      if (specs.type) items.push(specs.type);
      if (specs.radiator_size_mm) items.push(`Radiador ${specs.radiator_size_mm}mm`);
      else if (specs.fan_size_mm) items.push(`Fan ${specs.fan_size_mm}mm`);
      else if (specs.height_mm) items.push(`H: ${specs.height_mm}mm`);
      else if (specs.height) items.push(`H: ${specs.height}`);
      break;
    }
    case "ventiladores": {
      const specs = product.specs as any;
      if (specs.size_mm) items.push(`${specs.size_mm}mm`);
      else if (specs.size) items.push(specs.size);

      if (specs.rpm?.max) items.push(`${specs.rpm.max} RPM`);
      else if (specs.rpm && typeof specs.rpm !== "object") items.push(specs.rpm);

      if (specs.rgb) items.push("RGB");
      else if (specs.illumination && specs.illumination !== "No") items.push(specs.illumination);
      break;
    }
  }

  if (items.length === 0) return null;

  return <div className="text-xs text-muted-foreground mt-0.5 truncate">{items.join(" • ")}</div>;
}
