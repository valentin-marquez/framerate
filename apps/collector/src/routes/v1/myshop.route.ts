import { Hono } from "hono";
import { type Category, CategorySchema } from "@/constants/categories";
import { MYSHOP_CATEGORIES } from "@/crawlers/myshop";
import { Logger } from "@/lib/logger";

const app = new Hono();
const logger = new Logger("MyShopRoute");

app.post("/crawl", async (c) => {
  try {
    const categoryParam = c.req.query("category");
    const isAll = !categoryParam || categoryParam === "all";

    // Caso especial: sin query (o 'all') => todas las categorías
    if (isAll) {
      const worker = new Worker(new URL("../../workers/collector.worker.ts", import.meta.url).href);

      // No enviamos la propiedad 'category' para indicar que debe procesarse todo
      worker.postMessage({
        crawler: "myshop",
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

      return c.json({
        success: true,
        message: `Trabajo iniciado para MyShop - todas las categorías (${CategorySchema.options.join(", ")})`,
        category: "all",
      });
    }

    // Validación robusta con Zod
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

    const categoryMessage = isAll
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
