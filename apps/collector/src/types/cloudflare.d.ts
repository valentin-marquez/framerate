export {};

declare global {
	interface ScheduledController {
		cron: string;
		scheduledTime: number;
		noRetry(): void;
	}

	interface ExecutionContext {
		waitUntil(promise: Promise<unknown>): void;
		passThroughOnException(): void;
	}
}
