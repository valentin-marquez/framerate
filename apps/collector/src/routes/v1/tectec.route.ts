import { Hono } from "hono";
import { type Category, CategorySchema } from "@/constants/categories";
import { TECTEC_CATEGORIES } from "@/crawlers/tectec";
import { Logger } from "@/lib/logger";

const app = new Hono();
const logger = new Logger("TectecRoute");

app.post("/crawl", async (c) => {
  try {
    const categoryParam = c.req.query("category");
    const isAll = !categoryParam || categoryParam === "all";

    if (isAll) {
      const worker = new Worker(new URL("../../workers/collector.worker.ts", import.meta.url).href);

      worker.postMessage({
        crawler: "tectec",
      });

      worker.onmessage = (event) => {
        logger.info("Worker Tectec finalizado", event.data);
        worker.terminate();
      };

      worker.onerror = (event) => {
        const errorMessage = event instanceof ErrorEvent ? event.message : String(event);
        logger.error("Error en Worker Tectec", errorMessage);
        worker.terminate();
      };

      return c.json({
        success: true,
        message: `Trabajo iniciado para Tectec - todas las categorías (${CategorySchema.options.join(", ")})`,
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

    worker.postMessage({
      crawler: "tectec",
      category,
    });

    worker.onmessage = (event) => {
      logger.info("Worker Tectec finalizado", event.data);
      worker.terminate();
    };

    worker.onerror = (event) => {
      const errorMessage = event instanceof ErrorEvent ? event.message : String(event);
      logger.error("Error en Worker Tectec", errorMessage);
      if (event instanceof ErrorEvent && event.error) {
        logger.error("Detalles del error en Worker Tectec", String(event.error));
      }
      worker.terminate();
    };

    const categoryMessage = isAll
      ? `todas las categorías (${Object.keys(TECTEC_CATEGORIES).join(", ")})`
      : `categoría "${category}"`;

    return c.json({
      success: true,
      message: `Trabajo iniciado para ${categoryMessage} en worker en segundo plano`,
      category,
    });
  } catch (error) {
    logger.error("Error iniciando worker Tectec", String(error));
    return c.json({ success: false, error: String(error) }, 500);
  }
});

export default app;
