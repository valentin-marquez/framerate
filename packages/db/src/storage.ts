/**
 * Utilidades de Supabase Storage para gestionar logos de tiendas, imágenes de productos
 * y avatars de usuarios.
 *
 * Buckets:
 * - store-logos: Logos de tiendas identificados por el slug de la tienda (ej. "sp-digital.png")
 * - product-images: Imágenes de productos identificadas por MPN (ej. "RTX4090-GAMING-X-TRIO.webp")
 * - user-avatars: Avatars de usuarios bajo carpeta {user_id}/ (ej. "abc-123/avatar.webp")
 */

/**
 * Buckets de almacenamiento disponibles en el proyecto.
 */
export const StorageBuckets = {
  STORE_LOGOS: "store-logos",
  PRODUCT_IMAGES: "product-images",
  USER_AVATARS: "user-avatars",
} as const;

export type StorageBucket = (typeof StorageBuckets)[keyof typeof StorageBuckets];

/**
 * Tipos MIME permitidos para cada bucket.
 */
export const AllowedMimeTypes = {
  [StorageBuckets.STORE_LOGOS]: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
  [StorageBuckets.PRODUCT_IMAGES]: ["image/png", "image/jpeg", "image/webp", "image/avif"],
  [StorageBuckets.USER_AVATARS]: ["image/png", "image/jpeg", "image/webp"],
} as const;

/**
 * Límites de tamaño de archivo para cada bucket (en bytes).
 */
export const FileSizeLimits = {
  [StorageBuckets.STORE_LOGOS]: 1048576, // 1MB
  [StorageBuckets.PRODUCT_IMAGES]: 2097152, // 2MB
  [StorageBuckets.USER_AVATARS]: 2097152, // 2MB
} as const;

/**
 * Genera una ruta de archivo de almacenamiento para un logo de tienda.
 *
 * @param storeSlug - El slug de la tienda (ej. "sp-digital")
 * @param extension - Extensión del archivo (por defecto: "png")
 * @returns La ruta del archivo para almacenamiento (ej. "sp-digital.png")
 *
 * @example
 * getStoreLogoPath("sp-digital") // "sp-digital.png"
 * getStoreLogoPath("pc-express", "webp") // "pc-express.webp"
 */
export function getStoreLogoPath(
  storeSlug: string,
  extension: "png" | "jpeg" | "jpg" | "webp" | "svg" = "png",
): string {
  const sanitizedSlug = storeSlug.toLowerCase().trim();
  return `${sanitizedSlug}.${extension}`;
}

/**
 * Genera una ruta de archivo de almacenamiento para una imagen de producto.
 * Usa MPN (Número de parte del fabricante) como identificador para asegurar
 * que el mismo producto de diferentes tiendas comparta una imagen.
 *
 * @param mpn - El Número de Parte del Fabricante
 * @param extension - Extensión del archivo (por defecto: "avif")
 * @returns La ruta del archivo para almacenamiento
 *
 * @example
 * getProductImagePath("RTX4090-GAMING-X-TRIO") // "RTX4090-GAMING-X-TRIO.avif"
 * getProductImagePath("ROG-STRIX-RTX4080", "png") // "ROG-STRIX-RTX4080.png"
 */
