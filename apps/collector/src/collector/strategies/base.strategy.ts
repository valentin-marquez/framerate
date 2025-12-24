import type { CollectorJobData, CrawlerType } from "@/queues";

export interface JobResult {
  status: "success" | "error";
  crawler: CrawlerType;
  categories: string[];
  results: Record<string, number>;
  totalCount: number;
  duration: number;
  iaCacheHits?: number; // number of times specs were served from cache
  error?: string;
}

export interface JobStrategy {
  execute(job: CollectorJobData): Promise<JobResult>;
}
