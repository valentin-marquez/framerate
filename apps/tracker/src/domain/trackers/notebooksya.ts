import * as cheerio from "cheerio";
import type { Browser, Page } from "puppeteer";
import { BaseTracker, type TrackerResult } from "@/domain/trackers/base";
import type { PuppeteerPool } from "@/domain/trackers/puppeteer-pool";
import { getUserAgent } from "@/domain/trackers/user-agents";

export class NotebooksYaTracker extends BaseTracker {
  name = "NotebooksYa";
  domain = "notebooksya.cl";
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

      // Optimize: abort unnecessary requests
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const resourceType = req.resourceType();
        if (["image", "stylesheet", "font", "media"].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      await page.setUserAgent(getUserAgent());
      await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

      const html = await page.content();

      await page.close();
      page = undefined;

      const $ = cheerio.load(html);

      // Check if product page is valid or 404
      if ($("h1.page-title").text().includes("can't be found") || $(".error-404").length > 0) {
        this.logger.warn(`Product not found (404 page): ${url}`);
        return {
          price: 0,
          stock: false,
          available: false,
        };
      }

      // Price extraction
      let price = 0;
      let priceNormal = 0;

      // Cash price (inside <ins>)
      const cashPriceText = $("ins .woocommerce-Price-amount bdi").first().text().replace(/[^\d]/g, "");
      if (cashPriceText) {
        price = Number.parseInt(cashPriceText, 10);
      }

      // Normal price (wds-price or wds-second for webpay)
      const normalPriceText = $("p.wds-price .woocommerce-Price-amount bdi").text().replace(/[^\d]/g, "");
      if (normalPriceText) {
        priceNormal = Number.parseInt(normalPriceText, 10);
      }

      if (!priceNormal) {
        const webpayPriceText = $(".wds-second .wds-price .woocommerce-Price-amount bdi").text().replace(/[^\d]/g, "");
        if (webpayPriceText) {
          priceNormal = Number.parseInt(webpayPriceText, 10);
        }
      }

      // Fallback: try from wds-first (transferencia)
      if (!price) {
        const transferPriceText = $(".wds-first .wds-price .woocommerce-Price-amount bdi").text().replace(/[^\d]/g, "");
        if (transferPriceText) {
          price = Number.parseInt(transferPriceText, 10);
        }
      }

      if (!priceNormal) priceNormal = price;

      // Sanity check: swap if normal price is lower than cash price
      if (price > 0 && priceNormal > 0 && price > priceNormal) {
        const tmp = price;
        price = priceNormal;
        priceNormal = tmp;
      }

      // Stock extraction
      let stockQuantity: number | undefined;
      let inStock = false;

      const stockElement = $("p.stock.in-stock");
      if (stockElement.length > 0) {
        inStock = true;
        const stockText = stockElement.text();
        const match = stockText.match(/(\d+)/);
        if (match) {
          stockQuantity = Number.parseInt(match[1], 10);
        }
      }

      const outOfStock = $("p.stock.out-of-stock");
      if (outOfStock.length > 0) {
        inStock = false;
        stockQuantity = 0;
      }

      return {
        price,
        priceNormal,
        stock: inStock,
        stockQuantity,
        available: true,
      };
    } catch (error) {
      if (String(error).includes("404") || String(error).includes("Navigation failed")) {
        this.logger.warn(`Tracking failed for ${url}: ${error}`);
      } else {
        this.logger.error(`Error tracking ${url}:`, error);
      }

      return {
        price: 0,
        stock: false,
        available: false,
      };
    } finally {
      if (page) await page.close().catch(() => {});
      if (browser) this.puppeteerPool.release(browser);
    }
  }
}
