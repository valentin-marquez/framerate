/**
 * Teléfono según la petición, para no mandarle el riel ni el panel de filtros (sólo de escritorio): `Sec-CH-UA-Mobile`
 * (Chromium; manda si viene, así "sitio de escritorio" en un teléfono cuenta como escritorio) y, si no viene, el user
 * agent (Safari). Una tableta no es teléfono: iPadOS se presenta como Mac y las de Android no dicen "Mobile".
 */
export function isMobileRequest(request: Request): boolean {
  const hint = request.headers.get("Sec-CH-UA-Mobile");
  if (hint) return hint === "?1";
  return /Mobi|iPhone|iPod|Android.*Mobile/i.test(request.headers.get("User-Agent") ?? "");
}

/** El HTML depende del dispositivo: que una caché no le dé a un escritorio el de un teléfono, ni al revés. */
export function varyByDevice(response: Response): Response {
  if (!response.headers.get("Content-Type")?.startsWith("text/html")) return response;
  const headers = new Headers(response.headers);
  headers.append("Vary", "Sec-CH-UA-Mobile, User-Agent");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
