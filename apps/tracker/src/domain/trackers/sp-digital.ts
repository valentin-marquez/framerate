import type { Browser, Page } from "puppeteer";
import { BaseTracker, type TrackerResult } from "./base";
import type { PuppeteerPool } from "./puppeteer-pool";

/**
 * Rastreador para el sitio web de SP Digital (spdigital.cl).
 * Extrae el precio del producto, precio normal, cantidad en stock y disponibilidad usando Puppeteer.
 * Utiliza PuppeteerPool para la gestión del navegador y optimiza el uso de recursos bloqueando imágenes y fuentes.
 *
 * Métodos:
 *   - track(url: string): Promise<TrackerResult>
 *       Navega a la página del producto, extrae los datos relevantes y retorna un objeto TrackerResult.
 */
export class SpDigitalTracker extends BaseTracker {
  name = "SP Digital";
  domain = "spdigital.cl";
  private puppeteerPool: PuppeteerPool;

  constructor(puppeteerPool: PuppeteerPool) {
    super();
    this.puppeteerPool = puppeteerPool;
  }

  async track(url: string): Promise<TrackerResult> {
    let page: Page | undefined;
    let browser: Browser | null = null;
    try {
      this.logger.info(`Starting track for: ${url}`);
      browser = await this.puppeteerPool.acquire();

      page = await browser.newPage();
      // Block images and fonts to save bandwidth and memory
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        if (["image", "stylesheet", "font"].includes(req.resourceType())) {
          req.abort();
        } else {
          req.continue();
        }
      });
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      );

      this.logger.info(`Navigating to page...`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      this.logger.info(`Page loaded. Extracting data...`);

      const data = await page.evaluate(() => {
        const result = {
          priceCash: 0,
          priceNormal: 0,
          stockQuantity: 0,
          available: false,
        };

        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of scripts) {
          try {
            const json = JSON.parse(script.textContent || "[]");
            const products = Array.isArray(json) ? json : [json];

            const product = products.find((p: any) => p["@type"] === "Product");

            if (product?.offers) {
              result.available = product.offers.availability === "https://schema.org/InStock";
            }
          } catch (_e) {
            // Ignore parse errors
          }
        }

        const metaPrice = document.querySelector('meta[property="product:price:amount"]');
        if (metaPrice) {
          const content = metaPrice.getAttribute("content");
          if (content) {
            result.priceCash = Number.parseInt(content, 10) || 0;
          }
        }

        const spans = Array.from(document.querySelectorAll("span"));
        const otherPaymentSpan = spans.find((s) => s.textContent?.includes("Otros medios de pago"));
        if (otherPaymentSpan) {
          let next = otherPaymentSpan.nextElementSibling;
          while (next) {
            if (next.textContent?.includes("$")) {
              const priceText = next.textContent.replace(/[^\d]/g, "");
              result.priceNormal = Number.parseInt(priceText, 10) || 0;
              break;
            }
            next = next.nextElementSibling;
          }
        }

        if (result.priceNormal === 0) {
          result.priceNormal = result.priceCash;
        }

        const stockSpans = spans.filter(
          (s) => s.textContent?.includes("Stock online") || s.textContent?.includes("Stock en tienda"),
        );

        for (const span of stockSpans) {
          const parent = span.parentElement;
          if (parent) {
            const quantityDiv = parent.querySelector('div[class*="product-detail-module--availability"]');
            if (quantityDiv) {
              const text = quantityDiv.textContent || "";
              const match = text.match(/(\d+)/);
              if (match?.[1]) {
                result.stockQuantity += Number.parseInt(match[1], 10);
              }
            }
          }
        }

        return result;
      });

      this.logger.info(`Extraction complete: ${JSON.stringify(data)}`);

      return {
        price: data.priceCash,
        priceNormal: data.priceNormal,
        stock: data.available && data.stockQuantity > 0,
        stockQuantity: data.stockQuantity,
        available: data.available,
      };
    } catch (error) {
      this.logger.error(`Error tracking ${url}:`, error);
      return {
        price: 0,
        stock: false,
        available: false,
      };
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (_e) {
          // ignore
        }
      }

      if (browser) {
        try {
          this.puppeteerPool.release(browser);
        } catch (_e) {
          // ignore
        }
      }
    }
  }
}
