import * as cheerio from "cheerio";
import type { Category, CategoryMap } from "@/constants/categories";
import { BaseCrawler, type ProductData } from "./base";

export const CENTRALE_CATEGORIES: CategoryMap<string[]> = {
  ssd: [
    "https://centrale.cl/categoria-producto/computadores/componentes-de-pc/almacenamiento-para-pc/?wpf_filter_tipo=ssd-m-2-sata|ssd-nvme|ssd-sata",
  ],
  hdd: [
    "https://centrale.cl/categoria-producto/computadores/componentes-de-pc/almacenamiento-para-pc/?wpf_filter_tipo=hdd",
  ],
  psu: ["https://centrale.cl/categoria-producto/computadores/componentes-de-pc/fuentes-de-poder-para-pc/"],
  cpu: ["https://centrale.cl/categoria-producto/computadores/componentes-de-pc/procesadores-para-pc/"],
  ram: ["https://centrale.cl/categoria-producto/computadores/componentes-de-pc/memorias-ram-para-pc/"],
  cpu_cooler: [
    "https://centrale.cl/categoria-producto/computadores/componentes-de-pc/refrigeracion-para-pc/?wpf_filter_tipo=air-cooler",
    "https://centrale.cl/categoria-producto/computadores/componentes-de-pc/refrigeracion-para-pc/?wpf_filter_tipo=water-cooler",
  ],
  case_fan: [
    "https://centrale.cl/categoria-producto/computadores/componentes-de-pc/refrigeracion-para-pc/?wpf_filter_tipo=ventilador",
  ],
  case: ["https://centrale.cl/categoria-producto/computadores/componentes-de-pc/gabinetes-para-pc/"],
  // Not available/mapped for this store
  gpu: [],
  motherboard: [],
};

export class CentraleCrawler extends BaseCrawler<Category> {
  name = "Centrale";
  baseUrl = "https://centrale.cl";

  protected useHeadless = true;

  async getAllProductUrlsForCategory(category: Category): Promise<string[]> {
    const urls: string[] = [];
    const categoryUrls = CENTRALE_CATEGORIES[category];

    if (!categoryUrls || categoryUrls.length === 0) {
      this.logger.warn(`No URLs configured for category: ${category}`);
      return [];
    }

    for (const startUrl of categoryUrls) {
      let page = 1;
      let hasNextPage = true;

      this.logger.info(`Crawling category ${category} from ${startUrl}`);

      while (hasNextPage) {
        // Build the paginated URL
        let pageUrl: string;
        if (page === 1) {
          pageUrl = startUrl;
        } else {
          // Pagination pattern: insert /page/N/ before query params
          const urlObj = new URL(startUrl);
          const basePath = urlObj.pathname.replace(/\/$/, "");
          urlObj.pathname = `${basePath}/page/${page}/`;
          pageUrl = urlObj.toString();
        }

        try {
          this.logger.info(`Fetching page ${page}: ${pageUrl}`);
          const html = await this.fetchHtml(pageUrl, ".products");

          // Check for 404 page
          if (
            html.includes("Oops! That page can't be found") ||
            html.includes("page-title") ||
            html.includes("error-404")
          ) {
            this.logger.info(`Page ${page} not found or content end. Stopping.`);
            hasNextPage = false;
            break;
          }

          const pageUrls = this.extractUrlsFromList(html, category);

          if (pageUrls.length === 0) {
            this.logger.info(`No products found on page ${page}. Stopping.`);
            hasNextPage = false;
            break;
          }

          urls.push(...pageUrls);
          page++;

          await this.waitRateLimit();
        } catch (error) {
          const errString = String(error);
          if (errString.includes("404")) {
            this.logger.info(`Page ${page} returned 404. Stopping category.`);
          } else {
            this.logger.error(`Error fetching page ${page} of ${category}:`, errString);
          }
          hasNextPage = false;
        }
      }
    }

    // Deduplicate
    return [...new Set(urls)];
  }

  private extractUrlsFromList(html: string, _category: Category): string[] {
    const $ = cheerio.load(html);
    const urls: string[] = [];

    // Products are in div.product-small
    $("div.product-small").each((_, el) => {
      const link = $(el).find("a.woocommerce-LoopProduct-link, .box-image a").first().attr("href");
      if (link) {
        urls.push(link);
      }
    });

    return urls;
  }

