const KEY = "framerate.lastCategoryUrls";

let current: string | null = null;
let previous: string | null = null;

function read(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

/**
 * Se llama en cada cambio de URL. Recuerda la última lista de cada categoría, con sus filtros y su búsqueda, y de dónde
 * venimos, para que la miga de una ficha vuelva a ella tal como se dejó.
 */
export function trackLocation(url: string) {
  if (url === current) return;
  previous = current;
  current = url;
  const slug = url.match(/^\/categoria\/([^/?#]+)/)?.[1];
  if (!slug) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...read(), [slug]: url }));
  } catch {
    // Sin almacenamiento (modo privado): la miga lleva a la categoría sin filtros.
  }
}

/** La última lista que se vio de esa categoría (`/categoria/x?brand=msi`), o null si no se vio ninguna. */
export function lastCategoryUrl(slug: string): string | null {
  return read()[slug] ?? null;
}

/** Si la página anterior fue exactamente esa URL: volver atrás da el mismo resultado, con su scroll. */
export function cameFrom(url: string) {
  return previous === url;
}
