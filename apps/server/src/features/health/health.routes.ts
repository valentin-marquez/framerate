import { Hono } from "hono";
import type { AppEnv } from "@/app";
import { computeHealth } from "./health.queries";

/** `GET /v1/admin/health`: qué falla o está atrasado (se monta bajo `/v1/admin`, para el personal). */
export const healthRoutes = new Hono<AppEnv>().get("/health", async (c) => c.json(await computeHealth(c.var.db)));
