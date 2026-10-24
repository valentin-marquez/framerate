import type { Category } from "@framerate/contracts";
import { decodeEntities } from "@framerate/kit";
import type { RawOffer } from "../domain/normalize";
import type { CrawlContext, OfferRef } from "./adapter";
import { HttpError } from "./http";

export type LdNode = Record<string, unknown>;

/** Todos los nodos JSON-LD de una página, con `@graph` y arreglos aplanados. Un bloque que no parsea se ignora. */
export function jsonLdNodes(html: string): LdNode[] {
  const nodes: LdNode[] = [];
  for (const m of html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1] ?? "");
    } catch {
      continue;
    }
    const stack = [data];
    while (stack.length) {
      const d = stack.pop();
      if (Array.isArray(d)) stack.push(...d);
      else if (d && typeof d === "object") {
        nodes.push(d as LdNode);
        if ("@graph" in d) stack.push((d as LdNode)["@graph"]);
      }
    }
  }
  return nodes;
}

/** Primer nodo JSON-LD del tipo pedido (`@type` puede ser un arreglo). */
export function findLd(html: string, type: string): LdNode | undefined {
  return jsonLdNodes(html).find((n) => [n["@type"]].flat().includes(type));
}

/** Precio chileno visible ("$ 1.234.990", "$1.234.990") a entero. */
export function parseClp(text: string | null | undefined): number | null {
  const digits = decodeEntities(text ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

const MAX_REFRESH_FAILURES = 10;

/**
 * Refresco horario (#121) para las plataformas sin consulta por id: una ficha por oferta conocida, leída con el mismo
 * parser del crawl. Una 404 se omite (retirarla es trabajo del crawl de 6 h) y una caída también, con aviso; diez
 * caídas seguidas cortan la hora, porque la tienda está cortando y no hay que insistir.
 */
export async function* refreshByPage(
  refs: readonly OfferRef[],
  ctx: CrawlContext,
  parse: (html: string, ref: OfferRef) => RawOffer | null,
  fetch: (ref: OfferRef) => Promise<string | null> = (ref) => getPage(ctx, ref.url),
): AsyncIterable<RawOffer> {
  let failures = 0;
  for (const ref of refs) {
    let html: string | null;
    try {
      html = await fetch(ref);
    } catch (error) {
      ctx.log.warn("refresh.page_failed", { url: ref.url, error });
      if (++failures >= MAX_REFRESH_FAILURES) throw error;
      continue;
    }
    if (!html) continue;
    const offer = parse(html, ref);
    if (offer) yield offer;
    else ctx.log.warn("refresh.page_unparsed", { url: ref.url });
  }
}

/**
 * Refresco horario (#121) para las tiendas cuyo listado ya trae precio y stock: recorre el listado de cada categoría
 * pedida y corta en cuanto vio todas sus ofertas. `list` no debe pedir fichas, o el refresco costaría un crawl.
 */
export async function* refreshByListing(
  refs: readonly OfferRef[],
  list: (category: Category) => AsyncIterable<RawOffer>,
): AsyncIterable<RawOffer> {
  for (const category of new Set(refs.map((ref) => ref.category))) {
    const pending = new Set(refs.filter((ref) => ref.category === category).map((ref) => ref.externalId));
    for await (const offer of list(category)) {
      if (pending.delete(offer.externalId)) yield offer;
      if (pending.size === 0) break;
    }
  }
}

/** HTML de una ficha, o null si ya no existe (producto retirado entre el listado y la ficha). */
export async function getPage(ctx: CrawlContext, url: string): Promise<string | null> {
  try {
    return (await ctx.http.get(url, { accept: "text/html" })).text;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}

const FICHA_SLOTS = 4;
const SLOT_MS = 6 * 60 * 60 * 1000;
/** El cron corre cada 6 h: cada producto cae en uno de cuatro turnos y repasa su ficha una vez al día. */
export function fichaDue(slug: string, now: number): boolean {
  let h = 2166136261;
  for (const ch of slug) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % FICHA_SLOTS === Math.floor(now / SLOT_MS) % FICHA_SLOTS;
}

/**
 * Texto de ficha que cuesta una petición aparte (MyShop, PrestaShop, SP Digital): el guardado se reusa, la oferta nueva
 * lo pide al tiro y una conocida sin texto sólo en su turno diario, o una ficha vacía se pediría en cada corrida. Una
 * agotada que nunca tuvimos no se guarda: su ficha no se pide. Si la petición falla, la oferta entra igual, sin texto.
 */
export async function fichaText(
  ctx: CrawlContext,
  offer: Pick<RawOffer, "url" | "inStock">,
  now: number,
  fetchText: () => Promise<string | null>,
): Promise<string | null> {
  const known = await ctx.known?.(offer.url);
  if (known?.sourceText) return known.sourceText;
  if (known ? !fichaDue(offer.url, now) : !offer.inStock) return null;
  try {
    return await fetchText();
  } catch (error) {
    ctx.log.warn("ficha.text_failed", { url: offer.url, error });
    return null;
  }
}
