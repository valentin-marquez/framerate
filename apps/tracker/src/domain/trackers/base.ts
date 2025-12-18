import { Logger } from "@framerate/utils";

export interface TrackerResult {
  price: number;
  priceNormal?: number;
  stock: boolean;
  stockQuantity?: number;
  available: boolean;
  url?: string;
  meta?: Record<string, unknown>;
}

export abstract class BaseTracker {
  abstract name: string;
  abstract domain: string;
  protected logger: Logger;

  constructor() {
    this.logger = new Logger(this.constructor.name);
  }

  abstract track(url: string): Promise<TrackerResult>;

  protected async fetchHtml(url: string): Promise<string> {
    // Rotate User-Agent for fetch-based trackers
    const { getUserAgent } = await import("./user-agents");
    const ua = getUserAgent();

    const response = await fetch(url, {
      headers: {
        "User-Agent": ua,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }
}
