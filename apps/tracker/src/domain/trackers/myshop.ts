import pLimit from "p-limit";
import type { TrackerResult } from "./base";
import { BaseTracker } from "./base";

interface MyShopApiResponse {
	codigo: number;
	servicio: string;
	mensaje: string;
	resultado: MyShopResult;
}

interface MyShopResult {
	items: MyShopItem[];
	paginacion_show: boolean;
	productos: {
		count: number;
	};
}

interface MyShopItem {
	id_producto: number;
	nombre: string;
	partno: string;
	marca: string;
	precio: number;
	precio_normal: number;
	precio_tarjeta: number;
	stock_total: number;
	label: string | boolean;
	disponibleInternet: boolean;
	disponibleTienda: boolean;
	url: string;
}

const MYSHOP_CATEGORIES: Record<string, string[]> = {
	gpu: ["33"],
	cpu: ["143", "144"],
	psu: ["64"],
	motherboard: ["32"],
	ram: ["35"],
	cpu_cooler: ["150", "151"],
	case: ["36"],
	ssd: ["136", "135"],
	hdd: ["72"],
	case_fan: ["148"],
};

export class MyShopTracker extends BaseTracker {
	name = "MyShop";
	domain = "myshop.cl";
	private baseUrl = "https://www.myshop.cl";
	private apiUrl = "https://www.myshop.cl/servicio/producto";

	// In-memory cache: MPN -> Product data
	private mpnCache: Map<string, MyShopItem> = new Map();
	private cacheTimestamp: number = 0;
	private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

	// CRITICAL: Prevent multiple simultaneous cache refreshes
	private isRefreshing = false;
	private refreshPromise: Promise<void> | null = null;

	// Per-family (category) cache to allow targeted refresh/search.
	private familyCache: Map<string, Set<string>> = new Map();
	private familyCacheTimestamps: Map<string, number> = new Map();
	private readonly FAMILY_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

	// Network timeouts & limits
	private readonly FETCH_TIMEOUT_MS = 15_000;
	private readonly MAX_PAGES_PER_FAMILY = 50;

	// Concurrency and retry strategy - CONSERVATIVE
	private readonly MAX_CONCURRENT_REQUESTS = 2;
	private readonly MAX_RETRIES = 3;
	private readonly RETRY_BASE_MS = 1000;
	private readonly PAGE_DELAY_MS = 400; // Increased delay
	private requestLimiter = pLimit(this.MAX_CONCURRENT_REQUESTS);

	// Request counter for debugging
	private requestCount = 0;
	private successCount = 0;
	private failureCount = 0;

	async track(url: string): Promise<TrackerResult> {
		await this.ensureCache();

		this.logger.warn(
			`[MyShop] Cannot track by URL alone: ${url}. Use trackByMpn instead.`,
		);

		return {
			price: 0,
			stock: false,
			available: false,
		};
	}

	async trackByMpn(mpn: string): Promise<TrackerResult> {
		const cleanMpn = mpn.trim().toUpperCase();

		await this.ensureCache();
		let product = this.mpnCache.get(cleanMpn);
		if (product) return this.productToTrackerResult(product);

		this.logger.info(
			`[MyShop] MPN ${cleanMpn} not in global cache, searching categories...`,
		);
		try {
			product = await this.findProductByMpnFallback(cleanMpn);
			if (product) {
				this.mpnCache.set(cleanMpn, product);
				return this.productToTrackerResult(product);
			}
		} catch (err) {
			this.logger.error(`[MyShop] Error searching MPN ${cleanMpn}:`, err);
		}

		this.logger.warn(`[MyShop] Product not found for MPN: ${mpn}`);
		return {
			price: 0,
			stock: false,
			available: false,
		};
	}

