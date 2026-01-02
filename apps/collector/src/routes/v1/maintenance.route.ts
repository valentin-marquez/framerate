import { Hono } from "hono";
import { MaintenanceService } from "@/collector/services/maintenance.service";

const maintenanceRoute = new Hono();
const maintenanceService = new MaintenanceService();

maintenanceRoute.post("/group-variants", async (c) => {
  try {
    const result = await maintenanceService.groupVariants();
    return c.json(result);
  } catch (_error) {
    return c.json({ error: "Failed to group variants" }, 500);
  }
});

export default maintenanceRoute;
