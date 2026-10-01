import { decodeEntities } from "@framerate/kit";
import type { CrawlContext } from "./adapter";
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

/** HTML de una ficha, o null si ya no existe (producto retirado entre el listado y la ficha). */
export async function getPage(ctx: CrawlContext, url: string): Promise<string | null> {
  try {
    return (await ctx.http.get(url, { accept: "text/html" })).text;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}
