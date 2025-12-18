import { Hono } from "hono";
import { MYSHOP_CATEGORIES, type MyShopCategory } from "@/crawlers/myshop";
import { Logger } from "@/lib/logger";

const app = new Hono();
const logger = new Logger("MyShopRoute");

const VALID_CATEGORIES = [...Object.keys(MYSHOP_CATEGORIES), "all"];

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

    const category = categoryParam as MyShopCategory | "all";

    // Instanciar el worker general de recolección
    const worker = new Worker(new URL("../../workers/collector.worker.ts", import.meta.url).href);

    // Enviamos el mensaje indicando que el crawler es "myshop"
    worker.postMessage({
      crawler: "myshop",
      category,
    });

    worker.onmessage = (event) => {
      logger.info("Worker MyShop finalizado", event.data);
      worker.terminate();
    };

    worker.onerror = (event) => {
      const errorMessage = event instanceof ErrorEvent ? event.message : String(event);
      logger.error("Error en Worker MyShop", errorMessage);
      worker.terminate();
    };

    const categoryMessage =
      category === "all"
        ? `todas las categorías (${Object.keys(MYSHOP_CATEGORIES).join(", ")})`
        : `categoría "${category}"`;

    return c.json({
      success: true,
      message: `Trabajo iniciado para MyShop - ${categoryMessage}`,
      category,
    });
  } catch (error) {
    logger.error("Error iniciando worker MyShop", String(error));
    return c.json({ success: false, error: String(error) }, 500);
  }
});

export default app;
