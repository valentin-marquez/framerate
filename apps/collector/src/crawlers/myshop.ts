import type { Category, CategoryMap } from "@/constants/categories";
import { BaseCrawler, type ProductData } from "./base";

export interface MyShopApiResponse {
  codigo: number;
  servicio: string;
  mensaje: string;
  resultado: MyShopResult;
}

export interface MyShopResult {
  items: MyShopItem[];
  paginacion_show: boolean;
  productos: {
    count: number;
  };
}

export interface MyShopItem {
  id_producto: number;
  id_familia: number;
  familia: string;
  nombre: string;
  codigo: string;
  partno: string;
  marca: string;
  precio: number;
  precio_normal: number;
  precio_tarjeta: number;
  nuevo: number;
  garantia?: string;
  url: string;
  foto: string;

  stock_total: number;
  fecha_creacion?: string;
  texto?: string;
  label: string | boolean;
  disponibleInternet: boolean;
  disponibleTienda: boolean;
}

export const MYSHOP_CATEGORIES: CategoryMap<string[]> = {
  gpu: ["33"],
  cpu: ["143", "144"],
  psu: ["64"],
  motherboard: ["32"],
  ram: ["35"],
  cpu_cooler: ["150", "151"],
  case: ["36"],
  ssd: ["136", "135"],
  hdd: ["72"],
  case_fan: ["148"],
};

export class MyShopCrawler extends BaseCrawler<Category> {
  name = "MyShop";
  baseUrl = "https://www.myshop.cl";
  apiUrl = "https://www.myshop.cl/servicio/producto";

  async getAllProductUrlsForCategory(category: Category): Promise<string[]> {
    const products = await this.crawlCategory(category);
    return products.map((p) => p.url);
  }

  async crawlCategory(category: Category): Promise<ProductData[]> {
    const familyIds = MYSHOP_CATEGORIES[category];
    if (!familyIds) {
      this.logger.warn(`No family IDs configuration for category: ${category}`);
      return [];
    }

    const products: ProductData[] = [];

    for (const familyId of familyIds) {
      this.logger.info(`Crawling category ${category} (Family ID: ${familyId})`);

      // La API entrega `productos.count` (total) y siempre 12 ítems/página, así calculamos
      // por adelantado el número de páginas para no fetchear una vacía al final.
      let totalPages: number | null = null;
      let page = 1;

      while (true) {
        try {
          const data = await this.fetchApiPage(familyId, page);
          const items = data?.resultado?.items ?? [];
          if (items.length === 0) break;

          if (totalPages === null) {
            const total = data?.resultado?.productos?.count ?? 0;
            const perPage = items.length || 12;
            totalPages = total > 0 ? Math.ceil(total / perPage) : 1;
            this.logger.info(`Family ${familyId}: ${total} products in ${totalPages} pages`);
          }

          for (const item of items) {
            const itemUrl = item.url.startsWith("http") ? item.url : `${this.baseUrl}${item.url}`;
            const isAgotadoLabel = typeof item.label === "string" && item.label.toLowerCase().includes("agotado");
            const hasStock = item.stock_total > 0 && !isAgotadoLabel;

            products.push({
              url: itemUrl,
              title: item.nombre,
              price: item.precio,
              originalPrice: item.precio_tarjeta > item.precio ? item.precio_tarjeta : item.precio_normal,
              stock: hasStock,
              stockQuantity: item.stock_total,
              mpn: item.partno?.trim() || null,
              imageUrl: item.foto,
              specs: {
                manufacturer: item.marca,
                family: item.familia,
              },
              context: {
                description_text: item.texto || "",
                meta: { familia: item.familia, marca: item.marca, garantia: item.garantia },
              },
            });
          }

          if (page >= totalPages) break;
          page++;
          await this.waitRateLimit();
        } catch (error) {
          this.logger.error(`Error crawling family ${familyId} page ${page}: ${String(error)}`);
          break;
        }
      }
    }

    this.logger.info(`Total products found for ${category}: ${products.length}`);
    return products;
  }

  /**
   * Realiza la petición POST a la API simulando ser el navegador
   */
  private async fetchApiPage(idFamilia: string, page: number): Promise<MyShopApiResponse | null> {
    const payload = {
      tipo: "3",
      page: String(page),
      idFamilia: idFamilia,
    };

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": this.getUserAgent(),
        Origin: this.baseUrl,
        Referer: this.baseUrl,
        Accept: "application/json, text/plain, */*",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "cors",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`API status: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as MyShopApiResponse;
  }

  // Métodos legacy que ya no se usan pero mantenemos por compatibilidad con BaseCrawler
  async getProductUrls(_html: string): Promise<string[]> {
    // No se usa en este crawler porque usamos crawlCategory directamente
    return [];
  }

  async parseProduct(_html: string, _url: string): Promise<ProductData | null> {
    // No se usa en este crawler porque procesamos todo en crawlCategory
    return null;
  }
}
