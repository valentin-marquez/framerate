import type { StoreDefinition } from "./adapter";
import { createAlltecAdapter } from "./alltec";
import { createEylstoreAdapter } from "./eylstore";
import { createJumpsellerAdapter } from "./jumpseller";
import { createMyShopAdapter } from "./myshop";
import { createPcExpressAdapter } from "./pc-express";
import { createPcFactoryAdapter } from "./pcfactory";
import { createPrestaShopAdapter } from "./prestashop";
import { createSpDigitalAdapter } from "./spdigital";
import { createTecnomasAdapter } from "./tecnomas";
import { createTecnoSagaAdapter } from "./tecnosaga";
import { createWeiAdapter } from "./wei";
import { createWinpyAdapter } from "./winpy";
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
        case: ["gabinetes-s-fuente"],
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
    // 429 en cpu_cooler y case_fan en cada ciclo: la cola corre dos categorías a la vez y 1000 ms por corrida son 2 requests/s.
    minIntervalMs: 2500,
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
    // Responde 403 a las IPs de Cloudflare desde el 01-10-2026: sale por el relay (#81, #154).
    egress: "relay",
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
  {
    slug: "tecnoshopping",
    name: "Tecno Shopping",
    url: "https://www.tecnoshopping.cl",
    minIntervalMs: 1000,
    // El captcha de SiteGround bloquea la IP de los Workers (05-10-2026): sale por el relay (#154).
    egress: "relay",
    adapter: createWooCommerceAdapter({
      // Con www: el apex redirige sin conservar la ruta y la API terminaba en la home HTML.
      baseUrl: "https://www.tecnoshopping.cl",
      // Mezcla MPN y UPC (el adaptador usa el UPC como GTIN).
      sku: "mpn",
      // `price` es tarjeta; la ficha muestra transferencia −3,47 % (verificado en la ficha, oct. 2026).
      cashDiscount: 0.0347,
      // Sin SSD ni HDD ("almacenamiento" mezcla NAS y vigilancia), ni case (sólo un rack de redes) ni case_fan (vacía).
      categories: {
        gpu: ["tarjetas-graficas"],
        cpu: ["procesadores"],
        motherboard: ["placas-madre"],
        ram: ["memorias-ram"],
        psu: ["fuentes-de-poder"],
        cpu_cooler: ["refrigeracion"],
      },
    }),
  },
  {
    slug: "wei",
    name: "Wei",
    url: "https://www.wei.cl",
    minIntervalMs: 1000,
    adapter: createWeiAdapter({
      baseUrl: "https://www.wei.cl",
      // Tarjeta = transferencia / 0,95 (verificado en la ficha, oct. 2026). Su "Refrigeración | Ventiladores"
      // (1162) trae ventiladores de gabinete y de CPU: `normalize` separa por título.
      categories: {
        gpu: ["1305"],
        cpu: ["886", "1117"],
        motherboard: ["1272", "1126"],
        ram: ["1238"],
        psu: ["1222", "890"],
        ssd: ["1243", "515"],
        hdd: ["511"],
        case: ["1219", "729"],
        cpu_cooler: ["1162"],
        case_fan: ["1162"],
      },
    }),
  },
  {
    slug: "tecnosaga",
    name: "Tecno Saga",
    url: "https://tecnosaga.cl",
    // 429 en 6 categorías por ciclo con 1000 ms: todas pegan al mismo `listadoajax` y la cola corre varias a la vez.
    minIntervalMs: 2500,
    adapter: createTecnoSagaAdapter({
      baseUrl: "https://tecnosaga.cl",
      // "categoría/subcategoría". Sin HDD ni SSD (vacías). Sin la 8/53 "fuente genérica".
      categories: {
        gpu: ["8/91"],
        cpu: ["8/66", "8/67"],
        motherboard: ["8/63", "8/64"],
        ram: ["10/73"],
        psu: ["8/52"],
        case: ["8/55", "8/54"],
        cpu_cooler: ["8/68"],
        case_fan: ["8/68"],
      },
    }),
  },
  {
    slug: "eylstore",
    name: "Eylstore",
    url: "https://www.eylstore.cl",
    minIntervalMs: 1000,
    adapter: createEylstoreAdapter({
      baseUrl: "https://www.eylstore.cl",
      // Los dos precios vienen en la API (tarjeta = transferencia × 1,05). "tarjetas-de-video" trae también soportes, risers y cables.
      // Sin placas madre ni SSD: casi nunca traen MPN y quedarían duplicadas.
      categories: {
        gpu: ["tarjetas-de-video"],
        cpu: ["procesadores"],
        ram: ["memorias-ram"],
        psu: ["fuentes-de-poder"],
        case: ["gabinetes"],
        cpu_cooler: ["por-aire", "liquida"],
      },
    }),
  },
  {
    slug: "winpy",
    name: "Winpy",
    url: "https://www.winpy.cl",
    // Limita por IP (Cloudflare, ~12 por minuto, 429 sin Retry-After) y las IPs de los Workers son compartidas: sale por
    // el relay (#154). Desde ahí, a 5 s daba 429 en 3 de 30 fichas (10-10-2026); a 6 s los reintentos lo cubren.
    egress: "relay",
    minIntervalMs: 6000,
    adapter: createWinpyAdapter({
      baseUrl: "https://www.winpy.cl",
      // "tarjetas-de-video" y "tarjetas-graficas" son la misma lista. "disco-duro-pc-s" estaba vacía (oct. 2026).
      categories: {
        gpu: ["partes-y-piezas/tarjetas-graficas"],
        cpu: ["partes-y-piezas/procesadores"],
        motherboard: ["partes-y-piezas/placas-madres"],
        ram: ["memorias/ram-computadores"],
        psu: ["partes-y-piezas/fuente-de-poder"],
        ssd: ["almacenamiento/disco-estado-solido"],
        hdd: ["almacenamiento/disco-duro-pc-s"],
        case: ["partes-y-piezas/gabinetes"],
      },
    }),
  },
  {
    slug: "spdigital",
    name: "SP Digital",
    url: "https://www.spdigital.cl",
    // Corta las IPs de Cloudflare (403 de su WAF); desde el relay responde. `robots.txt` pide `Crawl-delay: 5`.
    egress: "relay",
    minIntervalMs: 5000,
    adapter: createSpDigitalAdapter({
      baseUrl: "https://www.spdigital.cl",
      // Las subcategorías de /categories/componentes, sin RAM de notebook, cables, adaptadores ni modding.
      categories: {
        gpu: [
          "componentes-tarjeta-de-video-tarjeta-video-nvidia",
          "componentes-tarjeta-de-video-tarjeta-video-amd",
          "tarjeta-de-video-intel",
        ],
        cpu: ["componentes-procesador-procesador-intel", "componentes-procesador-procesador-amd"],
        motherboard: ["componentes-placa-madre-placa-intel", "componentes-placa-madre-placa-amd"],
        ram: ["componentes-memorias-ram-memoria-ram-pc"],
        psu: ["componentes-fuente-de-poder-fuentes-de-poder"],
        ssd: ["componentes-almacenamiento-ssd-unidad-estado-solido"],
        hdd: ["componentes-almacenamiento-hdd-disco-duro-mecanico"],
        cpu_cooler: [
          "componentes-refrigeracion-y-ventilacion-refrigeracion-liquida",
          "componentes-refrigeracion-y-ventilacion-disipador-cpu",
        ],
        case: ["componentes-gabinetes-mid-tower--atx", "componentes-gabinetes-micro-atx--mini-itx"],
        case_fan: ["componentes-refrigeracion-y-ventilacion-ventilador-gabinete"],
      },
    }),
  },
  {
    slug: "centrale",
    name: "Centrale",
    url: "https://centrale.cl",
    adapter: createWooCommerceAdapter({
      baseUrl: "https://centrale.cl",
      // SKU interno numérico ("65673"); marca en `brands`. Sin precio tarjeta: la ficha HTML tiene anti-scraping y
      // Turnstile y no se lee; sólo la Store API (10-10-2026).
      sku: "internal",
      // Su robots.txt prohíbe `/*category=`; se filtra igual por decisión del dueño (11-10-2026).
      categories: {
        gpu: ["tarjetas-graficas-para-pc"],
        cpu: ["procesadores-para-pc"],
        motherboard: ["placas-madres-para-pc"],
        ram: ["memorias-ram-para-pc"],
        psu: ["fuentes-de-poder-para-pc"],
        // Mezcla SSD, HDD (NAS y vigilancia), bahías y adaptadores: `normalize` los aparta.
        ssd: ["almacenamiento-para-pc"],
        hdd: ["almacenamiento-para-pc"],
        cpu_cooler: ["coolers-de-aire", "refrigeracion-liquida"],
        case: ["gabinetes-para-pc"],
        case_fan: ["ventiladores"],
      },
    }),
  },
  {
    slug: "playfactory",
    name: "Play Factory",
    url: "https://playfactory.cl",
    adapter: createWooCommerceAdapter({
      baseUrl: "https://playfactory.cl",
      // SKU interno de 14 dígitos ("75250562420620"): ~1 de cada 10 pasa el checksum GTIN sin serlo. Un solo precio:
      // Webpay = transferencia = `price`; `regular_price` es el "antes" (verificado en la ficha, 10-10-2026).
      sku: "internal",
      skuGtin: false,
      categories: {
        gpu: ["tarjeta-de-video"],
        cpu: ["procesadores-componentes"],
        motherboard: ["placa-madre"],
        ram: ["memoria-ram"],
        psu: ["fuente-de-poder"],
        ssd: ["almacenamiento"],
        // Mezcla disipadores, AIO y ventiladores: `normalize` los separa.
        cpu_cooler: ["refrigeracion-y-ventilacion"],
        case: ["gabinetes-pc"],
        case_fan: ["refrigeracion-y-ventilacion"],
      },
    }),
  },
  {
    slug: "cintegral",
    name: "Cintegral",
    url: "https://cintegral.cl",
    adapter: createWooCommerceAdapter({
      baseUrl: "https://cintegral.cl",
      // SKU = prefijo interno + MPN ("ETVAS90YV0LD0-M0AA00"): no se recorta. Marca en `brands`. Un solo precio ("Todo
      // Medio de Pago"); `regular_price` es el tachado (verificado en la ficha, 10-10-2026).
      sku: "internal",
      categories: {
        gpu: ["tarjetas-de-video"],
        cpu: ["procesadores"],
        motherboard: ["placa-madre"],
        ram: ["memorias-pc"],
        psu: ["fuentes-de-poder"],
        ssd: ["ssd"],
        hdd: ["discos-duros-pc"],
        cpu_cooler: ["ventiladores-y-water-cooling"],
        case: ["gabinetes"],
        case_fan: ["ventiladores-y-water-cooling"],
      },
    }),
  },
  {
    slug: "rstech",
    name: "RS Tech",
    url: "https://rstech.cl",
    adapter: createWooCommerceAdapter({
      baseUrl: "https://rstech.cl",
      // SKU mixto: EAN (se usa como GTIN), códigos propios ("NWGVORW") y modelos sin guion ("TRSP850").
      sku: "internal",
      // `price` = transferencia; "Banchile Pagos" (tarjetas) +2 % (verificado en 3 fichas, 10-10-2026).
      cardMarkup: 0.02,
      // Sin las categorías "… PC Armado": piezas genéricas del configurador con precios de mejora.
      categories: {
        gpu: ["tarjetas-de-video"],
        cpu: ["procesadores"],
        motherboard: ["placa-madre-motherboard"],
        ram: ["memoria-ram"],
        psu: ["fuentes-de-poder"],
        ssd: ["disco-duro-y-almacenamiento"],
        cpu_cooler: ["aire", "liquida", "bulk"],
        case: ["gabinetes"],
        case_fan: ["ventiladores"],
      },
    }),
  },
  {
    slug: "megabytes",
    name: "MegaBytes",
    url: "https://www.megabytes.cl",
    minIntervalMs: 1000,
    // El captcha de SiteGround bloquea la IP de los Workers: sale por el relay (#154).
    egress: "relay",
    adapter: createWooCommerceAdapter({
      // Con www: el apex redirige. Las fichas cuelgan de /sitio-nuevo/ (los permalink ya lo traen).
      baseUrl: "https://www.megabytes.cl",
      // SKU interno numérico ("11267"), sin marca en la API.
      sku: "internal",
      // `price` = transferencia; "Tarjetas de débito o crédito" +3,36 % (verificado en 3 fichas, 10-10-2026).
      cardMarkup: 0.0336,
      // Sin refrigeración ("ventilacion" mezcla AIO, ventiladores, pasta y pads) ni HDD (sólo trae SSD y pendrives).
      categories: {
        gpu: ["tarjetas-graficas"],
        cpu: ["procesador"],
        motherboard: ["placa-madre"],
        ram: ["memorias"],
        psu: ["fuentes-de-poder"],
        ssd: ["almacenamiento"],
        case: ["gabinetes"],
      },
    }),
  },
  {
    slug: "natcom",
    name: "Natcom",
    url: "https://natcomchile.cl",
    adapter: createWooCommerceAdapter({
      baseUrl: "https://natcomchile.cl",
      // SKU interno; el MPN va en el título entre corchetes o paréntesis. `regular_price` = "antes" y la ficha no
      // muestra precio tarjeta (verificado, 10-10-2026): sin recargo.
      sku: "internal",
      categories: {
        gpu: ["tarjetas-de-video"],
        cpu: ["procesadores"],
        motherboard: ["placa-madre"],
        ram: ["pc-escritorio"],
        psu: ["fuentes-de-poder"],
        ssd: ["discos-ssd"],
        hdd: ["discos-duros"],
        // Su "Ventiladores" son disipadores de CPU.
        cpu_cooler: ["refrigeracion"],
        case: ["gabinetes"],
      },
    }),
  },
  {
    slug: "cafedigital",
    name: "Café Digital",
    url: "https://cafedigital.cl",
    adapter: createWooCommerceAdapter({
      baseUrl: "https://cafedigital.cl",
      // SKU = nombre de modelo ("MAG A1000GLS PCIE5"). El precio "Webpay" va escrito a mano en la descripción y no es
      // uniforme (+2,5 %, +4,5 % y valores viejos, 10-10-2026): sin recargo.
      sku: "internal",
      categories: {
        gpu: ["tarjetas-de-video"],
        cpu: ["procesadores"],
        motherboard: ["placas-madre"],
        ram: ["memorias-ram-pc"],
        psu: ["fuentes-de-poder-certificadas"],
        ssd: ["discos-ssd"],
        hdd: ["disco-duro-pc-hdd"],
        cpu_cooler: ["cooler-cpu", "refrigeracion-liquida"],
        case: ["gabinetes-pc"],
        case_fan: ["ventiladores"],
      },
    }),
  },
  {
    slug: "trulu",
    name: "Trulu Store",
    url: "https://trulustore.cl",
    adapter: createWooCommerceAdapter({
      baseUrl: "https://trulustore.cl",
      // SKU = prefijo + MPN ("GPU-PRIME-RTX5080-O16G"): no se recorta. Tarjeta +5 % (verificado en 5 fichas, 10-10-2026).
      sku: "internal",
      cardMarkup: 0.05,
      // Las piezas de sus PC armados (`…-PC`, `…-PC-COSTO0`) salen como productos a precio de costo o 0, con ficha noindex.
      skipSku: /-PC(-|$)/,
      categories: {
        gpu: ["tarjetas-de-video"],
        cpu: ["procesadores"],
        motherboard: ["placas-madre"],
        ram: ["ddr4", "ddr5"],
        psu: ["fuentes-de-poder"],
        ssd: ["disco-ssd-2-5", "disco-ssd-m-2"],
        cpu_cooler: ["refrigeracion-aire", "refrigeracion-liquida"],
        case: ["gabinetes"],
        case_fan: ["ventiladores"],
      },
    }),
  },
  {
    slug: "budini",
    name: "Electrónica Budini",
    url: "https://electronicabudini.cl",
    // Responde 403 a las IPs de Cloudflare y 200 desde una red residencial (10-10-2026): sale por el relay (#154).
    egress: "relay",
    adapter: createWooCommerceAdapter({
      baseUrl: "https://electronicabudini.cl",
      // SKU vacío; el MPN va en el título entre corchetes o paréntesis. Sin precio tarjeta en la ficha (10-10-2026).
      sku: "internal",
      categories: {
        gpu: ["tarjetas-de-video"],
        cpu: ["procesadores"],
        motherboard: ["placas-madre"],
        ram: ["memoria-ram-pc"],
        psu: ["fuentes-de-poder"],
        ssd: ["discos-de-estado-solido-ssd"],
        // Mezcla AIO y disipadores de aire.
        cpu_cooler: ["ventiladores-y-sistemas-de-enfriamiento"],
        case: ["gabinetes-gamer"],
      },
    }),
  },
  {
    slug: "dazbog",
    name: "DazBog Store",
    url: "https://www.dazbogstore.cl",
    adapter: createWooCommerceAdapter({
      // Con www: el apex redirige.
      baseUrl: "https://www.dazbogstore.cl",
      // SKU = MPN (en Gigabyte, el código abreviado "B650M A ELITE AX ICE", que es el que usan las demás tiendas).
      sku: "mpn",
      // `price` = transferencia; "Webpay Plus" +3 % (verificado en 3 fichas, 11-10-2026). Mercado Pago (+8,5 %) no se usa.
      cardMarkup: 0.03,
      categories: {
        gpu: ["gpus"],
        cpu: ["cpu"],
        motherboard: ["placas-madre"],
        ram: ["ram"],
        psu: ["psu"],
        ssd: ["ssd"],
        cpu_cooler: ["cooler-cpu"],
        case: ["gabinete"],
        case_fan: ["ventiladores"],
      },
    }),
  },
  {
    slug: "globalbox",
    name: "Globalbox",
    url: "https://globalbox.cl",
    minIntervalMs: 1000,
    // El captcha de SiteGround bloquea la IP de los Workers: sale por el relay (#154).
    egress: "relay",
    adapter: createWooCommerceAdapter({
      baseUrl: "https://globalbox.cl",
      // SKU = MPN; la marca va en `brands`.
      sku: "mpn",
      // `price` = "Otros medios de pago"; "Pago con transferencia" −4,6 % (verificado en 3 fichas, 11-10-2026; la
      // tienda redondea a ...90, así que difiere hasta ~50 pesos).
      cashDiscount: 0.046,
      // Sin "sata-sas-y-ssd-para-servidor" (SSD y SAS de servidor HPE/Dell). GPU, gabinetes y ventiladores salen vacíos
      // en la API y la única placa es una E1-6010 integrada.
      categories: {
        cpu: ["procesadores"],
        ram: ["memorias-ram"],
        psu: ["fuentes-de-alimentacion"],
        ssd: ["unidades-de-estado-solido"],
        hdd: ["discos-duros-internos"],
        cpu_cooler: ["refrigeracion-cpu"],
      },
    }),
  },
  {
    slug: "fiestalan",
    name: "Fiestalan",
    url: "https://fiestalan.cl",
    // Su robots.txt prohíbe URLs con `?` y pide Crawl-delay 60; el dueño decidió integrarla igual, con pausa de 5 s.
    minIntervalMs: 5000,
    adapter: createWooCommerceAdapter({
      baseUrl: "https://fiestalan.cl",
      // SKU abreviado propio ("msia650gn"). Un solo precio; `regular_price` es el "antes" tachado (2 fichas, 11-10-2026).
      // La Store API oculta lo agotado: RAM y HDD hoy salen vacías.
      sku: "internal",
      categories: {
        gpu: ["tarjetas-de-video"],
        cpu: ["procesadores"],
        motherboard: ["motherboard"],
        ram: ["ddr4", "ddr4-3000mhz", "ddr5"],
        psu: ["fuentes-de-poder"],
        ssd: ["ssd", "m2", "nvme"],
        hdd: ["hdd-almacenamiento"],
        cpu_cooler: ["cooler-cpu", "water-cooling"],
        case: ["gabinetes-gabinetes"],
        case_fan: ["ventiladores"],
      },
    }),
  },
  {
    slug: "notebooksya",
    name: "Notebooksya",
    url: "https://notebooksya.cl",
    adapter: createWooCommerceAdapter({
      baseUrl: "https://notebooksya.cl",
      // SKU mixto: MPN, códigos de mayorista ("CS000ASU31") y números propios. `price` = transferencia; "Webpay -
      // Mercado Pago" +4,5 % (verificado en 2 fichas, 11-10-2026).
      sku: "internal",
      cardMarkup: 0.045,
      // Todos los componentes van en una categoría plana ("partes-y-piezas-ya"); el tipo está en este atributo.
      attribute: "pa_producto-partes-y-piezas",
      categories: {
        gpu: ["tarjeta-de-video"],
        cpu: ["procesadores"],
        motherboard: ["placa-madre"],
        ram: ["memoria-ram-para-pc"],
        psu: ["fuente-de-poder"],
        ssd: ["disco-estado-solido-ssd"],
        // Mezcla disipadores, AIO y ventiladores: `normalize` los separa.
        cpu_cooler: ["refrigeracion"],
        case: ["gabinetes"],
        case_fan: ["ventiladores", "refrigeracion"],
      },
    }),
  },
  {
    slug: "kdtec",
    name: "KDTEC",
    url: "https://kdtec.cl",
    // Desde la red residencial (la del relay) no abre ni el TCP; desde los Workers responde (19-10-2026).
    // La Store API responde en ~1 s, pero algunas fichas dan 524 tras dos minutos: el listado no las pide.
    minIntervalMs: 5000,
    adapter: createWooCommerceAdapter({
      baseUrl: "https://kdtec.cl",
      // SKU mixto: MPN y códigos de mayorista ("VC407ASU73"). El MPN real va en la fila "Número de parte" de la
      // descripción, que el adaptador lee. Tarjeta de crédito o débito +2,2 % (verificado en 2 fichas, 19-10-2026).
      sku: "internal",
      cardMarkup: 0.022,
      categories: {
        gpu: ["tarjetas-video"],
        cpu: ["procesadores"],
        motherboard: ["placas-madre"],
        ram: ["memorias-ram"],
        psu: ["fuentes-poder", "fuentes-gamer"],
        ssd: ["disco-ssd"],
        hdd: ["disco-duro-interno"],
        // Mezcla disipadores, AIO, ventiladores y pasta térmica: `normalize` los separa.
        cpu_cooler: ["refrigeracion"],
        case: ["gabinetes"],
        case_fan: ["refrigeracion"],
      },
    }),
  },
  {
    slug: "bookcomputer",
    name: "Bookcomputer",
    url: "https://www.bookcomputer.cl",
    minIntervalMs: 1000,
    adapter: createJumpsellerAdapter({
      baseUrl: "https://www.bookcomputer.cl",
      // Mezcla MPN, UPC, códigos propios ("BFC001", "HDD005") y basura ("1"); sin marca ni código de barras.
      sku: "internal",
      // Precio único; el tachado es el "antes" (verificado en la ficha, 11-10-2026).
      // Sin RAM (casi todo reacondicionado u Optane) ni cpu_cooler (los AIO están en gabinetes y fuentes). Sin ssd:
      // "Almacenamiento" mezcla discos y SSD, y `normalize` deja pasar los HDD como SSD (al revés sí los aparta).
      categories: {
        gpu: ["partes-y-piezas/tarjeta-de-video"],
        cpu: ["procesadores"],
        motherboard: ["placas-madres"],
        psu: ["fuentes-de-poder"],
        // Mezcla reacondicionados, externos y SSD: `normalize` los aparta.
        hdd: ["almacenamiento"],
        case: ["gabienete"],
      },
      // Los dos AIO de BitFenix figuran en "Fuentes de Poder" y en "Gabinetes".
      exclude: { psu: ["Gabinetes"], case: ["Fuentes de Poder"] },
    }),
  },
  {
    slug: "ugstore",
    name: "UG Store",
    url: "https://www.ugstore.cl",
    minIntervalMs: 1000,
    adapter: createJumpsellerAdapter({
      baseUrl: "https://www.ugstore.cl",
      // SKU interno ("FUE-MSI-0002"); el código de barras es el EAN (en CPU AMD, el OPN "100-000000457").
      sku: "internal",
      // El precio publicado es "otros medios de pago"; transferencia = precio × 0,968 (verificado en la ficha, 11-10-2026).
      cashDiscount: 0.032,
      categories: {
        gpu: ["tarjeta-de-video"],
        cpu: ["procesadores"],
        motherboard: ["placas-madre"],
        ram: ["memorias"],
        psu: ["fuentes-de-poder"],
        ssd: ["almacenamiento/ssd"],
        // Mezcla AIO y ventiladores: `normalize` aparta los ventiladores.
        cpu_cooler: ["refrigeracion"],
        case: ["gabinetes"],
      },
      // Un AIO figura también en "Tarjetas de Video".
      exclude: { gpu: ["Refrigeración"] },
    }),
  },
  {
    slug: "mdstore",
    name: "Mercado Store",
    url: "https://www.mdstore.cl",
    minIntervalMs: 1000,
    adapter: createJumpsellerAdapter({
      baseUrl: "https://www.mdstore.cl",
      // SKU propio ("MS02910"); el código de barras es el EAN en la mayoría.
      sku: "internal",
      // Precio único (Getnet y Mercado Pago, sin precio transferencia; verificado en 2 fichas, 11-10-2026).
      // Sin GPU, CPU, RAM ni SSD: la tienda no los vende.
      categories: {
        motherboard: ["componentes-de-pc/placas-madre"],
        psu: ["fuentes-de-poder"],
        case: ["gabinetes"],
        // "Disipador CPU" trae también brackets de montaje: `normalize` los aparta.
        cpu_cooler: ["refrigeracion/disipador-cpu", "refrigeracion-liquida"],
        case_fan: ["refrigeracion/ventiladores-pc"],
      },
    }),
  },
  {
    slug: "invasiongamer",
    name: "Invasión Gamer",
    url: "https://invasiongamer.com",
    minIntervalMs: 1000,
    adapter: createJumpsellerAdapter({
      baseUrl: "https://invasiongamer.com",
      // SKU casi siempre vacío (2 de 34 con MPN); la marca sí viene.
      sku: "internal",
      // El precio publicado es el de tarjeta; un script de la ficha calcula transferencia = precio / 1,07 cerrado
      // hacia abajo a ...900, así que el precio transferencia puede quedar hasta $999 sobre el real (verificado en 2
      // fichas, 11-10-2026).
      cashDiscount: 1 - 1 / 1.07,
      categories: {
        gpu: ["componentes-pc/tarjetas-de-video"],
        cpu: ["procesadores"],
        motherboard: ["placas-madres"],
        // "Memorias RAM Laptop" (SO-DIMM) se deja fuera.
        ram: ["memorias-ram/memoria-ram-desktop"],
        psu: ["componentes-pc/fuentes-de-poder"],
        ssd: ["componentes-pc/ssd-y-almacenamiento"],
        cpu_cooler: ["componentes-pc/refrigeracion"],
        case: ["componentes-pc/gabinetes"],
      },
    }),
  },
  {
    slug: "sipo",
    name: "SIPO Online",
    url: "https://sipoonline.cl",
    minIntervalMs: 1000,
    adapter: createJumpsellerAdapter({
      baseUrl: "https://sipoonline.cl",
      // SKU = EAN del fabricante en casi todo (OPN/MPN en algunas CPU); unos pocos códigos propios en Kronos y
      // accesorios. El código de barras a veces trae el MPN en vez del EAN.
      sku: "mpn",
      // El precio publicado (con la promoción ya aplicada) es "otros medios de pago"; el tema calcula transferencia =
      // precio × 0,94 (verificado en 2 fichas, 11-10-2026).
      cashDiscount: 0.06,
      // Sin case_fan: "Ventiladores PC" no tiene stock. RAM sólo de escritorio.
      categories: {
        gpu: ["componentes-pc/tarjeta-de-video"],
        cpu: ["componentes-pc/procesadores"],
        motherboard: ["componentes-pc/placas-madre"],
        ram: ["componentes-pc/ram/ddr4-pc-escritorio", "componentes-pc/ram/ddr5-pc-escritorio"],
        psu: ["componentes-pc/fuentes-de-poder"],
        ssd: ["componentes-pc/unidad-de-estado-solido-ssd"],
        cpu_cooler: ["componentes-pc/cooler-cpu/disipador-por-aire", "componentes-pc/cooler-cpu/refrigeracion-liquida"],
        case: ["componentes-pc/gabinete"],
      },
      // "Placas Madre" trae adaptadores de panel frontal y soportes de GPU.
      exclude: { motherboard: ["Pernos, adaptadores y cables", "Soporte para GPU"] },
    }),
  },
  {
    slug: "lancenter",
    name: "Lancenter",
    url: "https://tienda.lancenter.cl",
    minIntervalMs: 1000,
    adapter: createPrestaShopAdapter({
      baseUrl: "https://tienda.lancenter.cl",
      // MPN casi siempre; a veces un UPC (se detecta como GTIN) o un código propio ("A12 240", "AM0-818").
      reference: "mpn",
      // `price_amount` es "Precio tarjeta débito / crédito"; "Precio efectivo / transferencia" −3,5 % (verificado en
      // la ficha, 11-10-2026). La tienda redondea el .5 hacia arriba: puede quedar 1 peso por debajo.
      cashDiscount: 0.035,
      // Sin cpu_cooler, case ni case_fan: "Gabinetes y refrigeración" mezcla gabinetes, AIO, ventiladores y pasta, y
      // `normalize` no aparta gabinetes de coolers ni AIO de gabinetes. Los usados van en las mismas categorías y
      // `normalize` los aparta.
      categories: {
        gpu: ["30-tarjetas-de-video"],
        cpu: ["31-procesadores"],
        motherboard: ["35-placa-madre"],
        ram: ["23-memorias-ram"],
        psu: ["50-fuentes-de-poder"],
        // Mezcla SSD, pendrives, microSD y discos externos: `normalize` los aparta.
        ssd: ["34-almacenamiento"],
      },
    }),
  },
  {
    slug: "alltec",
    name: "AllTec",
    url: "https://www.alltec.cl",
    minIntervalMs: 1000,
    adapter: createAlltecAdapter({
      baseUrl: "https://www.alltec.cl",
      // Los padres (17, 16, 18) sólo traen cables y accesorios; los usados están aparte en 120-seminuevos.
      categories: {
        gpu: ["63-amd", "64-nvidia"],
        cpu: ["28-amd", "29-intel"],
        motherboard: ["31-para-amd", "79-para-intel"],
        ram: ["37-ddr4", "117-ddr5", "102-ddr4"],
        psu: ["38-potencia-nominal-estandar", "80-potencia-realcertificadas"],
        ssd: ["34-ssd"],
        hdd: ["33-mecanicos-rigidos"],
        case: ["81-sin-fuente-de-poder", "82-con-fuente-de-poder"],
        cpu_cooler: ["92-water-cooling", "93-cpu-cooler"],
        case_fan: ["91-chassis-fan-ventiladores"],
      },
    }),
  },
];

export function findStore(slug: string): StoreDefinition | undefined {
  return STORES.find((s) => s.slug === slug);
}
