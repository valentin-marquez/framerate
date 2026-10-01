import type { StoreDefinition } from "./adapter";
import { createMyShopAdapter } from "./myshop";
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
      // SKU interno ("0307002A03N-2"), no del fabricante. Tarjeta +4 % (verificado en la ficha, sept. 2026).
      sku: "internal",
      cardMarkup: 0.04,
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
      // Tarjeta +7 % (verificado en la ficha, sept. 2026).
      cardMarkup: 0.07,
      categories: {
        gpu: ["tarjetas-de-video"],
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
  {
    slug: "infor-ingen",
    name: "Infor-Ingen",
    url: "https://store.infor-ingen.com",
    adapter: createWooCommerceAdapter({
      baseUrl: "https://store.infor-ingen.com",
      sku: "internal",
      // Tarjeta +6 % (verificado en la ficha, sept. 2026). `regular_price` a veces es un "antes" inflado (×1,272).
      cardMarkup: 0.06,
      categories: {
        gpu: ["t-video-pcie-nvidia", "t-video-pcie-amd"],
        cpu: ["procesadores"],
        motherboard: ["placas-madres"],
        ram: ["memorias-ram-pc"],
        psu: ["fuentes-reales"],
        ssd: ["discos-duros-ssd", "m-2", "nvme"],
        hdd: ["discos-duros-pc"],
        cpu_cooler: ["aire-cpu", "refrigeracion-liquida-cpu"],
        case: ["gabinetes"],
        case_fan: ["refrigeracion-gabinete"],
      },
    }),
  },
  {
    slug: "etchile",
    name: "ETChile",
    url: "https://etchile.net",
    adapter: createWooCommerceAdapter({
      baseUrl: "https://etchile.net",
      // Casi siempre el MPN real; algunas placas traen un código propio ("GBTB550MDS3HAC1W"). Un MPN que no
      // coincide sólo impide el vínculo automático: termina en duplicado, no en fusión errónea.
      sku: "mpn",
      // Tarjeta +5 % (verificado en la ficha, sept. 2026).
      cardMarkup: 0.05,
      categories: {
        gpu: ["tarjetas-de-video"],
        cpu: ["procesadores"],
        motherboard: ["placas-madres"],
        ram: ["memorias"],
        psu: ["psu-fuentes-de-poder"],
        ssd: ["ssd", "ssd-interno-almacenamiento-y-drives"],
        hdd: ["hdd-interno"],
        cpu_cooler: ["cpu-cooler", "water-cooling"],
        case: ["gabinetes"],
        case_fan: ["ventiladores"],
      },
    }),
  },
  {
    slug: "myshop",
    name: "MyShop",
    url: "https://myshop.cl",
    // Su Cloudflare responde 429 (error 1015) con ~1,3 requests/s sostenidas; la cola corre dos categorías a la vez.
    minIntervalMs: 2500,
    adapter: createMyShopAdapter({
      baseUrl: "https://myshop.cl",
      categories: {
        gpu: ["33"],
        cpu: ["143", "144"],
        motherboard: ["32"],
        ram: ["35"],
        psu: ["64"],
        ssd: ["136", "135"],
        hdd: ["72"],
        cpu_cooler: ["150", "151"],
        case: ["36"],
        case_fan: ["148"],
      },
    }),
  },
  {
    slug: "sandos",
    name: "Sandos",
    url: "https://sandos.cl",
    adapter: createMyShopAdapter({
      baseUrl: "https://sandos.cl",
      // 14, 6 y 9 ya incluyen sus subfamilias (Nvidia/AMD, Intel/AMD). 182 es RAM de PC: la 24 suma notebooks y servidores.
      categories: {
        gpu: ["14"],
        cpu: ["6"],
        motherboard: ["9"],
        ram: ["182"],
        psu: ["34"],
        ssd: ["146", "20"],
        hdd: ["149"],
        cpu_cooler: ["27", "28"],
        case: ["29", "39", "142"],
        case_fan: ["143"],
      },
    }),
  },
];

export function findStore(slug: string): StoreDefinition | undefined {
  return STORES.find((s) => s.slug === slug);
}
