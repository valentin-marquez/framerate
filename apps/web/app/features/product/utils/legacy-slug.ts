/**
 * Las fichas del sistema anterior terminaban en `--<número>`. Sin el sufijo es el slug de hoy (si el producto
 * existe); si no, las primeras palabras sirven para buscarlo.
 */
export function legacySlug(slug: string): { base: string; search: string } | null {
  const base = slug.match(/^(.+)--\d+$/)?.[1];
  if (!base) return null;
  return { base, search: base.split("-").slice(0, 4).join(" ") };
}
