import { createMpnFinder } from "@framerate/mpn-finder";
import { ProductPipeline } from "@/collector/pipelines/product.pipeline";
import { BrandService } from "@/collector/services/brand.service";
import { CatalogService } from "@/collector/services/catalog.service";
import { ApiStrategy } from "@/collector/strategies/api.strategy";
import type { JobStrategy } from "@/collector/strategies/base.strategy";
import { ScraperStrategy } from "@/collector/strategies/scraper.strategy";
import type { Category } from "@/constants/categories";
import { CENTRAL_GAMER_CATEGORIES, CentralGamerCrawler } from "@/crawlers/central-gamer";
import { CENTRALE_CATEGORIES, CentraleCrawler } from "@/crawlers/centrale";
import { DUST2_CATEGORIES, Dust2Crawler } from "@/crawlers/dust2";
import { MYSHOP_CATEGORIES, MyShopCrawler } from "@/crawlers/myshop";
import { NOTEBOOKSYA_CATEGORIES, NotebooksYaCrawler } from "@/crawlers/notebooksya";
import { PC_EXPRESS_CATEGORIES, PcExpressCrawler } from "@/crawlers/pc-express";
import { SP_DIGITAL_CATEGORIES, SpDigitalCrawler } from "@/crawlers/sp-digital";
import { TECTEC_CATEGORIES, TectecCrawler } from "@/crawlers/tectec";
import { supabase } from "@/lib/supabase";

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
  const mpnFinder = createMpnFinder(supabase);
  const pipeline = new ProductPipeline(catalog, brandService, mpnFinder);

  switch (crawlerType) {
    case "pc-express": {
      const c = new PcExpressCrawler();
      c.CATEGORIES = PC_EXPRESS_CATEGORIES;
      c.slug = "pc-express";
      return new ScraperStrategy<Category>(c, pipeline);
    }
    case "sp-digital": {
      const c = new SpDigitalCrawler();
      c.CATEGORIES = SP_DIGITAL_CATEGORIES;
      c.slug = "sp-digital";
      return new ScraperStrategy<Category>(c, pipeline);
    }
    case "myshop": {
      const c = new MyShopCrawler();
      c.CATEGORIES = MYSHOP_CATEGORIES;
      c.slug = "myshop";
      return new ApiStrategy(c, pipeline);
    }
    case "tectec": {
      const c = new TectecCrawler();
      c.CATEGORIES = TECTEC_CATEGORIES;
      c.slug = "tectec";
      return new ScraperStrategy<Category>(c, pipeline);
    }
    case "central-gamer": {
      const c = new CentralGamerCrawler();
      c.CATEGORIES = CENTRAL_GAMER_CATEGORIES;
      c.slug = "central-gamer";
      return new ScraperStrategy<Category>(c, pipeline);
    }
    case "notebooksya": {
      const c = new NotebooksYaCrawler();
      c.CATEGORIES = NOTEBOOKSYA_CATEGORIES;
      c.slug = "notebooksya";
      return new ScraperStrategy<Category>(c, pipeline);
    }
    case "centrale": {
      const c = new CentraleCrawler();
      c.CATEGORIES = CENTRALE_CATEGORIES;
      c.slug = "centrale";
      return new ScraperStrategy<Category>(c, pipeline);
    }
    case "dust2": {
      const c = new Dust2Crawler();
      c.CATEGORIES = DUST2_CATEGORIES;
      c.slug = "dust2";
      return new ScraperStrategy<Category>(c, pipeline);
    }
    default:
      throw new Error("Unknown crawler");
  }
}
