import { BaseTracker, type TrackerResult } from "@/domain/trackers/base";

/**
 * Rastreador para Tectec (tectec.cl).
 * Extrae precio, disponibilidad y stock desde HTML.
 */
export class TectecTracker extends BaseTracker {
  name = "Tectec";
  domain = "tectec.cl";

  async track(url: string): Promise<TrackerResult> {
    try {
      const html = await this.fetchHtml(url);

      // Extraer precios del formulario cart
      let price = 0;
      let priceNormal = 0;

      const formMatch = html.match(/<form[^>]*class=["'][^"']*cart[^"']*["'][\s\S]*?<\/form>/i)?.[0];
      if (formMatch) {
        const priceRe = /\$\s*([0-9.,]+)/g;
        const nums: number[] = [];
        let pm: RegExpExecArray | null = priceRe.exec(formMatch);
        while (pm !== null) {
          const cleaned = pm[1].replace(/[.,]/g, "");
          const val = Number.parseInt(cleaned, 10);
          if (!Number.isNaN(val)) nums.push(val);
          pm = priceRe.exec(formMatch);
        }
        if (nums.length > 0) {
          price = Math.min(...nums); // Precio más bajo (transferencia)
          priceNormal = Math.max(...nums); // Precio más alto (tarjeta)
          if (price === priceNormal) priceNormal = price;
        }
      }

      // Fallback: JSON-LD
      if (price === 0) {
        const jsonLdMatch = html.match(
          /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
        )?.[1];
        if (jsonLdMatch) {
          try {
            const ld = JSON.parse(jsonLdMatch);
            const productLd = Array.isArray(ld) ? ld.find((p) => p?.["@type"] === "Product") || ld[0] : ld;
            const offers = productLd?.offers;
            if (offers) {
              const offerPrice = Array.isArray(offers) ? offers[0]?.price : offers?.price;
              if (offerPrice) {
                price = Number.parseInt(String(offerPrice).replace(/[^0-9]/g, ""), 10) || 0;
                priceNormal = price;
              }
            }
          } catch (_e) {
            // Ignore
          }
        }
      }

      // Extraer stock
      let stock = false;
      let stockQuantity = 0;

      const inStockMatch = html.match(
        /<p[^>]*class=["'][^"']*stock[^"']*in-stock[^"']*["'][^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i,
      )?.[1];

      if (inStockMatch) {
        const qMatch = inStockMatch.match(/(\d+)/);
        if (qMatch?.[1]) {
          stockQuantity = Number.parseInt(qMatch[1], 10);
          stock = stockQuantity > 0;
        } else if (/disponible|disponibles/i.test(inStockMatch)) {
          stock = true;
          stockQuantity = 1;
        }
      } else if (
        /<p[^>]*class=["'][^"']*stock[^"']*out-of-stock[^"']*["'][^>]*>/i.test(html) ||
        /Sin existencias/i.test(html)
      ) {
        stock = false;
        stockQuantity = 0;
      }

      return {
        price,
        priceNormal,
        stock,
        stockQuantity,
        available: stock,
      };
    } catch (error) {
      this.logger.error(`Error tracking ${url}:`, error);
      return { price: 0, stock: false, available: false };
    }
  }
}