export function getProductImagePath(mpn: string, extension: "png" | "jpeg" | "jpg" | "webp" | "avif" = "avif"): string {
  // Sanitizar MPN: eliminar caracteres especiales que podrían causar problemas en URLs
  const sanitizedMpn = mpn
    .trim()
    .replace(/[/\\:*?"<>|]/g, "-") // Reemplazar caracteres de ruta inválidos
    .replace(/\s+/g, "-") // Reemplazar espacios con guiones
    .replace(/-+/g, "-"); // Colapsar múltiples guiones

  return `${sanitizedMpn}.${extension}`;
}

/**
 * Genera la URL pública para un objeto de almacenamiento.
 *
 * @param supabaseUrl - La URL del proyecto Supabase
 * @param bucket - El nombre del bucket de almacenamiento
 * @param filePath - La ruta del archivo dentro del bucket
 * @returns La URL pública para el objeto de almacenamiento
 *
 * @example
 * getStoragePublicUrl(
 *   "https://abc123.supabase.co",
 *   "store-logos",
 *   "sp-digital.png"
 * )
 * // Retorna: "https://abc123.supabase.co/storage/v1/object/public/store-logos/sp-digital.png"
 */
export function getStoragePublicUrl(supabaseUrl: string, bucket: StorageBucket, filePath: string): string {
  const baseUrl = supabaseUrl.replace(/\/$/, ""); // Eliminar barra final
  return `${baseUrl}/storage/v1/object/public/${bucket}/${filePath}`;
}

/**
 * Extensión válida para un avatar de usuario. Mantenemos el set pequeño porque
 * el bucket sólo acepta png/jpeg/webp.
 */
export type UserAvatarExtension = "png" | "jpeg" | "jpg" | "webp";

/**
 * Genera la ruta de almacenamiento para el avatar de un usuario.
 * Usa estructura de carpetas para que la RLS pueda restringir el acceso por
 * dueño con `storage.foldername(name)[1] = auth.uid()`.
 *
 * @param userId - UUID del usuario (auth.users.id)
 * @param extension - Extensión del archivo (por defecto "webp")
 *
 * @example
 * getUserAvatarPath("9f0a...e1") // "9f0a...e1/avatar.webp"
 */
export function getUserAvatarPath(userId: string, extension: UserAvatarExtension = "webp"): string {
  return `${userId}/avatar.${extension}`;
}

/**
 * Genera la URL pública para el avatar de un usuario.
 */
export function getUserAvatarUrl(supabaseUrl: string, userId: string, extension: UserAvatarExtension = "webp"): string {
  return getStoragePublicUrl(supabaseUrl, StorageBuckets.USER_AVATARS, getUserAvatarPath(userId, extension));
}

/**
 * Genera la URL pública para un logo de tienda.
 *
 * @param supabaseUrl - La URL del proyecto Supabase
 * @param storeSlug - El slug de la tienda
 * @param extension - Extensión del archivo (por defecto: "png")
 * @returns La URL pública para el logo de la tienda
 */
export function getStoreLogoUrl(
  supabaseUrl: string,
  storeSlug: string,
  extension: "png" | "jpeg" | "jpg" | "webp" | "svg" = "png",
): string {
  const filePath = getStoreLogoPath(storeSlug, extension);
  return getStoragePublicUrl(supabaseUrl, StorageBuckets.STORE_LOGOS, filePath);
}

/**
 * Genera la URL pública para una imagen de producto.
 *
 * @param supabaseUrl - La URL del proyecto Supabase
 * @param mpn - El Número de Parte del Fabricante
 * @param extension - Extensión del archivo (por defecto: "avif")
 * @returns La URL pública para la imagen del producto
 */
export function getProductImageUrl(
  supabaseUrl: string,
  mpn: string,
  extension: "png" | "jpeg" | "jpg" | "webp" | "avif" = "avif",
): string {
  const filePath = getProductImagePath(mpn, extension);
  return getStoragePublicUrl(supabaseUrl, StorageBuckets.PRODUCT_IMAGES, filePath);
}

/**
 * Valida si un tipo MIME está permitido para un bucket específico.
 *
 * @param bucket - El bucket de almacenamiento
 * @param mimeType - El tipo MIME a validar
 * @returns Verdadero si el tipo MIME está permitido
 */
export function isAllowedMimeType(bucket: StorageBucket, mimeType: string): boolean {
  const allowedTypes = AllowedMimeTypes[bucket] as readonly string[];
  return allowedTypes.includes(mimeType);
}

/**
 * Valida si el tamaño de un archivo está dentro del límite para un bucket específico.
 *
 * @param bucket - El bucket de almacenamiento
 * @param fileSize - El tamaño del archivo en bytes
 * @returns Verdadero si el tamaño del archivo está dentro del límite
 */
export function isWithinSizeLimit(bucket: StorageBucket, fileSize: number): boolean {
  return fileSize <= FileSizeLimits[bucket];
}

/**
 * Extrae la extensión de archivo de una URL o nombre de archivo.
 *
 * @param urlOrFilename - URL o nombre de archivo del cual extraer la extensión
 * @returns La extensión del archivo sin el punto, o null si no se encuentra
 */
export function extractFileExtension(urlOrFilename: string): string | null {
  const match = urlOrFilename.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
  return match ? match[1].toLowerCase() : null;
}
