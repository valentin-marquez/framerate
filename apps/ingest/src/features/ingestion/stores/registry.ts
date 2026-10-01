import type { StoreDefinition } from "./adapter";
import { createJumpsellerAdapter } from "./jumpseller";
import { createMyShopAdapter } from "./myshop";
import { createPcExpressAdapter } from "./pc-express";
import { createPcFactoryAdapter } from "./pcfactory";
import { createPrestaShopAdapter } from "./prestashop";
import { createTecnomasAdapter } from "./tecnomas";
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
    slug: "nuevatec",
    name: "Nuevatec",
    url: "https://nuevatec.cl",
    adapter: createWooCommerceAdapter({
      baseUrl: "https://nuevatec.cl",
      sku: "mpn",
      // `price` es Webpay; transferencia −5 % (verificado en la ficha, sept. 2026).
      cashDiscount: 0.05,
      categories: {
        gpu: ["tarjetas-de-video"],
        cpu: ["procesadores"],
        motherboard: ["placas-madres"],
        ram: ["memorias-ram"],
        psu: ["fuentes-de-poder"],
        ssd: ["m2-nvme", "ssd-2-5"],
        hdd: ["disco-hdd"],
        cpu_cooler: ["refrigeracion-aire-cpu", "refrigeracion-liquida-cpu"],
        case: ["gabinetes"],
        case_fan: ["ventiladores-gabinete"],
      },
    }),
  },
  {
    slug: "cclink",
    name: "CCLink",
    url: "https://cclink.cl",
    adapter: createWooCommerceAdapter({
      baseUrl: "https://cclink.cl",
      // MPN del fabricante o UPC (este último se detecta como GTIN).
      sku: "mpn",
      // Tarjeta +5 % (verificado en la ficha, sept. 2026).
      cardMarkup: 0.05,
      categories: {
        gpu: ["tarjetas-de-video"],
        cpu: ["procesadores"],
        motherboard: ["placa-madre"],
        ram: ["ram"],
        psu: ["fuente-de-poder"],
        ssd: ["ssd"],
        hdd: ["discos-duros-internos"],
        cpu_cooler: ["cooler-cpu"],
        case: ["gabinetes", "gabinetes-gamer"],
        case_fan: ["ventiladores"],
      },
    }),
  },
  {
    slug: "progaming",
    name: "Progaming",
    url: "https://progaming.cl",
    adapter: createWooCommerceAdapter({
      baseUrl: "https://progaming.cl",
      // El SKU es el EAN: se detecta como GTIN.
      sku: "internal",
      // Tarjeta +5 % (verificado en la ficha, sept. 2026).
      cardMarkup: 0.05,
      categories: {
        gpu: ["tarjetas-video"],
        cpu: ["procesadores-componentes"],
        motherboard: ["placas-madres"],
        ram: ["memorias-ram-componentes"],
        psu: ["fuentes-poder"],
        ssd: ["almacenamiento-componentes"],
        // Mezcla coolers y ventiladores: `normalize` aparta los ventiladores.
        cpu_cooler: ["refrigeracion"],
        case: ["gabinetes-componentes"],
      },
    }),
  },
  {
    slug: "central-gamer",
    name: "Central Gamer",
    url: "https://centralgamer.cl",
    adapter: createWooCommerceAdapter({
      baseUrl: "https://centralgamer.cl",
      sku: "internal",
      // `price` es tarjeta; "Transferencia bancaria directa (5 % de descuento)" (verificado en la ficha, sept. 2026).
      cashDiscount: 0.05,
      categories: {
        gpu: ["tarjetas-de-video"],
        cpu: ["procesadores"],
        motherboard: ["placas-madre"],
        ram: ["memorias-ram"],
        psu: ["fuentes-de-poder"],
        ssd: ["almacenamiento"],
        cpu_cooler: ["refrigeracion-pc"],
        case: ["gabinetes-gamer"],
      },
    }),
  },
  {
    slug: "pcfactory",
    name: "PC Factory",
    url: "https://www.pcfactory.cl",
    minIntervalMs: 1000,
    adapter: createPcFactoryAdapter({
      categories: {
        gpu: ["334", "378", "454"],
        cpu: ["272", "1142", "1307"],
        motherboard: ["292", "1143", "1308"],
        ram: ["112"],
        psu: ["54"],
        ssd: ["585"],
        hdd: ["340"],
        cpu_cooler: ["648"],
        case: ["326"],
        case_fan: ["647"],
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
  {
    slug: "mybox",
    name: "MyBox",
    url: "https://mybox.cl",
    minIntervalMs: 1000,
    adapter: createPrestaShopAdapter({
      baseUrl: "https://mybox.cl",
      reference: "mpn",
      // `price_amount` es tarjeta; "5 % OFF adicional pagando por transferencia" (verificado en la ficha, sept. 2026).
      cashDiscount: 0.05,
      categories: {
        gpu: ["68-tarjeta-de-video"],
        cpu: ["64-procesador"],
        motherboard: ["65-placa-madre"],
        ram: ["66-memoria-ram"],
        psu: ["63-fuentes-de-poder"],
        // 67-almacenamiento mezcla SSD y HDD; sus subcategorías no.
        ssd: ["84-ssd", "85-m2"],
        hdd: ["86-hdd"],
        cpu_cooler: ["92-enfriamiento-refrigeracion"],
        case: ["62-gabinetes"],
        case_fan: ["89-ventiladores-fans"],
      },
    }),
  },
  {
    slug: "todoclick",
    name: "Todoclick",
    url: "https://todoclick.cl",
    minIntervalMs: 1000,
    adapter: createPrestaShopAdapter({
      baseUrl: "https://todoclick.cl",
      // MPN casi siempre; a veces un UPC (se detecta como GTIN) o, en productos viejos, un MPN truncado.
      reference: "mpn",
      // `price_amount` es el "Precio Khipu" (transferencia); "Otros medios de pago" +1,7 % (verificado en la ficha,
      // sept. 2026).
      cardMarkup: 0.017,
      categories: {
        gpu: ["tarjetas-de-video-549"],
        cpu: ["procesadores-450"],
        motherboard: ["placa-madre-449"],
        ram: ["memoria-ram-pc-465"],
        psu: ["fuentes-de-poder-446"],
        ssd: ["ssd-unidad-de-estado-solido-445"],
        hdd: ["hdd-disco-duro-mecanico-555"],
        cpu_cooler: ["disipadores-748", "refrigeracion-liquida-473"],
        case: ["gabinetes-447"],
        case_fan: ["ventiladores-pc-474"],
      },
    }),
  },
  {
    slug: "tytgamer",
    name: "TYT Gamer",
    url: "https://tytgamer.cl/tienda",
    minIntervalMs: 1000,
    adapter: createPrestaShopAdapter({
      baseUrl: "https://tytgamer.cl/tienda",
      // La referencia es el id del producto. El listado tampoco trae la marca.
      reference: "internal",
      // Tarjeta +5 % (verificado en la ficha, sept. 2026).
      cardMarkup: 0.05,
      categories: {
        gpu: ["37-tarjetas-de-video"],
        cpu: ["130-procesadores"],
        motherboard: ["129-placas-madre"],
        ram: ["26-memorias"],
        psu: ["79-fuentes-de-poder"],
        // Sus subcategorías de SSD y HDD están vacías: todo cuelga de la raíz.
        ssd: ["24-almacenamiento"],
        cpu_cooler: ["74-procesador", "76-refrigeracion-liquida"],
        case: ["82-gabinetes"],
        case_fan: ["73-ventiladores"],
      },
    }),
  },
  {
    slug: "pc-express",
    name: "PC Express",
    url: "https://tienda.pc-express.cl",
    // HTML: listado más una ficha por producto.
    minIntervalMs: 1000,
    adapter: createPcExpressAdapter({
      baseUrl: "https://tienda.pc-express.cl",
      // Procesadores (473) incluye los coolers y Gabinetes (462) los ventiladores: se usan sus subcategorías.
      // 410 (discos de servidor) son SSD y SAS; 280 son gabinetes rack.
      categories: {
        gpu: ["475"],
        cpu: ["337", "367", "591", "603", "309", "348", "380", "583", "588", "600"],
        motherboard: ["472"],
        ram: ["126"],
        psu: ["461"],
        ssd: ["331"],
        hdd: ["101", "411", "412"],
        cpu_cooler: ["169"],
        case: ["119", "120", "278"],
        case_fan: ["170"],
      },
    }),
  },
  {
    slug: "tecnomas",
    name: "Tecnomas",
    url: "https://www.tecnomas.cl",
    // Sitio HTML: una request por ficha.
    minIntervalMs: 1000,
    adapter: createTecnomasAdapter({
      baseUrl: "https://www.tecnomas.cl",
      // Fuera mientras `normalize` no aparte lo que no es de PC (sept. 2026): "Gabinetes" son ~85 % racks, bandejas y
      // cajas IP66; "Fuentes de Poder" son mayoría fuentes industriales, PoE y de servidor. "Ventiladores y Sistemas de
      // Enfriamiento" mezcla coolers con ventiladores y `normalize` no aparta coolers de `case_fan`. "Almacenamiento"
      // mezcla SSD con pendrives y tarjetas SD que pasan como SSD.
      categories: {
        gpu: ["Tarjetas de Video"],
        cpu: ["Procesadores"],
        motherboard: ["Placas Madre"],
        ram: ["RAM"],
        ssd: ["SSD - Disco Sólido"],
        hdd: ["HDD - Disco Duros"],
        cpu_cooler: ["Ventiladores y Sistemas de Enfriamiento"],
      },
    }),
  },
  {
    slug: "notebookstore",
    name: "Notebook Store",
    url: "https://notebookstore.cl",
    minIntervalMs: 1000,
    adapter: createJumpsellerAdapter({
      baseUrl: "https://notebookstore.cl",
      sku: "mpn",
      // El precio publicado es "otros medios de pago"; transferencia = precio × 0,966 (verificado en la ficha, sept. 2026).
      cashDiscount: 0.034,
      categories: {
        gpu: ["equipos/componentes-informaticos/tarjetas-de-video"],
        cpu: ["equipos/componentes-informaticos/procesadores"],
        motherboard: ["equipos/componentes-informaticos/tarjetas-y-placas-madre"],
        ram: ["equipos/memorias/ram-para-pc-y-servidores"],
        psu: ["equipos/componentes-informaticos/fuentes-de-poder"],
        ssd: ["equipos/almacenamiento/discos-de-estado-solido"],
        hdd: ["equipos/almacenamiento/discos-duros-internos"],
        // Mezcla coolers y ventiladores: `normalize` aparta los ventiladores.
        cpu_cooler: ["equipos/componentes-informaticos/ventiladores-y-sistemas-de-enfriamiento"],
        case: ["cajas/gabinetes"],
      },
      exclude: { hdd: ["Discos de Estado Sólido"] },
    }),
  },
  {
    slug: "thundertech",
    name: "Thundertech",
    url: "https://www.thundertech.cl",
    minIntervalMs: 1000,
    adapter: createJumpsellerAdapter({
      baseUrl: "https://www.thundertech.cl",
      // MPN o el modelo del fabricante ("B650 GAMING PLUS WIFI"); el código de barras es el EAN/UPC.
      sku: "mpn",
      // El precio publicado es Webpay; transferencia = precio / 1,0578 (verificado en 5 fichas, sept. 2026). Con
      // descuento de producto la ficha difiere en hasta 6 pesos.
      cashDiscount: 1 - 1 / 1.0578,
      categories: {
        gpu: ["tarjeta-de-video"],
        cpu: ["procesador"],
        motherboard: ["placa-madre"],
        ram: ["memoria-ram-pc"],
        psu: ["componentes/fuentes-de-poder"],
        ssd: ["disco-estado-solido"],
        hdd: ["disco-duro-pcs"],
        cpu_cooler: ["componentes/disipadores"],
      },
    }),
  },
  {
    slug: "tecnocam",
    name: "Tecnocam",
    url: "https://www.tecnocam.cl",
    minIntervalMs: 1000,
    adapter: createJumpsellerAdapter({
      baseUrl: "https://www.tecnocam.cl",
      // Casi siempre el MPN; a veces un código propio ("TC-SSD-…") o un ASIN de Amazon, que sólo impide el vínculo.
      sku: "mpn",
      // Precio único (verificado en la ficha, sept. 2026).
      categories: {
        cpu: ["procesadores"],
        ram: ["memoria-ram"],
        ssd: ["ssd"],
      },
    }),
  },
  {
    slug: "valrod",
    name: "Valrod",
    url: "https://valrod.cl",
    minIntervalMs: 1000,
    adapter: createJumpsellerAdapter({
      baseUrl: "https://valrod.cl",
      // Part number de Cougar ("31AT075001P01") o modelo de MSI.
      sku: "mpn",
      // Precio único (verificado en la ficha, sept. 2026).
      categories: {
        psu: ["hardware/fuentes-de-poder"],
        cpu_cooler: ["hardware/enfriadores-liquidos"],
        case: ["gabinetes"],
        case_fan: ["hardware/ventiladores"],
      },
    }),
  },
  {
    slug: "vgamers",
    name: "V Gamers",
    url: "https://www.vgamers.cl",
    minIntervalMs: 1000,
    adapter: createJumpsellerAdapter({
      baseUrl: "https://www.vgamers.cl",
      // SKU interno ("77826332441153"); el código de barras sí es el EAN.
      sku: "internal",
      // El precio publicado es "otros medios de pago"; transferencia = precio × 0,97 (verificado en la ficha, sept. 2026).
      cashDiscount: 0.03,
      // Sin case_fan: "Ventiladores PC" mezcla AIO y disipadores.
      categories: {
        cpu: ["hardware/procesadores"],
        motherboard: ["hardware/placas-madres"],
        ram: ["hardware-1/memorias-ram"],
        psu: ["hardware-1/fuentes-de-poder"],
        ssd: ["hardware-1/almacenamiento/discos"],
        cpu_cooler: ["hardware-1/refrigeracion/refrigeracion-liquida", "hardware-1/refrigeracion/disipador-cpu"],
        case: ["hardware-1/gabinetes-gamer"],
      },
      // Un gabinete figura también en "Refrigeración Líquida".
      exclude: { cpu_cooler: ["Gabinetes Gamer"] },
    }),
  },
];

export function findStore(slug: string): StoreDefinition | undefined {
  return STORES.find((s) => s.slug === slug);
}
