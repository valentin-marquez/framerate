import type { Browser, Page } from "puppeteer";
import { BaseTracker, type TrackerResult } from "@/domain/trackers/base";
import type { PuppeteerPool } from "@/domain/trackers/puppeteer-pool";
import { getUserAgent } from "@/domain/trackers/user-agents";

/**
 * Rastreador para Tectec (tectec.cl).
 * Extrae precio, disponibilidad y stock desde JSON-LD y HTML.
 */
export class TectecTracker extends BaseTracker {
  name = "Tectec";
  domain = "tectec.cl";
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

      await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
      await page.waitForSelector('script[type="application/ld+json"]', { timeout: 10000 }).catch(() => {
        this.logger.warn(`Timeout waiting for JSON-LD script on ${url}`);
      });

      const data = await page.evaluate(() => {
        const result = {
          price: 0,
          priceNormal: 0,
          stock: false,
          stockQuantity: 0,
        };

        // Extraer desde JSON-LD
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');

        for (const script of scripts) {
          try {
            const jsonText = script.textContent || "";
            if (!jsonText.trim()) continue;

            const json = JSON.parse(jsonText);

            // Buscar en @graph si existe
            let items: any[] = [];
            if (json["@graph"] && Array.isArray(json["@graph"])) {
              items = json["@graph"];
            } else if (Array.isArray(json)) {
              items = json;
            } else {
              items = [json];
            }

            // Buscar el Product
            const product = items.find((item: any) => item?.["@type"] === "Product");
            if (!product?.offers) continue;

            const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;

            // Extraer precios de priceSpecification
            if (offers.priceSpecification) {
              const specs = Array.isArray(offers.priceSpecification)
                ? offers.priceSpecification
                : [offers.priceSpecification];

              const prices: number[] = [];
              for (const spec of specs) {
                if (spec?.price) {
                  const priceVal =
                    typeof spec.price === "string"
                      ? Number.parseInt(spec.price.replace(/[^\d]/g, ""), 10)
                      : Number(spec.price);
                  if (priceVal > 0) prices.push(priceVal);
                }
              }

              if (prices.length > 0) {
                result.price = Math.min(...prices);
                result.priceNormal = Math.max(...prices);
              }
            }

            // Extraer disponibilidad
            if (offers.availability) {
              result.stock = offers.availability === "https://schema.org/InStock";
            }

            break;
          } catch (e) {}
        }

        // Extraer stock quantity del HTML
        const stockElements = document.querySelectorAll("p.stock");
        for (const element of stockElements) {
          const text = element.textContent || "";
          if (text.includes("in-stock")) {
            const match = text.match(/(\d+)/);
            if (match?.[1]) {
              result.stockQuantity = Number.parseInt(match[1], 10);
            } else if (/disponible/i.test(text)) {
              result.stockQuantity = 1;
            }
            result.stock = true;
            break;
          } else if (text.includes("out-of-stock") || /sin existencias/i.test(text)) {
            result.stock = false;
            result.stockQuantity = 0;
            break;
          }
        }

        // Si hay stock pero no cantidad, asignar 1 simbólico
        if (result.stock && result.stockQuantity === 0) {
          result.stockQuantity = 1;
        }

        return result;
      });

      return {
        price: data.price,
        priceNormal: data.priceNormal || data.price,
        stock: data.stock,
        stockQuantity: data.stockQuantity,
        available: data.stock && data.price > 0,
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
