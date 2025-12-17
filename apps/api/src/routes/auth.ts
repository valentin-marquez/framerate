import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";
import { createSupabaseClient } from "@/lib/supabase";
import { authMiddleware } from "@/middleware/auth";

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Aplica el middleware a todas las rutas en este grupo
auth.use("*", authMiddleware);

// Devuelve el perfil del usuario actual
auth.get("/me", async (c) => {
	const user = c.get("user"); // Obtener el usuario del contexto
	const supabase = createSupabaseClient(c.env);

	const { data: profile, error } = await supabase
		.from("profiles")
		.select("*")
		.eq("id", user.id)
		.single();

	if (error) {
		return c.json({ error: error.message }, 500);
	}

	return c.json({ user, profile });
});

export default auth;
