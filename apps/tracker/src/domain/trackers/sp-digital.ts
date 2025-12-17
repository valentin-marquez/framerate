import puppeteer, { type Browser, type Page } from "puppeteer";
import { BaseTracker, type TrackerResult } from "./base";

export class SpDigitalTracker extends BaseTracker {
	name = "SP Digital";
	domain = "spdigital.cl";
	private browser: Browser | null = null;
	private browserPromise: Promise<Browser> | null = null;

	private async getBrowser(): Promise<Browser> {
		if (this.browser) {
			if (this.browser.isConnected()) {
				return this.browser;
			}
			this.logger.warn("Puppeteer disconnected. Resetting instance.");
			this.browser = null;
			this.browserPromise = null;
		}

		if (this.browserPromise) return this.browserPromise;

		this.logger.info("Launching new Puppeteer instance...");

		this.browserPromise = puppeteer
			.launch({
				headless: true,
				args: [
					"--no-sandbox",
					"--disable-setuid-sandbox",
					"--disable-dev-shm-usage",
					"--disable-gpu",
				],
			})
			.then((browser) => {
				this.logger.info("Puppeteer instance launched.");
				this.browser = browser;
				browser.on("disconnected", () => {
					this.logger.warn("Puppeteer disconnected.");
					this.browser = null;
					this.browserPromise = null;
				});
				return browser;
			});

		return this.browserPromise;
	}

	async track(url: string): Promise<TrackerResult> {
		let page: Page | undefined;
		try {
			this.logger.info(`Starting track for: ${url}`);
			const browser = await this.getBrowser();

			page = await browser.newPage();
			// Block images and fonts to save bandwidth and memory
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

			this.logger.info(`Navigating to page...`);
			await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
			this.logger.info(`Page loaded. Extracting data...`);

			// Extract data using page.evaluate
			// Extract data using page.evaluate
			const data = await page.evaluate(() => {
				const result = {
					priceCash: 0,
					priceNormal: 0,
					stockQuantity: 0,
					available: false,
				};

				// 1. Availability from JSON-LD
				const scripts = document.querySelectorAll(
					'script[type="application/ld+json"]',
				);
				for (const script of scripts) {
					try {
						const json = JSON.parse(script.textContent || "[]");
						const products = Array.isArray(json) ? json : [json];
						// biome-ignore lint/suspicious/noExplicitAny: JSON-LD structure is dynamic
						const product = products.find((p: any) => p["@type"] === "Product");

						if (product?.offers) {
							result.available =
								product.offers.availability === "https://schema.org/InStock";
						}
					} catch (_e) {
						// Ignore parse errors
					}
				}

				// 2. Price Cash (Transfer) from Meta
				const metaPrice = document.querySelector(
					'meta[property="product:price:amount"]',
				);
				if (metaPrice) {
					const content = metaPrice.getAttribute("content");
					if (content) {
						result.priceCash = Number.parseInt(content, 10) || 0;
					}
				}

				// 3. Price Normal (Other payment methods)
				// Look for "Otros medios de pago" and find the price
				const spans = Array.from(document.querySelectorAll("span"));
				const otherPaymentSpan = spans.find((s) =>
					s.textContent?.includes("Otros medios de pago"),
				);
				if (otherPaymentSpan) {
					// The price is usually in a sibling or close container.
					let next = otherPaymentSpan.nextElementSibling;
					while (next) {
						if (next.textContent?.includes("$")) {
							const priceText = next.textContent.replace(/[^\d]/g, "");
							result.priceNormal = Number.parseInt(priceText, 10) || 0;
							break;
						}
						next = next.nextElementSibling;
					}
				}

				// Fallback for normal price if not found (use cash price)
				if (result.priceNormal === 0) {
					result.priceNormal = result.priceCash;
				}

				// 4. Stock Quantity
				// Sum of "Stock online" and "Stock en tienda"
				const stockSpans = spans.filter(
					(s) =>
						s.textContent?.includes("Stock online") ||
						s.textContent?.includes("Stock en tienda"),
				);

				for (const span of stockSpans) {
					// The quantity is in the next sibling div usually
					const parent = span.parentElement;
					if (parent) {
						const quantityDiv = parent.querySelector(
							'div[class*="product-detail-module--availability"]',
						);
						if (quantityDiv) {
							const text = quantityDiv.textContent || "";
							const match = text.match(/(\d+)/);
							if (match?.[1]) {
								result.stockQuantity += Number.parseInt(match[1], 10);
							}
						}
					}
				}

				return result;
			});

			this.logger.info(`Extraction complete: ${JSON.stringify(data)}`);

			return {
				price: data.priceCash,
				priceNormal: data.priceNormal,
				stock: data.available && data.stockQuantity > 0,
				stockQuantity: data.stockQuantity,
				available: data.available,
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
				await page.close();
			}
		}
	}
}
