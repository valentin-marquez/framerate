import { Elysia, t } from "elysia";
import { TrackerService } from "../services/tracker.service";

export const trackRoutes = new Elysia({ prefix: "/track" })
  .decorate("trackerService", new TrackerService())

  /**
   * POST /track/batch
   *
   * Process a batch of listings to update prices and stock.
   * Uses intelligent tracking:
   *   - MyShop products with MPN: Ultra-fast batch processing via cache
   *   - Other products: Individual URL-based tracking
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

  /**
   * GET /track/cache/stats
   *
   * Get cache statistics from MyShop tracker.
   *
   * Returns:
   *   - size: Number of products in cache
   *   - age: Age of cache in milliseconds
   *   - ageMinutes: Age in minutes (for convenience)
   *   - ttl: Time to live for cache in milliseconds
   *   - ttlMinutes: TTL in minutes (for convenience)
   *   - requests: Total number of requests made
   *   - success: Number of successful requests
   *   - failures: Number of failed requests
   *   - isRefreshing: Whether cache is currently refreshing
   *
   * Example:
   *   curl http://localhost:3000/track/cache/stats
   */
  .get(
    "/cache/stats",
    ({ trackerService }) => {
      const stats = trackerService.getCacheStats();

      return {
        ...stats,
        ageMinutes: Math.floor(stats.age / 1000 / 60),
        ttlMinutes: Math.floor(stats.ttl / 1000 / 60),
        cacheValid: stats.age < stats.ttl,
        timestamp: new Date().toISOString(),
      };
    },
    {
      detail: {
        summary: "Get cache statistics",
        description: "Returns MyShop cache statistics including size, age, and request counts",
        tags: ["Cache"],
      },
    },
  )

  /**
   * POST /track/cache/refresh
   *
   * Force refresh the MyShop cache.
   * This will fetch all categories and products again.
   *
   * Warning: This operation takes ~90-120 seconds and makes ~60-70 requests.
   * Use sparingly to avoid rate limiting.
   *
   * Example:
   *   curl -X POST http://localhost:3000/track/cache/refresh
   */
  .post(
    "/cache/refresh",
    async ({ trackerService }) => {
      try {
        await trackerService.refreshMyShopCache();
        const stats = trackerService.getCacheStats();

        return {
          success: true,
          message: "Cache refreshed successfully",
          stats: {
            size: stats.size,
            requests: stats.requests,
            success: stats.success,
            failures: stats.failures,
          },
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
      detail: {
        summary: "Force cache refresh",
        description: "Manually trigger a full refresh of the MyShop product cache",
        tags: ["Cache"],
      },
    },
  )

  /**
   * GET /track/cache/health
   *
   * Quick health check for the cache system.
   * Returns a simple status indicating if the cache is healthy.
   *
   * Example:
   *   curl http://localhost:3000/track/cache/health
   */
  .get(
    "/cache/health",
    ({ trackerService }) => {
      const stats = trackerService.getCacheStats();
      const isHealthy = stats.size > 0 && stats.age < stats.ttl && !stats.isRefreshing;
      const cacheExpired = stats.age >= stats.ttl;

      return {
        status: isHealthy ? "healthy" : "degraded",
        healthy: isHealthy,
        details: {
          hasProducts: stats.size > 0,
          cacheValid: !cacheExpired,
          isRefreshing: stats.isRefreshing,
          productCount: stats.size,
          ageMinutes: Math.floor(stats.age / 1000 / 60),
        },
        timestamp: new Date().toISOString(),
      };
    },
    {
      detail: {
        summary: "Cache health check",
        description: "Quick health status of the cache system",
        tags: ["Cache", "Health"],
      },
    },
  );
