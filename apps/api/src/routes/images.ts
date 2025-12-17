/**
 * @module images
 *
 * @remarks
 * Este módulo expone una ruta para servir imágenes directamente desde el almacenamiento de Supabase,
 * construyendo la URL de acceso público a partir de la ruta solicitada por el usuario.
 *
 * Sí, es una cochinada: estamos haciendo proxy de archivos estáticos a través de la API, lo cual no es óptimo
 * ni recomendable para producción (por temas de performance, escalabilidad y costos).
 *
 * @reason
 * Sin embargo, esta solución es necesaria para poder controlar los encabezados de caché y CORS,
 * y para poder servir imágenes de buckets públicos sin exponer directamente la URL de Supabase al cliente.
 * Además, permite centralizar la lógica de acceso y autenticación si en el futuro se requiere proteger ciertos recursos.
 */
import { Hono } from "hono";
import type { Bindings, Variables } from "@/bindings";

const images = new Hono<{ Bindings: Bindings; Variables: Variables }>();

images.get("/*", async (c) => {
	// Handle /v1/images/bucket/file.jpg or /images/bucket/file.jpg
	const parts = c.req.path.split("/images/");
	const path = parts.length > 1 ? parts[1] : null;

	if (!path) {
		return c.text("Invalid image path", 400);
	}

	const supabaseUrl = c.env.SUPABASE_URL || Bun.env.SUPABASE_URL;

	if (!supabaseUrl) {
		console.error("SUPABASE_URL is not defined");
		return c.text("Internal Server Error", 500);
	}

	// Construye la URL pública al archivo en Supabase Storage usando la ruta solicitada.

	const storageUrl = `${supabaseUrl}/storage/v1/object/public/${path}`;

	try {
		const response = await fetch(storageUrl);

		if (!response.ok) {
			return c.text("Image not found", 404);
		}

		const newHeaders = new Headers(response.headers);
		// Configurar encabezados de caché y CORS adecuados para las imágenes
		newHeaders.set("Cache-Control", "public, max-age=31536000, immutable");
		newHeaders.set("Access-Control-Allow-Origin", "*");

		return new Response(response.body, {
			status: response.status,
			headers: newHeaders,
		});
	} catch (error) {
		console.error("Error fetching image:", error);
		return c.text("Internal Server Error", 500);
	}
});

export default images;
