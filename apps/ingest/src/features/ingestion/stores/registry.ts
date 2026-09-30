import type { StoreDefinition } from "./adapter";
import { createWooCommerceAdapter } from "./woocommerce";

/**
 * Registro de tiendas. Agregar una tienda = agregar una entrada aquí (y su
 * adaptador si no es WooCommerce). La fila en `stores` se crea sola en el
 * primer crawl.
 *
 * Estado de verificación: los slugs de categoría vienen del sistema anterior.
 * Antes de activar en producción, verificar cada tienda con
 * `POST /v1/admin/crawls` sobre una categoría y revisar la cuarentena.
 */
export const STORES: readonly StoreDefinition[] = [
  {
    slug: "tectec",
    name: "TecTec",
    url: "https://tectec.cl",
    adapter: createWooCommerceAdapter({
      baseUrl: "https://tectec.cl",
      // PENDIENTE verificar: el sistema anterior asumía que el SKU es el MPN.
      sku: "mpn",
      categories: {
        gpu: ["tarjetas-de-video"],
        cpu: ["procesadores"],
        motherboard: ["placas-madres"],
        ram: ["memoria-ram"],
        psu: ["fuentes-de-poder"],
        ssd: ["discos-estado-solido"],
        hdd: ["discos-duro"],
        cpu_cooler: ["refrigeracion-cpu"],
      },
    }),
  },
  {
    slug: "dust2",
    name: "Dust2",
    url: "https://dust2.gg",
    adapter: createWooCommerceAdapter({
      baseUrl: "https://dust2.gg",
      // En Dust2 el SKU suele ser el código de barras (EAN): se detecta como GTIN.
      sku: "internal",
      categories: {
        cpu: ["procesadores"],
        motherboard: ["placas-madres"],
        ram: ["memorias-ram"],
        psu: ["fuentes-de-poder"],
        ssd: ["discos-m-2"],
        cpu_cooler: ["cooler-para-cpu", "refrigeracion-liquida"],
        case: ["gabinetes"],
      },
    }),
  },
];

export function findStore(slug: string): StoreDefinition | undefined {
  return STORES.find((s) => s.slug === slug);
}
