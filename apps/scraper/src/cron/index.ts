import { Cron } from "kuron";
import { Logger } from "@/lib/logger";

const logger = new Logger("Cron");
const cron = new Cron();

cron.schedule("0 */4 * * *", async () => {
  logger.info("Iniciando ciclo de scraping de 4 horas...");
});

export { cron };