	async trackBatch(mpns: string[]): Promise<Map<string, TrackerResult>> {
		await this.ensureCache();

		const results = new Map<string, TrackerResult>();

		for (const mpn of mpns) {
			const cleanMpn = mpn.trim().toUpperCase();
			let product = this.mpnCache.get(cleanMpn);

			if (!product) {
				try {
					product = await this.findProductByMpnFallback(cleanMpn);
					if (product) this.mpnCache.set(cleanMpn, product);
				} catch (err) {
					this.logger.error(
						`[MyShop] Error looking up MPN ${cleanMpn} in batch:`,
						err,
					);
				}
			}

			if (product) {
				results.set(mpn, this.productToTrackerResult(product));
			} else {
				results.set(mpn, {
					price: 0,
					stock: false,
					available: false,
				});
			}
		}

		return results;
	}

	/**
	 * CRITICAL FIX: Ensures only ONE cache refresh happens at a time
	 */
	private async ensureCache(): Promise<void> {
		const now = Date.now();

		// Cache is still valid
		if (this.mpnCache.size > 0 && now - this.cacheTimestamp < this.CACHE_TTL) {
			return;
		}

		// Already refreshing - wait for existing refresh to complete
		if (this.isRefreshing && this.refreshPromise) {
			this.logger.info(
				"[MyShop] Cache refresh already in progress, waiting...",
			);
			await this.refreshPromise;
			return;
		}

		// Start new refresh
		this.isRefreshing = true;
		this.logger.info("[MyShop] Starting cache refresh...");
		this.logger.info(
			`[MyShop] Config: concurrency=${this.MAX_CONCURRENT_REQUESTS}, pageDelay=${this.PAGE_DELAY_MS}ms, timeout=${this.FETCH_TIMEOUT_MS}ms`,
		);

		this.refreshPromise = this.refreshCache().finally(() => {
			this.isRefreshing = false;
			this.refreshPromise = null;
		});

		await this.refreshPromise;
	}

	private async refreshCache(): Promise<void> {
		this.mpnCache.clear();
		this.requestCount = 0;
		this.successCount = 0;
		this.failureCount = 0;

		// Fetch categories SEQUENTIALLY to avoid rate limiting
		for (const [category, familyIds] of Object.entries(MYSHOP_CATEGORIES)) {
			this.logger.info(`[MyShop] Processing category: ${category}`);

			for (const familyId of familyIds) {
				await this.fetchFamilyCompletely(category, familyId);

				// Add delay between families to avoid rate limiting
				await this.delay(500);
			}
		}

		this.cacheTimestamp = Date.now();
		this.logger.info(
			`[MyShop] Cache refresh completed! Products: ${this.mpnCache.size}, Requests: ${this.requestCount}, Success: ${this.successCount}, Failed: ${this.failureCount}`,
		);
	}

	/**
	 * Fetch all pages for a single family
	 */
	private async fetchFamilyCompletely(
		category: string,
		familyId: string,
	): Promise<void> {
		let page = 1;
		let hasMorePages = true;

		this.logger.info(`[MyShop] Fetching family ${familyId} (${category})...`);

		while (hasMorePages && page <= this.MAX_PAGES_PER_FAMILY) {
			try {
				const data = await this.fetchApiPage(familyId, page);

				if (!data?.resultado?.items || data.resultado.items.length === 0) {
					this.logger.info(
						`[MyShop] Family ${familyId} completed at page ${page - 1}`,
					);
					hasMorePages = false;
					break;
				}

				// Add products to cache
				let addedCount = 0;
				for (const item of data.resultado.items) {
					if (item.partno) {
						const cleanMpn = item.partno.trim().toUpperCase();
						this.mpnCache.set(cleanMpn, item);
						addedCount++;
					}
				}

				this.logger.info(
					`[MyShop] Family ${familyId} page ${page}: +${addedCount} products (cache size: ${this.mpnCache.size})`,
				);

				// Check if there are more pages
				hasMorePages = data.resultado.paginacion_show === true;

				if (hasMorePages) {
					page++;
					// Delay between pages to avoid rate limiting
					await this.delay(this.PAGE_DELAY_MS);
				}
			} catch (error) {
				this.logger.error(
					`[MyShop] Error fetching family ${familyId} page ${page}:`,
					error,
				);
				hasMorePages = false;
			}
		}

		this.logger.info(
			`[MyShop] Family ${familyId} done: ${page - 1} pages processed`,
		);
	}

