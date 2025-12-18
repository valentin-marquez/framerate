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

  // Formatear el archivo generado con Biome usando Bun
  try {
    await $`bun run biome format src/types.ts`;
    logger.info("Archivo `src/types.ts` formateado correctamente con Biome");
  } catch (formatError) {
    logger.error("Error al formatear `src/types.ts` con Biome:", formatError);
    process.exit(1);
  }
} catch (error) {
  logger.error("Error al generar tipos:", error);
  process.exit(1);
}
