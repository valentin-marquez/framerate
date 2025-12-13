import { BaseCrawler, type ProductData } from "./base";

// Definición de Tipos de la API (Basado en tu myshop-request.ts)
interface MyShopResponse {
	resultado: {
		items: MyShopItem[];
		paginacion: {
			paginacion_show: boolean;
		}[]; // Simplificado
		productos: {
			ini: number;
			fin: number;
			count: number;
		};
	};
}

interface MyShopItem {
	id_producto: number;
	nombre: string;
	partno: string; // MPN
	marca: string;
	precio: number; // Precio efectivo
	precio_normal: number;
	precio_tarjeta: number;
	precio_tarjeta_fmt: string;
	url: string;
	foto: string;
	stock_total: number;
	disponibleInternet: boolean;
	disponibleTienda: boolean;
}

export type MyShopCategory =
	| "gpu"
	| "cpu"
	| "psu"
	| "motherboard"
	| "case"
	| "ram"
	| "hdd"
	| "ssd"
	| "case_fan"
	| "cpu_cooler";

// Mapeo de categorías de Framerate -> idFamilia de MyShop
export const MYSHOP_CATEGORIES: Record<MyShopCategory, string[]> = {
	gpu: ["33"],
	cpu: ["143"],
	psu: ["64"],
	motherboard: ["32"],
	ram: ["35"],
	cpu_cooler: ["150", "151"], // Aire y Líquida
	case_fan: ["148"],
	case: ["36"],
	hdd: ["72"],
	ssd: ["136", "135"],
};

export class MyShopCrawler extends BaseCrawler {
	name = "MyShop";
	baseUrl = "https://www.myshop.cl";
	apiUrl = "https://www.myshop.cl/servicio/producto";

	// Cache para almacenar los datos "ricos" de la API y no perderlos al pasar a parseProduct
	private productApiCache = new Map<string, MyShopItem>();

	/**
	 * Obtiene todas las URLs usando la API POST en lugar de navegar HTML.
	 */
	async getAllProductUrlsForCategory(
		category: MyShopCategory,
	): Promise<string[]> {
		const familyIds = MYSHOP_CATEGORIES[category];
		const allUrls: string[] = [];

		this.logger.info(
			`[MyShop] Iniciando scrape API para categoría: ${category} (IDs: ${familyIds.join(", ")})`,
		);

		for (const idFamilia of familyIds) {
			let page = 1;
			let hasMore = true;

			while (hasMore) {
				try {
					this.logger.info(
						`[MyShop] Fetching API Familia ${idFamilia} - Pagina ${page}`,
					);
					const data = await this.fetchApiPage(idFamilia, page);

					if (
						!data ||
						!data.resultado.items ||
						data.resultado.items.length === 0
					) {
						hasMore = false;
						continue;
					}

					for (const item of data.resultado.items) {
						// Construir URL absoluta
						const fullUrl = item.url.startsWith("http")
							? item.url
							: `${this.baseUrl}${item.url}`;

						// Guardar en cache para usar en parseProduct sin re-scrape
						this.productApiCache.set(fullUrl, item);
						allUrls.push(fullUrl);
					}

					// Verificar si hay más páginas
					// La lógica de paginación de MyShop a veces es tricky, verificamos si devolvió items
					// y si el contador de productos indica que faltan.
					const { count, fin } = data.resultado.productos;
					if (fin >= count || data.resultado.items.length === 0) {
						hasMore = false;
					} else {
						page++;
						// Pequeña pausa para no saturar la API
						await this.waitRateLimit();
					}
				} catch (error) {
					this.logger.error(
						`Error en API MyShop (Pag ${page}):`,
						String(error),
					);
					hasMore = false;
				}
			}
		}

		const uniqueUrls = [...new Set(allUrls)];
		this.logger.info(
			`[MyShop] Total URLs encontradas para ${category}: ${uniqueUrls.length}`,
		);
		return uniqueUrls;
	}

	/**
	 * Realiza la petición POST a la API simulando ser el navegador
	 */
	private async fetchApiPage(
		idFamilia: string,
		page: number,
	): Promise<MyShopResponse | null> {
		const payload = {
			tipo: "3",
			page: String(page),
			idFamilia: idFamilia,
		};

		const response = await fetch(this.apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"User-Agent": this.getUserAgent(),
				Origin: this.baseUrl,
				Referer: this.baseUrl,
				// Headers adicionales copiados de tu myshop-request.ts
				Accept: "application/json, text/plain, */*",
				"Sec-Fetch-Site": "same-origin",
				"Sec-Fetch-Mode": "cors",
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			throw new Error(`API Status: ${response.status}`);
		}

		return (await response.json()) as MyShopResponse;
	}

	async getProductUrls(html: string): Promise<string[]> {
		// No se usa en este crawler porque sobrescribimos getAllProductUrlsForCategory
		return [];
	}

	async parseProduct(html: string, url: string): Promise<ProductData | null> {
		// 1. Intentar recuperar datos de la cache de la API
		const apiData = this.productApiCache.get(url);

		if (!apiData) {
			this.logger.warn(
				`[MyShop] Producto no encontrado en cache API, saltando: ${url}`,
			);
			// Fallback: Si quisieras, podrías implementar scraping HTML puro aquí
			return null;
		}

		// 2. Construir objeto base con datos de alta calidad de la API
		const product: ProductData = {
			url,
			title: apiData.nombre,
			price: apiData.precio, // Precio oferta/transferencia
			originalPrice: apiData.precio_tarjeta,
			stock: apiData.stock_total > 0,
			stockQuantity: apiData.stock_total,
			mpn: apiData.partno, // Dato vital para tu sistema
			imageUrl: apiData.foto,
			specs: {
				manufacturer: apiData.marca,
			},
		};

		// 3. (Opcional) Parsear HTML para specs adicionales
		// Como el sistema tiene normalización por IA usando el MPN,
		// quizás no sea estrictamente necesario scrapear la tabla de specs del HTML
		// si el HTML es complejo o sucio.
		// Sin embargo, si quieres extraer specs del HTML, aquí iría el HTMLRewriter.

		try {
			// Ejemplo simple para extraer descripción si existe
			const rewriter = new HTMLRewriter();
			// Aquí agregarías lógica si descubres selectores específicos para specs en el HTML
			// Por ahora, confiamos en el MPN + API Data
			rewriter.transform(html);
		} catch (e) {
			this.logger.warn(`Error parsing HTML details for ${url}: ${e}`);
		}

		// Limpieza de datos
		if (product.mpn) {
			// A veces el MPN viene sucio en MyShop
			product.mpn = product.mpn.trim();
		}

		return product;
	}
}
