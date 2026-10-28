import type { ProductSummary } from "@framerate/contracts";

const upper = (value: unknown) => (typeof value === "string" ? value.toUpperCase() : null);
const withUnit = (value: unknown, unit: string) => (typeof value === "number" ? `${value}${unit}` : null);

const wireless = (value: unknown) => (value === true ? "Inalámbrico" : value === false ? "Con cable" : null);

/** Hasta tres especificaciones que identifican el producto dentro de su categoría (para tarjetas). */
export function getSpecsSummary({ category, attributes: a }: Pick<ProductSummary, "category" | "attributes">) {
  const summary: Partial<Record<ProductSummary["category"], (string | null)[]>> = {
    gpu: [upper(a.chipset), withUnit(a.vram, "GB")],
    ram: [withUnit(a.capacity, "GB"), upper(a.type), withUnit(a.speed, "MHz")],
    ssd: [withUnit(a.capacity, "GB"), upper(a.interface)],
    hdd: [withUnit(a.capacity, "GB"), withUnit(a.rpm, " RPM")],
    motherboard: [upper(a.chipset), upper(a.formFactor)],
    // La certificación no va: ya la muestra el sello de la tarjeta.
    psu: [withUnit(a.wattage, "W")],
    keyboard: [wireless(a.wireless), upper(a.layout)],
    mouse: [wireless(a.wireless)],
  };
  return (summary[category] ?? []).filter((s) => s !== null).slice(0, 3);
}
