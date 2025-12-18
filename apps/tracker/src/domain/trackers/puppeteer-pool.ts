import { Logger } from "@framerate/utils";
import puppeteer, { type Browser } from "puppeteer";

export class PuppeteerPool {
  private browsers: Browser[] = [];
  private availableBrowsers: Browser[] = [];
  private readonly poolSize: number;
  private readonly logger = new Logger("PuppeteerPool");
  private initPromise: Promise<void> | null = null;

  constructor(poolSize = 3) {
    this.poolSize = poolSize;
  }

  async initialize() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.logger.info(`Initializing pool with ${this.poolSize} browsers...`);

      const launchPromises = Array.from({ length: this.poolSize }, () =>
        puppeteer.launch({
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-software-rasterizer",
            "--disable-extensions",
          ],
        }),
      );

      this.browsers = await Promise.all(launchPromises);
      this.availableBrowsers = [...this.browsers];

      this.logger.info(`Pool initialized with ${this.browsers.length} browsers`);

      for (const browser of this.browsers) {
        browser.on("disconnected", () => {
          this.logger.warn("A browser disconnected from the pool");
          this.availableBrowsers = this.availableBrowsers.filter((b) => b !== browser);
        });
      }
    })();

    return this.initPromise;
  }

  async acquire(): Promise<Browser> {
    await this.initialize();

    // Wait until a browser is available
    while (this.availableBrowsers.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const browser = this.availableBrowsers.pop()!;
    return browser;
  }

  release(browser: Browser) {
    if (this.browsers.includes(browser) && browser.isConnected()) {
      this.availableBrowsers.push(browser);
    }
  }

  async destroy() {
    await Promise.all(this.browsers.map((b) => b.close()).filter(Boolean));
    this.browsers = [];
    this.availableBrowsers = [];
    this.initPromise = null;
    this.logger.info("Destroyed all browsers in the pool");
  }
}
