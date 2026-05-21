import { Hono } from "hono";
import { type Category, CategorySchema } from "@/constants/categories";
import { DUST2_CATEGORIES } from "@/crawlers/dust2";
import { Logger } from "@/lib/logger";

const app = new Hono();
const logger = new Logger("Dust2Route");

app.post("/crawl", async (c) => {
  try {
    const categoryParam = c.req.query("category");
    const isAll = !categoryParam || categoryParam === "all";

    if (isAll) {
      const worker = new Worker(new URL("../../workers/collector.worker.ts", import.meta.url).href);

      worker.postMessage({ crawler: "dust2" });

      worker.onmessage = (event) => {
        logger.info("Worker Dust2 finalizado", event.data);
        worker.terminate();
      };

      worker.onerror = (event) => {
        const errorMessage = event instanceof ErrorEvent ? event.message : String(event);
        logger.error("Error en Worker Dust2", errorMessage);
        worker.terminate();
      };

      return c.json({
        success: true,
        message: `Trabajo iniciado para Dust2 - todas las categorías (${CategorySchema.options.join(", ")})`,
        category: "all",
      });
    }

    const validation = CategorySchema.safeParse(categoryParam);

    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: `Categoría inválida.`,
          options: CategorySchema.options,
        },
        400,
      );
    }

    const category = validation.data as Category;

    const worker = new Worker(new URL("../../workers/collector.worker.ts", import.meta.url).href);

    worker.postMessage({ crawler: "dust2", category });

    worker.onmessage = (event) => {
      logger.info("Worker Dust2 finalizado", event.data);
      worker.terminate();
    };

    worker.onerror = (event) => {
      const errorMessage = event instanceof ErrorEvent ? event.message : String(event);
      logger.error("Error en Worker Dust2", errorMessage);
      if (event instanceof ErrorEvent && event.error) {
        logger.error("Detalles del error en Worker Dust2", String(event.error));
      }
      worker.terminate();
    };

    return c.json({
      success: true,
      message: `Trabajo iniciado para categoría "${category}" (de ${Object.keys(DUST2_CATEGORIES).length} disponibles) en worker en segundo plano`,
      category,
    });
  } catch (error) {
    logger.error("Error iniciando worker Dust2", String(error));
    return c.json({ success: false, error: String(error) }, 500);
  }
});

export default app;
