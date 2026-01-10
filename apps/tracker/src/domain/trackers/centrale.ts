import * as cheerio from "cheerio";
import type { Browser, Page } from "puppeteer";
import { BaseTracker, type TrackerResult } from "@/domain/trackers/base";
import type { PuppeteerPool } from "@/domain/trackers/puppeteer-pool";
import { getUserAgent } from "@/domain/trackers/user-agents";

export class CentraleTracker extends BaseTracker {
  name = "Centrale";
  domain = "centrale.cl";
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

      // Cash/effective price from twitter meta first
      const twitterPriceText = $('meta[name="twitter:data1"]').attr("content");
      if (twitterPriceText) {
        const cleaned = twitterPriceText.replace(/[^\d]/g, "");
        if (cleaned) {
          price = Number.parseInt(cleaned, 10);
        }
      }

      // Fallback: main displayed price
      if (!price) {
        const mainPriceText = $(".price-wrapper div[style*='font-weight: 700']").text().replace(/[^\d]/g, "");
        if (mainPriceText) {
          price = Number.parseInt(mainPriceText, 10);
        }
      }

      // Normal price (credit/debit) - span with data-nosnippet and bold font
      const normalPriceElement = $("span[data-nosnippet='true'][style*='font-weight: bold']");
      if (normalPriceElement.length > 0) {
        const normalText = normalPriceElement.text().replace(/[^\d]/g, "");
        if (normalText) {
          priceNormal = Number.parseInt(normalText, 10);
        }
      }

      // Fallback: look at p.price
      if (!price) {
        const fallbackPrice = $("p.price .woocommerce-Price-amount").first().text().replace(/[^\d]/g, "");
        if (fallbackPrice) {
          price = Number.parseInt(fallbackPrice, 10);
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

      // Alternative: check stock from price-wrapper area (e.g., "5 Unid.")
      if (!stockQuantity) {
        const stockSpan = $(".price-wrapper span[data-nosnippet]").text();
        const unidMatch = stockSpan.match(/(\d+)\s*Unid/i);
        if (unidMatch) {
          stockQuantity = Number.parseInt(unidMatch[1], 10);
          inStock = stockQuantity > 0;
        } else if (stockSpan.includes("+20")) {
          stockQuantity = 20;
          inStock = true;
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
