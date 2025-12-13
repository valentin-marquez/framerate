import { createMiddleware } from "hono/factory";
import type { Bindings, Variables } from "../bindings";
import { Logger } from "../lib/logger";
import { createSupabaseClient } from "../lib/supabase";

const logger = new Logger("AuthMiddleware");

export const authMiddleware = createMiddleware<{
	Bindings: Bindings;
	Variables: Variables;
}>(async (c, next) => {
	const authHeader = c.req.header("Authorization");

	if (!authHeader) {
		logger.warn("Missing Authorization header");
		return c.json({ error: "Missing Authorization header" }, 401);
	}

	const token = authHeader.replace("Bearer ", "");
	const supabase = createSupabaseClient(c.env);

	const {
		data: { user },
		error,
	} = await supabase.auth.getUser(token);

	if (error || !user) {
		logger.warn(`Invalid token: ${error?.message}`);
		return c.json({ error: "Invalid or expired token" }, 401);
	}

	// Adjunta el usuario al contexto si es necesario, o simplemente continúa
	c.set("user", user);

	await next();
});
