import type { MyShopCategory } from "@/crawlers/myshop";
import type { PcExpressCategory } from "@/crawlers/pc-express";
import type { SpDigitalCategory } from "@/crawlers/sp-digital";

export type CrawlerType = "pc-express" | "sp-digital" | "myshop";

export interface CollectorJobData {
  crawler: CrawlerType;
  category?: PcExpressCategory | SpDigitalCategory | MyShopCategory | "all";
  categoryUrl?: string;
  productUrl?: string;
}
