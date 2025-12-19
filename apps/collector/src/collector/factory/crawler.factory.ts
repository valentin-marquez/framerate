import { ProductPipeline } from "@/collector/pipelines/product.pipeline";
import { CatalogService } from "@/collector/services/catalog.service";
import { ApiStrategy } from "@/collector/strategies/api.strategy";
import type { JobStrategy } from "@/collector/strategies/base.strategy";
import { ScraperStrategy } from "@/collector/strategies/scraper.strategy";
import { MYSHOP_CATEGORIES, type MyShopCategory, MyShopCrawler } from "@/crawlers/myshop";
import { PC_EXPRESS_CATEGORIES, type PcExpressCategory, PcExpressCrawler } from "@/crawlers/pc-express";

// Tipo auxiliar para adjuntar metadatos ligeros a los crawlers sin usar `any`
type CrawlerMeta<T extends string> = { CATEGORIES?: Record<T, unknown>; slug?: string };

import { SP_DIGITAL_CATEGORIES, type SpDigitalCategory, SpDigitalCrawler } from "@/crawlers/sp-digital";

/**
 * Función de fábrica para crear una instancia de JobStrategy basada en el tipo de crawler.
 *
 * @param crawlerType - El tipo de crawler a utilizar (por ejemplo, "pc-express", "sp-digital", "myshop").
 * @returns Una instancia de JobStrategy configurada para el tipo de crawler especificado.
 * @throws Error si el tipo de crawler es desconocido.
 */
export function createStrategy(crawlerType: string): JobStrategy {
  const catalog = new CatalogService();
  const pipeline = new ProductPipeline(catalog);

  switch (crawlerType) {
    case "pc-express": {
      const c = new PcExpressCrawler();
      (c as unknown as CrawlerMeta<PcExpressCategory>).CATEGORIES = PC_EXPRESS_CATEGORIES;
      (c as unknown as CrawlerMeta<PcExpressCategory>).slug = "pc-express";
      return new ScraperStrategy<PcExpressCategory>(c, pipeline);
    }
    case "sp-digital": {
      const c = new SpDigitalCrawler();
      (c as unknown as CrawlerMeta<SpDigitalCategory>).CATEGORIES = SP_DIGITAL_CATEGORIES;
      (c as unknown as CrawlerMeta<SpDigitalCategory>).slug = "sp-digital";
      return new ScraperStrategy<SpDigitalCategory>(c, pipeline);
    }
    case "myshop": {
      const c = new MyShopCrawler();
      (c as unknown as CrawlerMeta<MyShopCategory>).CATEGORIES = MYSHOP_CATEGORIES;
      (c as unknown as CrawlerMeta<MyShopCategory>).slug = "myshop";
      return new ApiStrategy(c, pipeline);
    }
    default:
      throw new Error("Unknown crawler");
  }
}
