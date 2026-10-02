import { Hono } from "hono";
import type { AppEnv } from "@/app";
import { currentUser } from "@/features/identity/middleware";
import { listStoresOf } from "./stores.repository";

/** `GET /v1/me/stores`: las tiendas de las organizaciones del usuario, con su rol (se monta bajo `/v1/me`, con sesión). */
export const myStoresRoutes = new Hono<AppEnv>().get("/", async (c) =>
  c.json({ items: await listStoresOf(c.var.db, currentUser(c).id) }),
);
