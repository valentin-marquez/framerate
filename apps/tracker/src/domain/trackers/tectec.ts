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

      // Fallback: JSON-LD (mejorado para manejar @graph y priceSpecification)
      if (price === 0) {
        const jsonLdMatch = html.match(
          /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
        )?.[1];
        if (jsonLdMatch) {
          try {
            const ld: unknown = JSON.parse(jsonLdMatch);

            type ProductLd = { "@type": "Product"; offers?: unknown };

            const isProductLd = (item: unknown): item is ProductLd =>
              typeof item === "object" && item !== null && (item as Record<string, unknown>)["@type"] === "Product";

            let productLd: ProductLd | undefined;

            if (
              typeof ld === "object" &&
              ld !== null &&
              "@graph" in ld &&
              Array.isArray((ld as Record<string, unknown>)["@graph"])
            ) {
              const graph = (ld as Record<string, unknown>)["@graph"] as unknown[];
              productLd = graph.find(isProductLd);
            } else if (Array.isArray(ld)) {
              productLd = (ld as unknown[]).find(isProductLd) ?? ((ld as unknown[])[0] as ProductLd | undefined);
            } else if (isProductLd(ld)) {
              productLd = ld;
            }

            if (productLd?.offers) {
              const offers = Array.isArray(productLd.offers) ? (productLd.offers as unknown[])[0] : productLd.offers;

              // Intentar obtener precio de priceSpecification (formato nuevo de Tectec)
              const getPriceSpecs = (o: unknown): unknown[] | undefined => {
                if (typeof o !== "object" || o === null) return undefined;
                const rec = o as Record<string, unknown>;
                if (Array.isArray(rec.priceSpecification)) return rec.priceSpecification as unknown[];
                if (rec.priceSpecification) return [rec.priceSpecification];
                return undefined;
              };

              const priceSpecs = getPriceSpecs(offers);

              if (priceSpecs) {
                const prices: number[] = [];
                for (const spec of priceSpecs) {
                  if (typeof spec === "object" && spec !== null && "price" in (spec as Record<string, unknown>)) {
                    const p = (spec as Record<string, unknown>).price;
                    const priceVal = Number.parseInt(String(p).replace(/[^0-9]/g, ""), 10);
                    if (!Number.isNaN(priceVal) && priceVal > 0) {
                      prices.push(priceVal);
                    }
                  }
                }

                if (prices.length > 0) {
                  price = Math.min(...prices);
                  priceNormal = Math.max(...prices);
                  if (price === priceNormal && prices.length > 1) {
                    priceNormal = price;
                  }
                }
              }

              // Fallback: formato antiguo con price directo
              if (
                price === 0 &&
                typeof offers === "object" &&
                offers !== null &&
                "price" in (offers as Record<string, unknown>)
              ) {
                const priceVal = Number.parseInt(
                  String((offers as Record<string, unknown>).price).replace(/[^0-9]/g, ""),
                  10,
                );
                if (!Number.isNaN(priceVal) && priceVal > 0) {
                  price = priceVal;
                  priceNormal = priceVal;
                }
              }
            }
          } catch (e) {
            this.logger.warn(`Error parsing JSON-LD for ${url}:`, e);
          }
        }
      }

      // Extraer stock
      let stock = false;
      let stockQuantity = 0;

      // Buscar elemento de stock in-stock
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
          stockQuantity = 1; // Asumimos al menos 1 si dice disponible pero no especifica cantidad
        }
      } else if (
        /<p[^>]*class=["'][^"']*stock[^"']*out-of-stock[^"']*["'][^>]*>/i.test(html) ||
        /Sin existencias/i.test(html)
      ) {
        stock = false;
        stockQuantity = 0;
      }

      // Validación final: si hay stock pero no hay precio, algo está mal
      if (stock && price === 0) {
        this.logger.warn(`Product has stock but no price found: ${url}`);
      }

      return {
        price,
        priceNormal: priceNormal || price,
        stock,
        stockQuantity,
        available: stock && price > 0, // Solo está disponible si hay stock Y precio
      };
    } catch (error) {
      this.logger.error(`Error tracking ${url}:`, error);
      return { price: 0, stock: false, available: false };
    }
  }
}
