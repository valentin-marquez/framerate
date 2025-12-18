import type { Browser, Page } from "puppeteer";
import type { TrackerResult } from "./base";
import { BaseTracker } from "./base";
import type { PuppeteerPool } from "./puppeteer-pool";

/**
 * MyShopTracker es una implementación de rastreador para myshop.cl.
 * Utiliza Puppeteer para extraer información de precio, stock y disponibilidad de productos.
 *
 * Características:
 * - Bloquea imágenes, estilos y fuentes para optimizar el uso de recursos.
 * - Extrae datos de precio y stock desde meta etiquetas y elementos del DOM.
 * - Determina la disponibilidad online y en tienda física.
 *
 * Uso:
 *   const tracker = new MyShopTracker(puppeteerPool);
 *   const result = await tracker.track(productUrl);
 */
export class MyShopTracker extends BaseTracker {
  name = "MyShop";
  domain = "myshop.cl";

  private puppeteerPool: PuppeteerPool;

  constructor(puppeteerPool: PuppeteerPool) {
    super();
    this.puppeteerPool = puppeteerPool;
  }

  async track(url: string): Promise<TrackerResult> {
    let page: Page | undefined;
    let browser: Browser | null = null;
    try {
      this.logger.info(`Starting MyShop tracking for: ${url}`);
      browser = await this.puppeteerPool.acquire();

      page = await browser.newPage();

      // Block images/styles/fonts to save bandwidth and memory
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

      this.logger.info("Navigating to page...");
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      this.logger.info("Page loaded. Extracting data...");

      const data = await page.evaluate(() => {
        const result = {
          price: 0,
          priceNormal: 0,
          stockQuantity: 0,
          availableOnline: false,
          availableStore: false,
          priceFoundAt: undefined as string | undefined,
        } as {
          price: number;
          priceNormal: number;
          stockQuantity: number;
          availableOnline: boolean;
          availableStore: boolean;
          priceFoundAt?: string;
        };

        const tag = document.querySelector("div.tag-status");
        if (tag) {
          const spans = Array.from(tag.querySelectorAll("span"));
          for (const s of spans) {
            const txt = (s.textContent || "").trim().toLowerCase();
            if (txt.includes("disponible online")) result.availableOnline = true;
            if (txt.includes("disponible en tienda") || txt.includes("disponible tienda")) result.availableStore = true;
          }
        }

        const aside = document.querySelector("div.stock aside");
        if (aside) {
          const spans = Array.from(aside.querySelectorAll("span"));
          for (const s of spans) {
            const txt = s.textContent || "";
            const matches = txt.match(/(\d+)/g);
            if (matches) {
              for (const m of matches) {
                const n = Number.parseInt(m.replace(/[^\d]/g, ""), 10);
                if (!Number.isNaN(n)) result.stockQuantity += n;
              }
            }
          }
        }

        // Prefer explicit selectors when present: main-price (usually the discounted/cheapest) and normal-price
        const mainPriceEl = document.querySelector(".main-price") as Element | null;
        const normalPriceEl = document.querySelector(".normal-price") as Element | null;

        if (mainPriceEl) {
          const txt = mainPriceEl.textContent || "";
          const m = txt.match(/(\d[\d.,]*)/);
          if (m?.[1]) {
            const cleaned = m[1].replace(/[^\d]/g, "");
            result.price = Number.parseInt(cleaned, 10) || 0;
            result.priceFoundAt = ".main-price";
          }
        }

        if (normalPriceEl) {
          const txt = normalPriceEl.textContent || "";
          const m = txt.match(/(\d[\d.,]*)/);
          if (m?.[1]) {
            const cleaned = m[1].replace(/[^\d]/g, "");
            result.priceNormal = Number.parseInt(cleaned, 10) || 0;
            // If we don't have a primary price yet, use normal as price
            if (!result.price) result.price = result.priceNormal;
            result.priceFoundAt = result.priceFoundAt ? `${result.priceFoundAt}+ .normal-price` : ".normal-price";
          }
        }

        // Fallback to meta tag or generic search if neither selector provided a price
        if (!result.price) {
          const metaPrice = document.querySelector('meta[property="product:price:amount"]') as HTMLMetaElement | null;
          if (metaPrice?.content) {
            result.price = Number.parseInt(metaPrice.content.replace(/[^\d]/g, ""), 10) || 0;
            result.priceNormal = result.price;
            result.priceFoundAt = result.priceFoundAt
              ? `${result.priceFoundAt}+ meta`
              : "meta[property=product:price:amount]";
          } else {
            const elWithDollar = Array.from(document.querySelectorAll("*[class*='price'], *:not(script)")).find(
              (el) => (el.textContent || "").includes("$") && /(\d+)/.test(el.textContent || ""),
            );
            if (elWithDollar) {
              const priceText = (elWithDollar.textContent || "").match(/(\d[\d.,]*)/)?.[1] ?? "";
              const cleaned = priceText.replace(/[^\d]/g, "");
              result.price = Number.parseInt(cleaned, 10) || 0;
              result.priceNormal = result.priceNormal || result.price;
              try {
                const snippet = (elWithDollar as Element).outerHTML?.slice(0, 256) ?? "";
                result.priceFoundAt = result.priceFoundAt ? `${result.priceFoundAt}+ element` : `element:${snippet}`;
              } catch (_e) {
                // ignore
              }
            }
          }
        }

        // Ensure the recorded `price` is the cheapest when both main and normal are available
        if (typeof result.price === "number" && typeof result.priceNormal === "number") {
          result.price = Math.min(result.price, result.priceNormal);
        }

        return result;
      });

      this.logger.info(`Extraction complete: ${JSON.stringify(data)}`);

      const available = data.availableOnline || data.availableStore;
      const stock = data.stockQuantity > 0 || data.availableOnline;

      return {
        price: data.price,
        priceNormal: data.priceNormal || data.price,
        stock,
        stockQuantity: data.stockQuantity,
        available,
        url,
        meta: {
          priceFoundAt: data.priceFoundAt ?? undefined,
        },
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
