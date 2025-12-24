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

      // Esperar networkidle2 para que React termine de renderizar
      await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

      // Esperar explícitamente por el JSON-LD de React Helmet
      await page.waitForSelector('script[type="application/ld+json"]', { timeout: 10000 }).catch(() => {
        this.logger.warn(`Timeout waiting for JSON-LD script on ${url}`);
      });

      const data = await page.evaluate(() => {
        const result = {
          priceCash: 0,
          priceNormal: 0,
          stockQuantity: 0,
          available: false,
        };

        // Extraer desde JSON-LD
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');

        for (const script of scripts) {
          try {
            const jsonText = script.textContent || "";
            if (!jsonText.trim()) continue;

            const json = JSON.parse(jsonText);
            const items = Array.isArray(json) ? json : [json];

            for (const item of items) {
              if (item?.["@type"] === "Product" && item.offers) {
                result.available = item.offers.availability === "https://schema.org/InStock";

                const priceValue = item.offers.price;
                if (priceValue !== undefined && priceValue !== null) {
                  const parsedPrice =
                    typeof priceValue === "string"
                      ? Number.parseFloat(priceValue.replace(/[^\d.]/g, ""))
                      : Number(priceValue);
                  result.priceCash = Math.round(parsedPrice) || 0;
                }
                break;
              }
            }

            if (result.priceCash > 0) break;
          } catch (e) {}
        }

        // Extraer precio normal (otros medios de pago) del DOM
        const spans = Array.from(document.querySelectorAll("span"));
        const otherPaymentSpan = spans.find((s) => s.textContent?.includes("Otros medios de pago"));
        if (otherPaymentSpan) {
          let next = otherPaymentSpan.nextElementSibling;
          let attempts = 0;
          while (next && attempts < 5) {
            const text = next.textContent || "";
            if (text.includes("$")) {
              result.priceNormal = Number.parseInt(text.replace(/[^\d]/g, ""), 10) || 0;
              break;
            }
            next = next.nextElementSibling;
            attempts++;
          }
        }

        if (result.priceNormal === 0 && result.priceCash > 0) {
          result.priceNormal = result.priceCash;
        }

        // Extraer cantidad de stock del DOM
        const availabilityDivs = document.querySelectorAll('div[class*="product-detail-module--availability"]');
        for (const div of availabilityDivs) {
          const match = (div.textContent || "").match(/(\d+)\s*unidades?/i);
          if (match?.[1]) {
            result.stockQuantity += Number.parseInt(match[1], 10);
          }
        }

        return result;
      });

      const stockQty = data.stockQuantity > 0 ? data.stockQuantity : data.available ? 1 : 0;

      return {
        price: data.priceCash,
        priceNormal: data.priceNormal || data.priceCash,
        stock: data.available,
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
