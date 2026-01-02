import type { Browser, Page } from "puppeteer";
import type { TrackerResult } from "@/domain/trackers/base";
import { BaseTracker } from "@/domain/trackers/base";
import type { PuppeteerPool } from "@/domain/trackers/puppeteer-pool";
import { getUserAgent } from "@/domain/trackers/user-agents";

/**
 * Rastreador para MyShop (myshop.cl).
 * Extrae precio, disponibilidad y stock desde el DOM.
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
      browser = await this.puppeteerPool.acquire();
      page = await browser.newPage();

      await page.setRequestInterception(true);
      page.on("request", (req) => {
        ["image", "stylesheet", "font"].includes(req.resourceType()) ? req.abort() : req.continue();
      });

      await page.setUserAgent(getUserAgent());
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

      const data = await page.evaluate(() => {
        const result = {
          price: 0,
          priceNormal: 0,
          stockQuantity: 0,
          availableOnline: false,
          availableStore: false,
        };

        // Extraer disponibilidad desde tags
        const tags = document.querySelectorAll("div.tag-status span");
        for (const tag of tags) {
          const text = (tag.textContent || "").toLowerCase();
          if (text.includes("disponible online")) result.availableOnline = true;
          if (text.includes("disponible en tienda") || text.includes("disponible tienda")) {
            result.availableStore = true;
          }
        }

        // Extraer stock desde aside
        const stockAside = document.querySelector("div.stock aside");
        if (stockAside) {
          const stockSpans = stockAside.querySelectorAll(":scope > span");
          for (const span of stockSpans) {
            const text = span.textContent || "";
            const match = text.match(/(\d+)\s*unidades?/i);
            if (match?.[1]) {
              const qty = Number.parseInt(match[1], 10);
              result.stockQuantity += qty;

              // Determinar tipo de stock
              if (text.toLowerCase().includes("internet")) result.availableOnline = true;
              if (text.toLowerCase().includes("providencia") || text.toLowerCase().includes("tienda")) {
                result.availableStore = true;
              }
            }
          }
        }

        // Extraer precios
        const mainPrices: number[] = [];
        const normalPrices: number[] = [];

        // Precio principal (efectivo/transferencia)
        document.querySelectorAll(".main-price").forEach((el) => {
          const match = (el.textContent || "").match(/(\d[\d.,\s]*)/);
          if (match?.[1]) {
            const price = Number.parseInt(match[1].replace(/[^\d]/g, ""), 10);
            if (price > 0) mainPrices.push(price);
          }
        });

        // Precio normal (tarjeta)
        document.querySelectorAll(".normal-price").forEach((el) => {
          const match = (el.textContent || "").match(/(\d[\d.,\s]*)/);
          if (match?.[1]) {
            const price = Number.parseInt(match[1].replace(/[^\d]/g, ""), 10);
            if (price > 0) normalPrices.push(price);
          }
        });

        if (mainPrices.length > 0) {
          result.price = Math.min(...mainPrices);
          result.priceNormal = Math.max(...mainPrices);
        }

        if (normalPrices.length > 0) {
          result.priceNormal = Math.max(...normalPrices);
          if (result.price === 0) result.price = Math.min(...normalPrices);
        }

        // Fallback: meta tag
        if (result.price === 0) {
          const metaPrice = document.querySelector('meta[property="product:price:amount"]');
          if (metaPrice) {
            const price = Number.parseInt((metaPrice.getAttribute("content") || "").replace(/[^\d]/g, ""), 10);
            if (price > 0) {
              result.price = price;
              result.priceNormal = price;
            }
          }
        }

        return result;
      });

      const available = data.stockQuantity > 0;
      const stock = data.stockQuantity > 0;

      return {
        price: data.price,
        priceNormal: data.priceNormal || data.price,
        stock,
        stockQuantity: data.stockQuantity,
        available,
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
