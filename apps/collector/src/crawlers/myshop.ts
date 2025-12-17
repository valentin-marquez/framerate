import { BaseCrawler, type ProductData } from "./base";

// --- Tipos de la API (Basados en la respuesta real) ---

export interface MyShopApiResponse {
	codigo: number;
	servicio: string;
	mensaje: string;
	resultado: MyShopResult;
}

export interface MyShopResult {
	// Array de productos devueltos en la página actual
	items: MyShopItem[];
	// Booleano clave para saber si existen más páginas
	paginacion_show: boolean;
	productos: {
		count: number; // Total de items en la categoría
	};
}

export interface MyShopItem {
	id_producto: number;
	id_familia: number;
	familia: string; // Ej: "Procesadores AMD"
	nombre: string;

	// Identificadores
	codigo: string;
	partno: string; // MPN limpio (Ej: "100-100000065BOX")
	marca: string;

	// Precios (Raw numbers)
	precio: number; // Precio Oferta/Transferencia (El más bajo)
	precio_normal: number; // Precio Lista
	precio_tarjeta: number;

	// Estado y Datos
	nuevo: number; // 0 o 1
	url: string; // URL Relativa: "/producto/..."
	foto: string; // URL Absoluta

	stock_total: number;

	// Label polimórfico: puede ser false (bool) o un string (ej: "Agotado", "-13%")
	label: string | boolean;

	disponibleInternet: boolean;
	disponibleTienda: boolean;
}

// --- Configuración de Categorías ---

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
	gpu: ["33"], // Tarjetas de Video
	cpu: ["143", "144"], // Procesadores AMD e Intel
	psu: ["64"],
	motherboard: ["32"],
	ram: ["35"],
	cpu_cooler: ["150", "151"], // Aire y Líquida
	case: ["36"],
	ssd: ["136", "135"],
	hdd: ["72"],
	case_fan: ["148"],
};

// --- Implementación del Crawler ---

export class MyShopCrawler extends BaseCrawler {
	/**
	 * Implementa la interfaz esperada por processCategory.
	 * Devuelve todas las URLs de productos para una categoría.
	 */
	async getAllProductUrlsForCategory(
		category: MyShopCategory,
	): Promise<string[]> {
		const products = await this.crawlCategory(category);
		return products.map((p) => p.url);
	}
	name = "MyShop";
	baseUrl = "https://www.myshop.cl";
	apiUrl = "https://www.myshop.cl/servicio/producto";

	/**
	 * Método principal que reemplaza getAllProductUrlsForCategory + parseProduct
	 * Extrae todos los productos de una categoría usando la API directamente
	 */
	async crawlCategory(category: MyShopCategory): Promise<ProductData[]> {
		// Obtenemos los IDs de familia para la categoría solicitada
		const familyIds = MYSHOP_CATEGORIES[category];

		if (!familyIds) {
			this.logger.warn(
				`[MyShop] No family IDs configuration for category: ${category}`,
			);
			return [];
		}

		const products: ProductData[] = [];

		// Iterar sobre cada ID de familia (ej: AMD e Intel para CPUs)
		for (const familyId of familyIds) {
			let page = 1;
			let hasMorePages = true;

			this.logger.info(
				`[MyShop] Crawling category ${category} (Family ID: ${familyId})`,
			);

			while (hasMorePages) {
				try {
					this.logger.info(
						`[MyShop] Fetching API Familia ${familyId} - Página ${page}`,
					);

					// Llamada a la API
					const data = await this.fetchApiPage(familyId, page);

					// 1. Validaciones básicas de respuesta
					if (
						!data ||
						!data.resultado ||
						!data.resultado.items ||
						data.resultado.items.length === 0
					) {
						this.logger.info(
							`[MyShop] No items found for family ${familyId} on page ${page}. Stopping.`,
						);
						hasMorePages = false;
						continue;
					}

					// 2. Procesamiento de Items
					for (const item of data.resultado.items) {
						// Normalización de URL
						const itemUrl = item.url.startsWith("http")
							? item.url
							: `${this.baseUrl}${item.url}`;

						// Lógica de Stock Robusta
						// Si el label contiene "agotado", forzamos stock false.
						const isAgotadoLabel =
							typeof item.label === "string" &&
							item.label.toLowerCase().includes("agotado");

						// Hay stock si (stock > 0 O disponible online) Y (no dice "Agotado")
						const hasStock =
							(item.stock_total > 0 || item.disponibleInternet) &&
							!isAgotadoLabel;

						// Limpieza del MPN
						const cleanMpn = item.partno ? item.partno.trim() : "";

						products.push({
							url: itemUrl,
							title: item.nombre,
							// MyShop suele tener 'precio' como el de transferencia (más bajo)
							price: item.precio,
							// Usamos el precio tarjeta como referencia del "original" o más alto
							originalPrice:
								item.precio_tarjeta > item.precio
									? item.precio_tarjeta
									: item.precio_normal,
							stock: hasStock,
							stockQuantity: item.stock_total,
							mpn: cleanMpn, // Mapeo directo del JSON con limpieza
							imageUrl: item.foto,
							specs: {
								manufacturer: item.marca,
								family: item.familia, // Dato extra útil para debug
							},
						});
					}

					// 3. Lógica de Paginación
					// La API tiene una propiedad explícita para saber si mostrar paginación
					if (data.resultado.paginacion_show === true) {
						page++;
						await this.waitRateLimit(); // Respetar rate limits
					} else {
						this.logger.info(
							`[MyShop] No more pages for family ${familyId} (paginacion_show: false)`,
						);
						hasMorePages = false;
					}
				} catch (error) {
					this.logger.error(
						`[MyShop] Error crawling family ${familyId} page ${page}:`,
						String(error),
					);
					// Abortamos esta familia para evitar bucles infinitos en caso de error 500 constante
					hasMorePages = false;
				}
			}
		}

		this.logger.info(
			`[MyShop] Total products found for ${category}: ${products.length}`,
		);
		return products;
	}

	/**
	 * Realiza la petición POST a la API simulando ser el navegador
	 */
	private async fetchApiPage(
		idFamilia: string,
		page: number,
	): Promise<MyShopApiResponse | null> {
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
				Accept: "application/json, text/plain, */*",
				"Sec-Fetch-Site": "same-origin",
				"Sec-Fetch-Mode": "cors",
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			throw new Error(
				`[MyShop] API Status: ${response.status} ${response.statusText}`,
			);
		}

		return (await response.json()) as MyShopApiResponse;
	}

	// Métodos legacy que ya no se usan pero mantenemos por compatibilidad con BaseCrawler
	async getProductUrls(_html: string): Promise<string[]> {
		// No se usa en este crawler porque usamos crawlCategory directamente
		return [];
	}

	async parseProduct(_html: string, _url: string): Promise<ProductData | null> {
		// No se usa en este crawler porque procesamos todo en crawlCategory
		return null;
	}
}
