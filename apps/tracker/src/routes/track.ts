import { Elysia, t } from "elysia";
import { TrackerService } from "../services/tracker.service";

export const trackRoutes = new Elysia({ prefix: "/track" })
  .decorate("trackerService", new TrackerService())

  /**
   * POST /track/batch
   *
   * Process a batch of listings to update prices and stock.
   * MyShop is tracked via URL (Puppeteer) like other stores; listings are processed
   * individually using the appropriate tracker.
   *
   * Body params:
   *   - limit (optional): Number of listings to process. Default: all pending
   *
   * Example:
   *   curl -X POST http://localhost:3000/track/batch \
   *     -H "Content-Type: application/json" \
   *     -d '{"limit": 100}'
   */
  .post(
    "/batch",
    async ({ body, trackerService }) => {
      const limit = body?.limit ?? 0;

      try {
        const result = await trackerService.trackBatch(limit);

        return {
          success: true,
          ...result,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        };
      }
    },
    {
      body: t.Optional(
        t.Object({
          limit: t.Optional(t.Number()),
        }),
      ),
      detail: {
        summary: "Track batch of listings",
        description: "Process and update prices/stock for a batch of listings",
        tags: ["Tracking"],
      },
    },
  )

  // Utility endpoint to cleanup resources (e.g., browser pool)
  .post("/cleanup", async ({ trackerService }) => {
    try {
      await trackerService.cleanup();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  });
