/**
 * Variante de un ancho de la foto propia (`products/<hash>.webp` → `products/<hash>-w400.webp`), por clave de R2 o por
 * URL del CDN. Lo que no es una copia propia (URL de la tienda) vuelve igual: no tiene variantes.
 */
export function imageVariant(keyOrUrl: string, width: 400): string {
  return keyOrUrl.replace(/(products\/[0-9a-f]{32})\.webp$/, `$1-w${width}.webp`);
}
