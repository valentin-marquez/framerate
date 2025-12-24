import { BaseTracker, type TrackerResult } from "@/domain/trackers/base";

/**
 * PcExpressTracker es un rastreador para productos en tienda.pc-express.cl.
 * Obtiene la página del producto, extrae los precios al contado y normal, y determina la disponibilidad de stock.
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

      const html = await response.text();

      // Extraer precios desde el formato HTML
      let price = 0;
      let priceNormal = 0;

      // Buscar todos los bloques de precio dentro de rm-product-page__price
      const priceBlocks = html.matchAll(/<div[^>]*class="[^"]*rm-product-page__price[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);

      for (const block of priceBlocks) {
        const blockHtml = block[1];

        // Extraer el precio del h3
        const priceMatch = blockHtml.match(/<h3[^>]*>\$\s*([\d.,]+)<\/h3>/i);
        if (!priceMatch) continue;

        const extractedPrice = this.parsePrice(priceMatch[1]);

        // Determinar si es efectivo o normal según el texto que sigue
        if (/Efectivo/i.test(blockHtml)) {
          price = extractedPrice;
        } else if (/Otros\s+medios\s+de\s+pago/i.test(blockHtml)) {
          priceNormal = extractedPrice;
        }
      }

      // Si no se encontró precio normal, usar el precio efectivo
      if (priceNormal === 0 && price > 0) {
        priceNormal = price;
      }

      // Extraer stock: +20 unidades o 20 unidades
      let stockCount = 0;
      const stockMatches = html.matchAll(
        /<span[^>]*id=["']stock-sucursal-[^"']*["'][^>]*>([^<]*(?:<[^>]+>[^<]*)*)<\/span>/gi,
      );
      for (const match of stockMatches) {
        const content = match[1]?.replace(/<[^>]+>/g, "").trim();
        if (content) {
          const stockMatch = content.match(/\+?(\d+)\s*unidad/i);
          if (stockMatch?.[1]) {
            stockCount += Number.parseInt(stockMatch[1], 10);
          }
        }
      }

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
    const clean = String(priceStr).replace(/[^\d]/g, "");
    return Number.parseInt(clean, 10) || 0;
  }
}