  async parseProduct(html: string, url: string): Promise<ProductData | null> {
    const $ = cheerio.load(html);

    // Title - typically in the product-title-container or h1
    let title = $("h1.product-title, h1.product_title").text().trim();
    if (!title) {
      title = $(".product-title-container h1").text().trim();
    }
    if (!title) {
      title = $('meta[property="og:title"]').attr("content")?.trim() || "";
    }

    if (!title) {
      this.logger.warn(`Missing title for ${url}`);
      return null;
    }

    // Prices
    // Cash/effective price from twitter meta or main price
    let price: number | null = null;
    let originalPrice: number | null = null;

    // Try to get price from twitter meta first (effective price)
    const twitterPriceText = $('meta[name="twitter:data1"]').attr("content");
    if (twitterPriceText) {
      const cleaned = twitterPriceText.replace(/[^\d]/g, "");
      if (cleaned) {
        price = Number.parseInt(cleaned, 10);
      }
    }

    // Try to find the main displayed price
    if (!price) {
      const mainPriceText = $(".price-wrapper div[style*='font-weight: 700']").text().replace(/[^\d]/g, "");
      if (mainPriceText) {
        price = Number.parseInt(mainPriceText, 10);
      }
    }

    // Normal price (credit/debit) - above the "Con Tarjetas de Crédito / Débito" text
    const normalPriceElement = $("span[data-nosnippet='true'][style*='font-weight: bold']");
    if (normalPriceElement.length > 0) {
      const normalText = normalPriceElement.text().replace(/[^\d]/g, "");
      if (normalText) {
        originalPrice = Number.parseInt(normalText, 10);
      }
    }

    // Fallback: look at p.price
    if (!price) {
      const fallbackPrice = $("p.price .woocommerce-Price-amount").first().text().replace(/[^\d]/g, "");
      if (fallbackPrice) {
        price = Number.parseInt(fallbackPrice, 10);
      }
    }

    // Ensure price/originalPrice are properly ordered
    if (!originalPrice && price) originalPrice = price;
    if (price && originalPrice && price > originalPrice) {
      const temp = price;
      price = originalPrice;
      originalPrice = temp;
    }

    // Stock
    let stock = false;
    let stockQuantity: number | null = null;

    const stockElement = $("p.stock.in-stock");
    if (stockElement.length > 0) {
      stock = true;
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
        stock = stockQuantity > 0;
      } else if (stockSpan.includes("+20")) {
        stockQuantity = 20;
        stock = true;
      }
    }

    const outOfStock = $("p.stock.out-of-stock");
    if (outOfStock.length > 0) {
      stock = false;
      stockQuantity = 0;
    }

    // Image
    const imageUrl =
      $('meta[property="og:image:secure_url"]').attr("content") ||
      $('meta[property="og:image"]').attr("content") ||
      $(".woocommerce-product-gallery__image img").first().attr("src");

    // MPN - inside span#solotodo or similar
    let mpn: string | null = null;
    const mpnElement = $("span#solotodo");
    if (mpnElement.length > 0) {
      mpn = mpnElement.attr("data-copy") || mpnElement.text().replace(/MPN:/i, "").trim() || null;
    }

    // Description / context
    const descriptionText = $(".ccs-inline-content").text().trim() || $("#tab-description").text().trim();
    const descriptionHtml = $(".ccs-inline-content").html() || $("#tab-description").html() || "";

    // Extract manufacturer from title or brand display
    let manufacturer = $(".box-text-products div[style*='font-weight: bold']").first().text().trim();
    if (!manufacturer) {
      manufacturer = this.extractManufacturer(title, mpn || "") || "";
    }

    const specs: Record<string, string> = {};
    if (manufacturer) specs.manufacturer = manufacturer;

    return {
      url,
      title,
      price,
      originalPrice,
      stock,
      stockQuantity,
      mpn,
      imageUrl: imageUrl || null,
      specs,
      context: {
        description_text: descriptionText,
        description_html: descriptionHtml,
      },
    };
  }

  private extractManufacturer(title: string, _sku: string): string | undefined {
    const brands = [
      "Asus",
      "MSI",
      "Gigabyte",
      "ASRock",
      "Kingston",
      "Corsair",
      "Adata",
      "Western Digital",
      "WD",
      "Seagate",
      "Intel",
      "AMD",
      "Nvidia",
      "Zotac",
      "PNY",
      "Galax",
      "Deepcool",
      "Cooler Master",
      "EVGA",
      "Seasonic",
      "Thermaltake",
      "Samsung",
      "Crucial",
      "XPG",
      "G.Skill",
      "Team",
      "Patriot",
      "HP",
      "HPE",
      "Dell",
      "Lenovo",
      "Antec",
      "Cougar",
      "Nzxt",
      "Lian Li",
      "Xtech",
      "Pctronix",
      "Clio",
      "be quiet!",
    ];
    const lowerTitle = title.toLowerCase();
    for (const brand of brands) {
      if (lowerTitle.includes(brand.toLowerCase())) return brand;
    }
    return undefined;
  }

  async getProductUrls(html: string): Promise<string[]> {
    return this.extractUrlsFromList(html, "case");
  }
}
