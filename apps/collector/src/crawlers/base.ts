import type { GpuSpecs } from "@framerate/db";
import type { Browser, Page } from "puppeteer";
import { Logger } from "@/lib/logger";

export interface ProductData {
  url: string;
  title: string;
  price?: number | null;
  originalPrice?: number | null;
  stock: boolean;
  stockQuantity?: number | null;
  mpn?: string | null;
  imageUrl?: string | null;
  specs?: GpuSpecs | Record<string, string>;
  // Optional arbitrary context (HTML/text) useful for AI extraction
  context?: unknown;
}

// Pool de páginas para concurrencia
interface PagePool {
  browser: Browser;
  pages: Page[];
  availablePages: Page[];
}

export abstract class BaseCrawler<T = string> {
  abstract name: string;
  abstract baseUrl: string;

  protected logger: Logger;
  protected requestDelay = 1000; // Reducido de 2000 a 1000
  protected lastRequestTime = 0;
  protected useHeadless = false;
  protected concurrency = 3; // Número de páginas concurrentes

  // Instancia de navegador compartida para reutilización
  private static browserInstance: Browser | null = null;
  private static pagePool: PagePool | null = null;

  protected userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ];

  constructor() {
    this.logger = new Logger("Crawler");
  }

  /**
   * Obtiene o crea una instancia compartida del navegador.
   */
  protected async getBrowser(): Promise<Browser> {
    if (!BaseCrawler.browserInstance) {
      // Prefer puppeteer-extra + stealth plugin to reduce detection. Fall back to plain puppeteer if not available.
      try {
        // Dynamically import and handle default interop
        const puppeteerExtraModule: unknown = await import("puppeteer-extra");
        const stealthModule: unknown = await import("puppeteer-extra-plugin-stealth");
        // Cast to any only where necessary for runtime calls
        const puppeteerExtra =
          (puppeteerExtraModule as unknown as any)?.default || (puppeteerExtraModule as unknown as any);
        // biome-ignore lint/suspicious/noExplicitAny: runtime plugin interop
        const stealthPlugin = (stealthModule as unknown as any)?.default || (stealthModule as unknown as any);

        // biome-ignore lint/suspicious/noExplicitAny: using plugin API at runtime
        (puppeteerExtra as any).use((stealthPlugin as any)());

        // biome-ignore lint/suspicious/noExplicitAny: launching puppeteer-extra
        BaseCrawler.browserInstance = await (puppeteerExtra as any).launch({
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-first-run",
            "--no-zygote",
            "--disable-extensions",
            "--disable-background-networking",
            "--disable-sync",
            "--disable-translate",
            "--metrics-recording-only",
            "--mute-audio",
            "--no-default-browser-check",
            "--safebrowsing-disable-auto-update",
          ],
        });

        this.logger.info("Browser instance created using puppeteer-extra + stealth plugin");
      } catch (err) {
        // Fallback to standard puppeteer
        this.logger.warn("puppeteer-extra or stealth plugin not available, falling back to puppeteer: ", String(err));
        const puppeteer = await import("puppeteer");
        BaseCrawler.browserInstance = await puppeteer.launch({
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-first-run",
            "--no-zygote",
            "--disable-extensions",
            "--disable-background-networking",
            "--disable-sync",
            "--disable-translate",
            "--metrics-recording-only",
            "--mute-audio",
            "--no-default-browser-check",
            "--safebrowsing-disable-auto-update",
          ],
        });
        this.logger.info("Browser instance created using puppeteer");
      }
    }

    if (!BaseCrawler.browserInstance) throw new Error("Browser instance not initialized");
    return BaseCrawler.browserInstance;
  }

  /**
   * Cierra el navegador compartido.
   */
  public async closeBrowser(): Promise<void> {
    if (BaseCrawler.pagePool) {
      for (const page of BaseCrawler.pagePool.pages) {
        try {
          await page.close();
        } catch {
          // Ignorar errores al cerrar páginas
        }
      }
      BaseCrawler.pagePool = null;
    }
    if (BaseCrawler.browserInstance) {
      await BaseCrawler.browserInstance.close();
      BaseCrawler.browserInstance = null;
      this.logger.info("Browser instance closed");
    }
  }

  /**
   * Obtiene una página del pool o crea una nueva.
   */
  protected async getPage(): Promise<Page> {
    const browser = await this.getBrowser();

    if (!BaseCrawler.pagePool) {
      BaseCrawler.pagePool = {
        browser,
        pages: [],
        availablePages: [],
      };
    }

    // Si hay páginas disponibles, usar una
    if (BaseCrawler.pagePool.availablePages.length > 0) {
      const page = BaseCrawler.pagePool.availablePages.pop();
      if (page) return page;
    }

    // Si no hemos alcanzado el límite, crear una nueva
    if (BaseCrawler.pagePool.pages.length < this.concurrency) {
      const page = await browser.newPage();
      await page.setUserAgent(this.getUserAgent());
      // Optimizaciones de página
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        const resourceType = request.resourceType();
        // Bloquear recursos innecesarios para acelerar la carga
        if (["image", "stylesheet", "font", "media"].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });
      BaseCrawler.pagePool.pages.push(page);
      return page;
    }

    // Esperar hasta que una página esté disponible
    while (BaseCrawler.pagePool.availablePages.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const page = BaseCrawler.pagePool.availablePages.pop();
    if (page) return page;

    // Fallback: crear nueva página
    return browser.newPage();
  }

  /**
   * Devuelve una página al pool.
   */
  protected releasePage(page: Page): void {
    if (BaseCrawler.pagePool) {
      BaseCrawler.pagePool.availablePages.push(page);
    }
  }

  public async fetchHtml(url: string, waitForSelector?: string): Promise<string> {
    this.logger = new Logger(this.name || "Crawler");
    await this.waitRateLimit();

    if (this.useHeadless) {
      return this.fetchWithPuppeteer(url, waitForSelector);
    }

    return this.fetchWithFetch(url);
  }

  private async fetchWithFetch(url: string): Promise<string> {
    // Usar siempre el UA de Windows para coincidir con los encabezados Sec-Ch-Ua-Platform
    const userAgent = this.userAgents[0];
    try {
      this.logger.info(`Fetching: ${url}`);
      const response = await fetch(url, {
        headers: {
          "User-Agent": userAgent,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "Accept-Language": "es-419,es;q=0.9,en;q=0.8",
          "Cache-Control": "max-age=0",
          "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"Windows"',
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      this.logger.error(`Error fetching ${url}:`, String(error));
      throw error;
    }
  }

  private async fetchWithPuppeteer(url: string, waitForSelector?: string): Promise<string> {
    const page = await this.getPage();

    try {
      this.logger.info(`Fetching (Headless): ${url}`);
      await page.goto(url, {
        waitUntil: "domcontentloaded", // Más rápido que networkidle2
        timeout: 30000,
      });

      // Esperar a que el contenido principal esté cargado
      await page.waitForSelector("body", { timeout: 10000 });

      if (waitForSelector) {
        try {
          await page.waitForSelector(waitForSelector, { timeout: 5000 });
        } catch (_e) {
          this.logger.warn(`Timeout waiting for selector: ${waitForSelector}`);
        }
      }

      const content = await page.content();
      this.releasePage(page);
      return content;
    } catch (error) {
      this.releasePage(page);
      this.logger.error(`Error fetching (Headless) ${url}:`, String(error));
      throw error;
    }
  }

  /**
   * Procesa múltiples URLs en paralelo con un límite de concurrencia.
   */
  public async fetchHtmlBatch(urls: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    // Procesar en lotes según la concurrencia
    for (let i = 0; i < urls.length; i += this.concurrency) {
      const batch = urls.slice(i, i + this.concurrency);
      const batchPromises = batch.map(async (url) => {
        try {
          const html = await this.fetchHtml(url);
          return { url, html, error: null };
        } catch (error) {
          return { url, html: null, error };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      for (const result of batchResults) {
        if (result.html) {
          results.set(result.url, result.html);
        }
      }
    }

    return results;
  }

  protected async waitRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.requestDelay) {
      const waitTime = this.requestDelay - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  protected getUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  abstract parseProduct(html: string, url: string): Promise<ProductData | null>;
  abstract getProductUrls(html: string): Promise<string[]>;
}
