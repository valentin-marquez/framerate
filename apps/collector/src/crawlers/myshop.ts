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
  async getAllProductUrlsForCategory(category: Category): Promise<string[]> {
    const products = await this.crawlCategory(category);
    return products.map((p) => p.url);
  }
  name = "MyShop";
  baseUrl = "https://www.myshop.cl";
  apiUrl = "https://www.myshop.cl/servicio/producto";

  async crawlCategory(category: Category): Promise<ProductData[]> {
    const familyIds = MYSHOP_CATEGORIES[category];

    if (!familyIds) {
      this.logger.warn(`[MyShop] No family IDs configuration for category: ${category}`);
      return [];
    }

    const products: ProductData[] = [];

    for (const familyId of familyIds) {
      let page = 1;
      let hasMorePages = true;

      this.logger.info(`[MyShop] Crawling category ${category} (Family ID: ${familyId})`);

      while (hasMorePages) {
        try {
          this.logger.info(`[MyShop] Fetching API Familia ${familyId} - Página ${page}`);

          const data = await this.fetchApiPage(familyId, page);

          if (!data || !data.resultado || !data.resultado.items || data.resultado.items.length === 0) {
            this.logger.info(`[MyShop] No items found for family ${familyId} on page ${page}. Stopping.`);
            hasMorePages = false;
            continue;
          }

          for (const item of data.resultado.items) {
            const itemUrl = item.url.startsWith("http") ? item.url : `${this.baseUrl}${item.url}`;
            const isAgotadoLabel = typeof item.label === "string" && item.label.toLowerCase().includes("agotado");
            const hasStock = item.stock_total > 0 && !isAgotadoLabel;
            const cleanMpn = item.partno ? item.partno.trim() : "";

            products.push({
              url: itemUrl,
              title: item.nombre,
              price: item.precio,
              originalPrice: item.precio_tarjeta > item.precio ? item.precio_tarjeta : item.precio_normal,
              stock: hasStock,
              stockQuantity: item.stock_total,
              mpn: cleanMpn,
              imageUrl: item.foto,
              specs: {
                manufacturer: item.marca,
                family: item.familia,
              },
              context: {
                description_text: item.texto || "",
                meta: {
                  familia: item.familia,
                  marca: item.marca,
                  garantia: item.garantia,
                },
              },
            });
          }

          if (data.resultado.paginacion_show === true) {
            page++;
            await this.waitRateLimit();
          } else {
            this.logger.info(`[MyShop] No more pages for family ${familyId} (paginacion_show: false)`);
            hasMorePages = false;
          }
        } catch (error) {
          this.logger.error(`[MyShop] Error crawling family ${familyId} page ${page}:`, String(error));

          hasMorePages = false;
        }
      }
    }

    this.logger.info(`[MyShop] Total products found for ${category}: ${products.length}`);
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
      throw new Error(`[MyShop] API Status: ${response.status} ${response.statusText}`);
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
