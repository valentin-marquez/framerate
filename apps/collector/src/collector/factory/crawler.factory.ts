import { ProductPipeline } from "@/collector/pipelines/product.pipeline";
import { BrandService } from "@/collector/services/brand.service";
import { CatalogService } from "@/collector/services/catalog.service";
import { ApiStrategy } from "@/collector/strategies/api.strategy";
import type { JobStrategy } from "@/collector/strategies/base.strategy";
import { ScraperStrategy } from "@/collector/strategies/scraper.strategy";
import type { Category } from "@/constants/categories";
import { MYSHOP_CATEGORIES, MyShopCrawler } from "@/crawlers/myshop";
import { PC_EXPRESS_CATEGORIES, PcExpressCrawler } from "@/crawlers/pc-express";
import { SP_DIGITAL_CATEGORIES, SpDigitalCrawler } from "@/crawlers/sp-digital";
import { TECTEC_CATEGORIES, TectecCrawler } from "@/crawlers/tectec";

// Tipo auxiliar para adjuntar metadatos ligeros a los crawlers sin usar `any`
type CrawlerMeta = { CATEGORIES?: Record<Category, unknown>; slug?: string };

/**
 * Función de fábrica para crear una instancia de JobStrategy basada en el tipo de crawler.
 *
 * @param crawlerType - El tipo de crawler a utilizar (por ejemplo, "pc-express", "sp-digital", "myshop").
 * @returns Una instancia de JobStrategy configurada para el tipo de crawler especificado.
 * @throws Error si el tipo de crawler es desconocido.
 */
export function createStrategy(crawlerType: string): JobStrategy {
  const catalog = new CatalogService();
  const brandService = new BrandService();
  const pipeline = new ProductPipeline(catalog, brandService);

  switch (crawlerType) {
    case "pc-express": {
      const c = new PcExpressCrawler();
      (c as unknown as CrawlerMeta).CATEGORIES = PC_EXPRESS_CATEGORIES;
      (c as unknown as CrawlerMeta).slug = "pc-express";
      return new ScraperStrategy<Category>(c, pipeline);
    }
    case "sp-digital": {
      const c = new SpDigitalCrawler();
      (c as unknown as CrawlerMeta).CATEGORIES = SP_DIGITAL_CATEGORIES;
      (c as unknown as CrawlerMeta).slug = "sp-digital";
      return new ScraperStrategy<Category>(c, pipeline);
    }
    case "myshop": {
      const c = new MyShopCrawler();
      (c as unknown as CrawlerMeta).CATEGORIES = MYSHOP_CATEGORIES;
      (c as unknown as CrawlerMeta).slug = "myshop";
      return new ApiStrategy(c, pipeline);
    }
    case "tectec": {
      const c = new TectecCrawler();
      (c as unknown as CrawlerMeta).CATEGORIES = TECTEC_CATEGORIES;
      (c as unknown as CrawlerMeta).slug = "tectec";
      return new ScraperStrategy<Category>(c, pipeline);
    }
    default:
      throw new Error("Unknown crawler");
  }
}
