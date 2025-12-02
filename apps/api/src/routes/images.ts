import { Hono } from "hono";
import type { Bindings, Variables } from "../bindings";

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

  // Construct the full URL to the Supabase storage
  // Assuming the path includes the bucket name and the file path
  // e.g. /images/products/gpu/rtx-3080.jpg -> https://project.supabase.co/storage/v1/object/public/products/gpu/rtx-3080.jpg

  // We need to be careful about how the path is passed.
  // If the user requests /images/my-bucket/my-image.jpg
  // We want to fetch ${supabaseUrl}/storage/v1/object/public/my-bucket/my-image.jpg

  const storageUrl = `${supabaseUrl}/storage/v1/object/public/${path}`;

  try {
    const response = await fetch(storageUrl);

    if (!response.ok) {
      return c.text("Image not found", 404);
    }

    const newHeaders = new Headers(response.headers);
    // Set cache control headers to cache images at the edge
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
