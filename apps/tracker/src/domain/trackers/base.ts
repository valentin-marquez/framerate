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
		const response = await fetch(url, {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			},
		});

		if (!response.ok) {
			throw new Error(
				`Failed to fetch ${url}: ${response.status} ${response.statusText}`,
			);
		}

		return response.text();
	}
}
