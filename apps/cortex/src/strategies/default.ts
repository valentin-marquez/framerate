import { type Job, StrategyResultSchema } from "../schemas";

export class DefaultStrategy {
  async process(job: Job) {
    // Minimal fast path: echo back a small normalized result so the system can work end-to-end.
    const result = {
      extracted: true,
      processed_at: new Date().toISOString(),
      mpn: job.mpn,
      category: job.category,
      snippet: (job.raw_text || "").slice(0, 500),
    };

    // Validate result shape early to fail fast on incorrect strategies
    const validated = StrategyResultSchema.parse(result);
    return validated;
  }
}
