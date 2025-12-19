import { config } from "@/config";
import { supabase } from "@/db";
import { processJob } from "@/worker";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

import logger from "@/logger";

class WorkerPool {
  private running = 0;
  private queue: Array<() => Promise<void>> = [];
  constructor(private concurrency: number) {}

  async run(task: () => Promise<void>) {
    if (this.running >= this.concurrency) {
      // enqueue
      return new Promise<void>((resolve, reject) => {
        this.queue.push(async () => {
          try {
            await task();
            resolve();
          } catch (err) {
            reject(err);
          }
        });
        this.schedule();
      });
    }

    return this.execute(task);
  }

  private async execute(task: () => Promise<void>) {
    this.running++;
    try {
      await task();
    } finally {
      this.running--;
      this.schedule();
    }
  }

  private schedule() {
    if (this.running >= this.concurrency) return;
    const next = this.queue.shift();
    if (next) {
      this.execute(next);
    }
  }

  availableSlots() {
    return Math.max(0, this.concurrency - this.running);
  }
}

export async function startPoller() {
  logger.info("Cortex poller started. Waiting for jobs...");
  const pool = new WorkerPool(config.CORTEX_MAX_CONCURRENCY);

  while (true) {
    try {
      // Fetch up to BATCH_SIZE but respect pool free slots
      const limit = Math.max(1, Math.min(config.CORTEX_BATCH_SIZE, pool.availableSlots()));

      if (limit <= 0) {
        // Pool is full, wait a bit
        await sleep(100);
        continue;
      }

      const { data: jobs, error } = await supabase.rpc("fetch_pending_jobs", { limit_count: limit });

      if (error) {
        logger.error("Error fetching jobs:", error);
        await sleep(5000);
        continue;
      }

      if (!jobs || (Array.isArray(jobs) && jobs.length === 0)) {
        await sleep(config.CORTEX_POLL_INTERVAL_MS);
        continue;
      }

      const list = Array.isArray(jobs) ? jobs : [jobs];
      logger.info(`Processing batch of ${list.length} jobs (pool available=${pool.availableSlots()})`);

      // Submit tasks to pool without awaiting all; pool controls concurrency and continuation
      list.forEach((job) => {
        pool.run(() => processJob(job)).catch((err) => logger.error("Job execution error:", err));
      });
    } catch (err) {
      logger.error("Critical error in poller:", err);
      await sleep(5000);
    }
  }
}
