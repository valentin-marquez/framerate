import type { CollectorJobData, CrawlerType } from "@/queues";

export interface JobResult {
  status: "success" | "error";
  crawler: CrawlerType;
  categories: string[];
  results: Record<string, number>;
  totalCount: number;
  duration: number;
  iaDurationMs?: number; // cumulative LLM time spent during the job
  iaCacheHits?: number; // number of times specs were served from cache
  iaLLMCalls?: number; // number of actual LLM calls made
  error?: string;
}

export interface JobStrategy {
  execute(job: CollectorJobData): Promise<JobResult>;
}
