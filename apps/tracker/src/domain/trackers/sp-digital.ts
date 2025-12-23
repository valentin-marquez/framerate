import type { Browser, Page } from "puppeteer";
import { BaseTracker, type TrackerResult } from "@/domain/trackers/base";
import type { PuppeteerPool } from "@/domain/trackers/puppeteer-pool";
import { getUserAgent } from "@/domain/trackers/user-agents";

/**
 * Rastreador para SP Digital (spdigital.cl).
 * Extrae precio, disponibilidad y stock desde JSON-LD y elementos DOM.
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
      browser = await this.puppeteerPool.acquire();
      page = await browser.newPage();

      await page.setRequestInterception(true);
      page.on("request", (req) => {
        ["image", "stylesheet", "font"].includes(req.resourceType()) ? req.abort() : req.continue();
      });
      await page.setUserAgent(getUserAgent());
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

      const data = await page.evaluate(() => {
        const result = { priceCash: 0, priceNormal: 0, stockQuantity: 0, available: false };

        // Extraer desde JSON-LD
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of scripts) {
          try {
            const json = JSON.parse(script.textContent || "[]");
            const products = Array.isArray(json) ? json : [json];
            const product = products.find((p) => p?.["@type"] === "Product");

            if (product?.offers) {
              result.available = product.offers.availability === "https://schema.org/InStock";
              result.priceCash = Number.parseInt(String(product.offers.price), 10) || 0;
            }
          } catch (_e) {
            // Ignore
          }
        }

        // Extraer precio normal (otros medios de pago)
        const spans = Array.from(document.querySelectorAll("span"));
        const otherPaymentSpan = spans.find((s) => s.textContent?.includes("Otros medios de pago"));
        if (otherPaymentSpan) {
          let next = otherPaymentSpan.nextElementSibling;
          while (next) {
            if (next.textContent?.includes("$")) {
              result.priceNormal = Number.parseInt(next.textContent.replace(/[^\d]/g, ""), 10) || 0;
              break;
            }
            next = next.nextElementSibling;
          }
        }

        if (result.priceNormal === 0) result.priceNormal = result.priceCash;

        // Extraer cantidad de stock
        const availabilityDivs = document.querySelectorAll('div[class*="product-detail-module--availability"]');
        for (const div of availabilityDivs) {
          const match = (div.textContent || "").match(/(\d+)/);
          if (match?.[1]) result.stockQuantity += Number.parseInt(match[1], 10);
        }

        return result;
      });

      const hasStock = data.available;
      const stockQty = data.stockQuantity > 0 ? data.stockQuantity : hasStock ? 1 : 0;

      return {
        price: data.priceCash,
        priceNormal: data.priceNormal,
        stock: hasStock,
        stockQuantity: stockQty,
        available: data.available,
      };
    } catch (error) {
      this.logger.error(`Error tracking ${url}:`, error);
      return { price: 0, stock: false, available: false };
    } finally {
      if (page) await page.close().catch(() => {});
      if (browser) this.puppeteerPool.release(browser);
    }
  }
}
