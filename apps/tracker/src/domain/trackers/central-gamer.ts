import * as cheerio from "cheerio";
import type { Browser, Page } from "puppeteer";
import { BaseTracker, type TrackerResult } from "@/domain/trackers/base";
import type { PuppeteerPool } from "@/domain/trackers/puppeteer-pool";
import { getUserAgent } from "@/domain/trackers/user-agents";

export class CentralGamerTracker extends BaseTracker {
  name = "CentralGamer";
  domain = "centralgamer.cl";
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
      // Increase timeout and wait for network idle to ensure JS rendering completes
      await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

      // Get HTML content after JS execution
      const html = await page.content();

      // We can close the page now
      await page.close();
      page = undefined;

      const $ = cheerio.load(html);

      // Check if product page is valid or 404
      if ($(".error-404-title").length > 0 || $(".error-404-sub-title").length > 0) {
        this.logger.warn(`Product not found (404 page): ${url}`);
        return {
          price: 0,
          stock: false,
          available: false,
        };
      }

      // 1. Price extraction
      let price = 0;
      let priceNormal = 0;

      // Method A: Standard hidden input/fields
      const cashPriceText = $(".precio-efectivo-valor").text().replace(/[^\d]/g, "");
      if (cashPriceText) {
        price = parseInt(cashPriceText, 10);
      }

      const normalPriceText = $(".precio-tarjeta-valor").text().replace(/[^\d]/g, "");
      if (normalPriceText) {
        priceNormal = parseInt(normalPriceText, 10);
      }

      // Method B: Raw HTML table embedded in .precio-info-raw (Common fallback)
      if (!price) {
        const rawInfo = $(".precio-info-raw").text(); // .text() decodes HTML entities
        if (rawInfo?.includes("<table")) {
          const $table = cheerio.load(rawInfo);
          $table("tr").each((_, row) => {
            const label = $table(row).find("td").eq(0).text().toLowerCase();
            // Pricing is usually in the 3rd column (index 2)
            const priceValText = $table(row).find("td").eq(2).text().replace(/[^\d]/g, "");
            const val = parseInt(priceValText, 10);

            if (!Number.isNaN(val)) {
              if (label.includes("transferencia")) {
                price = val;
              } else if (label.includes("tarjeta") || label.includes("webpay") || label.includes("mercado pago")) {
                if (priceNormal === 0) priceNormal = val;
              }
            }
          });
        }
      }

      // Method C: Fallback to standard WooCommerce price block
      if (!price) {
        const priceElement = $("p.price ins .woocommerce-Price-amount bdi").first();
        const fallbackStr = priceElement.length
          ? priceElement.text()
          : $("p.price .woocommerce-Price-amount bdi").first().text();
        const clean = fallbackStr.replace(/[^\d]/g, "");
        if (clean) price = parseInt(clean, 10);
      }

      if (!priceNormal) priceNormal = price;

      // Sanity check: swap if normal price is lower than cash price (unexpected)
      if (price > 0 && priceNormal > 0 && price > priceNormal) {
        const tmp = price;
        price = priceNormal;
        priceNormal = tmp;
      }

      // 2. Stock extraction
      const stockElement = $(".stock.in-stock");
      const outOfStockElement = $(".stock.out-of-stock, .out-of-stock");

      let stockQuantity: number | undefined;
      let inStock = false;

      // Priority 1: Explicit out of stock indicators
      if (outOfStockElement.length > 0) {
        inStock = false;
      }
      // Priority 2: Explicit in stock indicators
      else if (stockElement.length > 0) {
        inStock = true;

        // Try to parse quantity
        // Case 1: <span class="value">1</span>
        const valueSpan = stockElement.find(".value");
        if (valueSpan.length > 0) {
          const qty = parseInt(valueSpan.text().replace(/[^\d]/g, ""), 10);
          if (!Number.isNaN(qty)) stockQuantity = qty;
        } else {
          // Case 2: Text parsing "Solo queda 1..." or similar
          const text = stockElement.text();
          // Look for digits in text if it mentions "queda" or "stock"
          const numberMatch = text.match(/(\d+)/);
          if (numberMatch && text.toLowerCase().includes("queda")) {
            stockQuantity = parseInt(numberMatch[0], 10);
          }
        }
      }
      // Priority 3: Implicit indicators
      else {
        const hasImmediateDelivery = $(".custom-label.success").text().toLowerCase().includes("entrega inmediata");
        const addToCartBtn = $("button.single_add_to_cart_button");
        const canAddToCart = addToCartBtn.length > 0 && !addToCartBtn.hasClass("disabled");

        if (hasImmediateDelivery || canAddToCart) {
          inStock = true;
        }
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
        // Log simpler message for common issues
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
