import { Logger } from "@framerate/utils";
import { $ } from "bun";

const logger = new Logger("generate-types");
const projectId = process.env.SUPABASE_PROJECT_REF;

if (!projectId) {
  logger.error("Error: La variable de entorno SUPABASE_PROJECT_REF no está definida.");
  process.exit(1);
}

try {
  await $`supabase gen types typescript --project-id ${projectId} --schema public > src/types.ts`;
  logger.info("Tipos generados exitosamente en src/types.ts");

  // Formatear el archivo generado con Biome usando --write para aplicar los cambios
  try {
    // Intentamos usar el binario directamente con --write para que Biome aplique los cambios
    await $`biome format --write src/types.ts`;
    logger.info("Archivo `src/types.ts` formateado correctamente con Biome");
  } catch (formatError) {
    // Si eso falla, intentamos el script de npm como fallback
    logger.warn("Fallo al formatear con 'biome format --write'. Intentando 'bun run biome:format' como alternativa.");
    try {
      await $`bun run biome:format`;
      logger.info("Archivo `src/types.ts` formateado correctamente con 'bun run biome:format'");
    } catch {
      // No interrumpimos el proceso de generación por un fallo de formateo; lo logueamos y seguimos
      logger.warn("No fue posible formatear `src/types.ts`. Continúo sin interrumpir el proceso. Error:", formatError);
    }
  }
} catch (error) {
  logger.error("Error al generar tipos:", error);
  process.exit(1);
}
