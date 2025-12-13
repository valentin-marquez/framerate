import { Logger } from "@framerate/utils";
import { $ } from "bun";

const logger = new Logger("db-link");
const projectId = process.env.SUPABASE_PROJECT_REF;

if (!projectId) {
	logger.error(
		"Error: La variable de entorno SUPABASE_PROJECT_REF no está definida.",
	);
	process.exit(1);
}

try {
	await $`supabase link --project-ref ${projectId}`;
	logger.info("Base de datos vinculada exitosamente.");
} catch (error) {
	logger.error("Error al vincular la base de datos:", error);
	process.exit(1);
}
