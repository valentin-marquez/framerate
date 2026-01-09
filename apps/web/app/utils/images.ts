/**
 * Image URL utilities for Framerate
 *
 * Transforms image URLs to use the API proxy for CDN caching benefits.
 * This significantly improves LCP and overall page load performance.
 */

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8787";

/**
 * Pattern to match Supabase storage URLs
 * Matches: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
 */
const SUPABASE_STORAGE_PATTERN = /^https?:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/(.+)$/;

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
 * Checks if an image URL is valid (not empty and not a placeholder)
 */
export function isValidImageUrl(imageUrl: string | null | undefined): boolean {
  if (!imageUrl) return false;
  if (imageUrl.trim() === "") return false;
  if (imageUrl === "null" || imageUrl === "undefined") return false;
  return true;
}
