/**
 * Image URL utilities for Framerate
 *
 * Transforms image URLs to use the API proxy for CDN caching benefits.
 * This significantly improves LCP and overall page load performance.
 */

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8787";

/**
 * Pattern to match Supabase storage URLs (prod and local docker).
 * Matches both:
 *   https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
 *   http://127.0.0.1:54321/storage/v1/object/public/[bucket]/[path]
 */
const SUPABASE_STORAGE_PATTERN = /^https?:\/\/[^/]+\/storage\/v1\/object\/public\/(.+)$/;

/**
 * Transforms an image URL to use the API proxy for CDN caching.
 *
 * @param imageUrl - The original image URL (can be Supabase URL or relative path)
 * @returns The proxied URL through the API gateway
 *
 * @example
 * // Supabase URL
 * getImageUrl("https://xyz.supabase.co/storage/v1/object/public/product-images/gpu.webp")
 * // Returns: "https://api.framerate.cl/v1/images/product-images/gpu.webp"
 *
 * @example
 * // Just filename (after DB simplification)
 * getImageUrl("gpu.webp")
 * // Returns: "https://api.framerate.cl/v1/images/product-images/gpu.webp"
 */
export function getImageUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl) {
    return "";
  }

  // Already using API proxy
  if (imageUrl.includes("/v1/images/")) {
    return imageUrl;
  }

  // Extract path from Supabase storage URL
  const supabaseMatch = imageUrl.match(SUPABASE_STORAGE_PATTERN);
  if (supabaseMatch) {
    const path = supabaseMatch[1];
    return `${API_URL}/v1/images/${path}`;
  }

  // Handle relative paths (starting with /)
  if (imageUrl.startsWith("/images/")) {
    const path = imageUrl.replace("/images/", "");
    return `${API_URL}/v1/images/product-images/${path}`;
  }

  // Handle bare filenames (after DB simplification)
  // Assumes they belong to product-images bucket
  if (!imageUrl.includes("://") && !imageUrl.startsWith("/")) {
    return `${API_URL}/v1/images/product-images/${imageUrl}`;
  }

  // Fallback: return original URL
  return imageUrl;
}

/**
 * Extracts just the filename from an image URL.
 * Useful for database simplification.
 *
 * @param imageUrl - The full image URL
 * @returns Just the filename without path
 *
 * @example
 * getImageFilename("https://xyz.supabase.co/storage/v1/object/public/product-images/gpu.webp")
 * // Returns: "gpu.webp"
 */
export function getImageFilename(imageUrl: string | null | undefined): string {
  if (!imageUrl) return "";

  // Extract from Supabase URL
  const supabaseMatch = imageUrl.match(SUPABASE_STORAGE_PATTERN);
  if (supabaseMatch) {
    const path = supabaseMatch[1];
    // Get just the filename from path like "product-images/subfolder/file.webp"
    return path.split("/").pop() || path;
  }

  // Get filename from any path
  return imageUrl.split("/").pop() || imageUrl;
}

/**
 * Resuelve la URL de la tarjeta Open Graph de un producto.
 *
 * `collector` genera la tarjeta (1200×630, logo + foto + nombre) y la guarda
 * en `product-images/og/<mpn>.png`. Derivamos la URL del `image_url` del
 * producto reusando su filename ya sanitizado: basta cambiar la extensión a
 * `.png` y anteponer el prefijo `og/`.
 *
 * @param imageUrl - El `image_url` del producto (URL Supabase, proxy o filename).
 * @returns URL absoluta de la tarjeta OG, o el fallback estático si no hay imagen.
 *
 * @example
 * getProductOgImage("https://xyz.supabase.co/storage/v1/object/public/product-images/RTX4070.avif")
 * // "https://api.framerate.cl/v1/images/product-images/og/RTX4070.png"
 */
export function getProductOgImage(imageUrl: string | null | undefined): string {
  const filename = getImageFilename(imageUrl);
  if (!filename) return "/og-image.png";

  const pngName = filename.replace(/\.[a-z0-9]+$/i, ".png");
  return `${API_URL}/v1/images/product-images/og/${pngName}`;
}

/**
 * Checks if an image URL is valid (not empty and not a placeholder)
 */
export function isValidImageUrl(imageUrl: string | null | undefined): boolean {
  if (!imageUrl) return false;
  if (imageUrl.trim() === "") return false;
  if (imageUrl === "null" || imageUrl === "undefined") return false;
  return true;
}
