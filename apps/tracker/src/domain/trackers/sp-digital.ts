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
      // Construct JSON URL
      // URL format: https://www.spdigital.cl/slug/
      const match = url.match(/spdigital\.cl\/([^/]+)\/?$/);
      if (!match?.[1]) {
        throw new Error(`Invalid SP Digital URL: ${url}`);
      }
      const slug = match[1];
      const jsonUrl = `https://www.spdigital.cl/page-data/${slug}/page-data.json`;

      browser = await this.puppeteerPool.acquire();
      page = await browser.newPage();

      await page.setRequestInterception(true);
      page.on("request", (req) => {
        ["image", "stylesheet", "font"].includes(req.resourceType()) ? req.abort() : req.continue();
      });
      await page.setUserAgent(getUserAgent());

      this.logger.info(`Fetching JSON for product: ${jsonUrl}`);
      const response = await page.goto(jsonUrl, { waitUntil: "networkidle2", timeout: 30000 });

      if (!response || !response.ok()) {
        throw new Error(`Failed to fetch JSON: ${response?.status()} ${response?.statusText()}`);
      }

      // Extract JSON content
      const jsonText = await page.evaluate(() => document.body.innerText);
      const data = JSON.parse(jsonText);

      const content = data?.result?.pageContext?.content;
      if (!content) {
        throw new Error("Invalid JSON structure: content not found");
      }

      // Extract Price
      let priceCash = 0;
      let priceNormal = 0;
      const metadata = content.metadata || [];
      const pricingMeta = metadata.find((m: any) => m.key === "pricing");
      
      if (pricingMeta?.value) {
        try {
          const pricing = JSON.parse(pricingMeta.value);
          if (pricing["sp-digital"]) {
            priceCash = pricing["sp-digital"].cash || 0;
            priceNormal = pricing["sp-digital"].other || 0;
          }
        } catch (e) {
          this.logger.warn(`Error parsing pricing JSON for ${url}: ${e}`);
        }
      }

      // Fallback if pricing meta is missing or empty
      if (priceCash === 0) {
         // Try to find price in other metadata or attributes if needed, 
         // but usually it's in the pricing meta.
      }
      if (priceNormal === 0) priceNormal = priceCash;

      // Extract Stock
      const defaultVariant = content.defaultVariant;
      const quantityAvailable = defaultVariant?.quantityAvailable || 0;
      const quantityInStore = defaultVariant?.quantityInStore || 0;
      const quantityOnline = defaultVariant?.quantityOnline || 0;

      // Logic: if any stock is available, it's in stock.
      // Use quantityAvailable as the main stock count.
      const stockQuantity = quantityAvailable;
      const hasStock = stockQuantity > 0 || quantityInStore > 0 || quantityOnline > 0;

      return {
        price: priceCash,
        priceNormal: priceNormal,
        stock: hasStock,
        stockQuantity: stockQuantity,
        available: hasStock,
        url: url,
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
