import { BaseTracker, type TrackerResult } from "./base";

/**
 * PcExpressTracker es un rastreador para productos en tienda.pc-express.cl.
 * Obtiene la página del producto, extrae los precios al contado y normal, y determina la disponibilidad de stock.
 *
 * Métodos:
 *   - track(url): Obtiene la página del producto y retorna price, priceNormal, stock, stockQuantity y availability.
 *   - parsePrice(priceStr): Parsea una cadena de precio y retorna su valor numérico.
 */
export class PcExpressTracker extends BaseTracker {
  name = "PC-Express";
  domain = "tienda.pc-express.cl";

  async track(url: string): Promise<TrackerResult> {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (response.status === 404) {
        this.logger.warn(`Product not found (404): ${url}`);
        return {
          price: 0,
          stock: false,
          available: false,
        };
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      }

      let priceCashStr = "";
      let priceNormalStr = "";
      let stockCount = 0;

      const rewriter = new HTMLRewriter();

      rewriter.on(".rm-product__price--cash h3", {
        text(text) {
          priceCashStr += text.text;
        },
      });

      rewriter.on(".rm-product__price--normal h3", {
        text(text) {
          priceNormalStr += text.text;
        },
      });

      rewriter.on("span[id^='stock-sucursal-']", {
        text(text) {
          const content = text.text.trim();
          if (content) {
            const match = content.match(/(\d+)\s+unidad/i);
            if (match?.[1]) {
              stockCount += Number.parseInt(match[1], 10);
            }
          }
        },
      });

      await rewriter.transform(response).text();

      const price = this.parsePrice(priceCashStr);
      const priceNormal = this.parsePrice(priceNormalStr);

      return {
        price,
        priceNormal,
        stock: stockCount > 0,
        stockQuantity: stockCount,
        available: true,
      };
    } catch (error) {
      this.logger.error(`Error tracking ${url}:`, error);
      return {
        price: 0,
        stock: false,
        available: false,
      };
    }
  }

  private parsePrice(priceStr: string): number {
    const clean = priceStr.replace(/[^\d]/g, "");
    return Number.parseInt(clean, 10) || 0;
  }
}
