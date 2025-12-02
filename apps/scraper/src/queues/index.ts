import type { PcExpressCategory } from "@/crawlers/pc-express";
import type { SpDigitalCategory } from "@/crawlers/sp-digital";

export type CrawlerType = "pc-express" | "sp-digital";

export interface ScraperJobData {
  crawler: CrawlerType;
  category?: PcExpressCategory | SpDigitalCategory | "all";
  categoryUrl?: string;
  productUrl?: string;
}