	private async fetchApiPageOnce(
		idFamilia: string,
		page: number,
	): Promise<MyShopApiResponse> {
		const payload = {
			tipo: "3",
			page: String(page),
			idFamilia: idFamilia,
		};

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT_MS);

		const bodyStr = JSON.stringify(payload);
		const contentLength = String(new TextEncoder().encode(bodyStr).length);

		const headers: Record<string, string> = {
			Host: "www.myshop.cl",
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0",
			Accept: "application/json, text/plain, */*",
			"Accept-Language": "es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3",
			"Accept-Encoding": "gzip, deflate, br",
			"Content-Type": "application/json",
			"Content-Length": contentLength,
			Origin: this.baseUrl,
			"Sec-Gpc": "1",
			Referer: `${this.baseUrl}/partes-y-piezas-procesadores`,
			"Sec-Fetch-Dest": "empty",
			"Sec-Fetch-Mode": "cors",
			"Sec-Fetch-Site": "same-origin",
			Te: "trailers",
		};

		if (process.env.MYSHOP_COOKIE) {
			headers.Cookie = process.env.MYSHOP_COOKIE as string;
		}

		this.requestCount++;
		const requestId = this.requestCount;

		try {
			const response = await fetch(this.apiUrl, {
				method: "POST",
				headers,
				body: bodyStr,
				signal: controller.signal,
			});

			if (!response.ok) {
				const retryAfter = response.headers.get("retry-after");
				const responseText = await response.text().catch(() => "");

				this.logger.error(
					`[MyShop] Request #${requestId} FAILED: status=${response.status}, body=${responseText.slice(0, 150)}`,
				);

				if (response.status === 429) {
					throw new Error(
						`[MyShop] API Status: 429. Retry-After:${retryAfter ?? ""}`,
					);
				}
				if (response.status === 403) {
					this.logger.error(
						`[MyShop] 403 Forbidden on request #${requestId}. Consider using MYSHOP_COOKIE or reducing request rate.`,
					);
				}
				throw new Error(
					`[MyShop] API Status: ${response.status} ${response.statusText}`,
				);
			}

			const data = (await response.json()) as MyShopApiResponse;
			this.successCount++;
			return data;
		} catch (err) {
			this.failureCount++;
			if (err instanceof Error && err.name === "AbortError") {
				throw new Error(
					`[MyShop] fetch timeout after ${this.FETCH_TIMEOUT_MS}ms`,
				);
			}
			throw err;
		} finally {
			clearTimeout(timeout);
		}
	}

	private async fetchApiPage(
		idFamilia: string,
		page: number,
	): Promise<MyShopApiResponse | undefined> {
		for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
			try {
				return await this.requestLimiter(() =>
					this.fetchApiPageOnce(idFamilia, page),
				);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);

				// Handle 429 with Retry-After
				const m = message.match(/Retry-After:(\d+)/);
				if (message.includes("429") && m) {
					const waitMs = Number(m[1]) * 1000 + Math.round(Math.random() * 500);
					this.logger.warn(
						`[MyShop] 429 for family ${idFamilia} page ${page}, waiting ${waitMs}ms (attempt ${attempt + 1}/${this.MAX_RETRIES})`,
					);
					await this.delay(waitMs);
					continue;
				}

				// Handle 403 - longer backoff
				if (message.includes("403")) {
					if (attempt === this.MAX_RETRIES) {
						this.logger.error(
							`[MyShop] Failed with 403 after ${this.MAX_RETRIES} attempts. Consider using MYSHOP_COOKIE environment variable.`,
						);
						return undefined;
					}

					const backoff = Math.min(
						this.RETRY_BASE_MS * 2 ** (attempt + 2) + Math.random() * 1000,
						20_000,
					);
					this.logger.warn(
						`[MyShop] 403 for family ${idFamilia} page ${page}, waiting ${backoff}ms (attempt ${attempt + 1}/${this.MAX_RETRIES})`,
					);
					await this.delay(backoff);
					continue;
				}

				if (attempt === this.MAX_RETRIES) {
					this.logger.error(
						`[MyShop] Failed after ${this.MAX_RETRIES} attempts:`,
						err,
					);
					return undefined;
				}

				const backoff = Math.min(
					this.RETRY_BASE_MS * 2 ** attempt + Math.random() * 500,
					10_000,
				);
				this.logger.warn(
					`[MyShop] Retry in ${backoff}ms (attempt ${attempt + 1}/${this.MAX_RETRIES})`,
				);
				await this.delay(backoff);
			}
		}

		return undefined;
	}

	private async findProductByMpnFallback(
		cleanMpn: string,
	): Promise<MyShopItem | undefined> {
		// Quick scan family cache
		for (const [_familyId, set] of this.familyCache.entries()) {
			if (set.has(cleanMpn)) {
				const item = this.mpnCache.get(cleanMpn);
				if (item) return item;
			}
		}

		// Search through families
		for (const familyIds of Object.values(MYSHOP_CATEGORIES)) {
			for (const familyId of familyIds) {
				try {
					const ts = this.familyCacheTimestamps.get(familyId) ?? 0;
					if (Date.now() - ts < this.FAMILY_CACHE_TTL) {
						const set = this.familyCache.get(familyId);
						if (set && !set.has(cleanMpn)) continue;
					}

					const found = await this.fetchProductByMpn(familyId, cleanMpn);
					this.familyCacheTimestamps.set(familyId, Date.now());
					if (found) {
						this.mpnCache.set(cleanMpn, found);
						let set = this.familyCache.get(familyId);
						if (!set) {
							set = new Set();
							this.familyCache.set(familyId, set);
						}
						set.add(cleanMpn);
						return found;
					}
				} catch (err) {
					this.logger.error(
						`[MyShop] Error searching family ${familyId} for ${cleanMpn}:`,
						err,
					);
				}
			}
		}

		return undefined;
	}

	private async fetchProductByMpn(
		idFamilia: string,
		cleanMpn: string,
	): Promise<MyShopItem | undefined> {
		let page = 1;
		let pagesChecked = 0;

		while (pagesChecked < this.MAX_PAGES_PER_FAMILY) {
			pagesChecked++;
			try {
				const data = await this.fetchApiPage(idFamilia, page);
				if (!data?.resultado?.items || data.resultado.items.length === 0)
					return undefined;

				for (const item of data.resultado.items) {
					if (item.partno && item.partno.trim().toUpperCase() === cleanMpn)
						return item;
				}

				if (data.resultado.paginacion_show === true) {
					page++;
					await this.delay(this.PAGE_DELAY_MS);
					continue;
				}
				return undefined;
			} catch (err) {
				this.logger.error(
					`[MyShop] Error fetching family ${idFamilia} page ${page}:`,
					err,
				);
				return undefined;
			}
		}

		return undefined;
	}

	private productToTrackerResult(product: MyShopItem): TrackerResult {
		const isAgotadoLabel =
			typeof product.label === "string" &&
			product.label.toLowerCase().includes("agotado");

		const hasStock =
			(product.stock_total > 0 || product.disponibleInternet) &&
			!isAgotadoLabel;

		return {
			price: product.precio,
			priceNormal:
				product.precio_tarjeta > product.precio
					? product.precio_tarjeta
					: product.precio_normal,
			stock: hasStock,
			stockQuantity: product.stock_total,
			available: hasStock,
			url: product.url.startsWith("http")
				? product.url
				: `${this.baseUrl}${product.url}`,
			meta: {
				disponibleInternet: product.disponibleInternet,
				disponibleTienda: product.disponibleTienda,
				marca: product.marca,
				label: product.label,
			},
		};
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	getCacheStats() {
		return {
			size: this.mpnCache.size,
			age: Date.now() - this.cacheTimestamp,
			ttl: this.CACHE_TTL,
			requests: this.requestCount,
			success: this.successCount,
			failures: this.failureCount,
			isRefreshing: this.isRefreshing,
		};
	}

	async forceCacheRefresh(): Promise<void> {
		this.cacheTimestamp = 0; // Force refresh on next ensureCache
		await this.ensureCache();
	}
}
