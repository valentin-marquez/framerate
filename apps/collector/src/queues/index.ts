import type { Category } from "@/constants/categories";

export type CrawlerType = "pc-express" | "sp-digital" | "myshop";

export interface CollectorJobData {
  crawler: CrawlerType;
  category?: Category | "all";
  categoryUrl?: string;
  productUrl?: string;
}
