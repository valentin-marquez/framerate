import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";
import { createSupabaseClient } from "@/lib/supabase";

const categories = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// GET /categories/:slug/filters
categories.get("/:slug/filters", async (c) => {
	const supabase = createSupabaseClient(c.env);
	const slug = c.req.param("slug");

	const { data, error } = await supabase.rpc("get_category_filters", {
		p_category_slug: slug,
	});

	if (error) {
		return c.json({ error: error.message }, 500);
	}

	return c.json(data as unknown);
});

// GET /categories
categories.get("/", async (c) => {
	const supabase = createSupabaseClient(c.env);

	const { data, error } = await supabase
		.from("categories")
		.select("*")
		.order("name");

	if (error) {
		return c.json({ error: error.message }, 500);
	}

	return c.json(data);
});

export default categories;
