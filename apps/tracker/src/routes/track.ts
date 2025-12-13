import { Elysia, t } from "elysia";
import { TrackerService } from "../services/tracker.service";

export const trackRoutes = new Elysia({ prefix: "/track" })
	.decorate("trackerService", new TrackerService())
	.post(
		"/batch",
		async ({ body, trackerService }) => {
			const limit = body?.limit ?? 0;
			const result = await trackerService.trackBatch(limit);
			return result;
		},
		{
			body: t.Optional(
				t.Object({
					limit: t.Optional(t.Number()),
				}),
			),
		},
	);
