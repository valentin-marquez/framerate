import { Hono } from "hono";
import { SP_DIGITAL_CATEGORIES, type SpDigitalCategory } from "@/crawlers/sp-digital";
import { Logger } from "@/lib/logger";

const app = new Hono();
const logger = new Logger("SpDigitalRoute");

const VALID_CATEGORIES = [...Object.keys(SP_DIGITAL_CATEGORIES), "all"];

app.post("/crawl", async (c) => {
  try {
    const categoryParam = c.req.query("category") || "all";

    if (!VALID_CATEGORIES.includes(categoryParam)) {
      return c.json(
        {
          success: false,
          error: `Categoría inválida. Opciones válidas: ${VALID_CATEGORIES.join(", ")}`,
        },
        400,
      );
    }

    const category = categoryParam as SpDigitalCategory | "all";

    const worker = new Worker(new URL("../../workers/collector.worker.ts", import.meta.url).href);

    worker.postMessage({
      crawler: "sp-digital",
      category,
    });

    worker.onmessage = (event) => {
      logger.info("Worker finalizado", event.data);
      worker.terminate();
    };

    worker.onerror = (event) => {
      const errorMessage = event instanceof ErrorEvent ? event.message : String(event);
      logger.error("Error en Worker", errorMessage);
      if (event instanceof ErrorEvent && event.error) {
        logger.error("Detalles del error en Worker", String(event.error));
      }
      worker.terminate();
    };

    const categoryMessage =
      category === "all"
        ? `todas las categorías (${Object.keys(SP_DIGITAL_CATEGORIES).join(", ")})`
        : `categoría "${category}"`;

    return c.json({
      success: true,
      message: `Trabajo iniciado para ${categoryMessage} en worker en segundo plano`,
      category,
    });
  } catch (error) {
    logger.error("Error iniciando worker", String(error));
    return c.json({ success: false, error: String(error) }, 500);
  }
});

export default app;
