import { $ } from "bun";

/**
 * Prototipo de "Condensar tiendas" (sólo lectura contra la D1 de producción): para cada k = 1..tiendas del reparto
 * más barato, el plan de menor total en efectivo con a lo más k tiendas. Fuerza bruta sobre subconjuntos de tiendas;
 * alcanza con 6 a 10 componentes. Escribe el fixture de `apps/web/.../prototypes/condensar/fixtures.ts`.
 *
 *   cd apps/server && bun scripts/condense-options.ts [PUBLIC_ID ...]
 */

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ["HPC67R3PRX", "5JN27XNGZA"];
const STORE_VALUE = 10_000;

interface Row {
  public_id: string;
  item_id: number;
  slot: string;
  quantity: number;
  product: string;
  listing_id: number;
  price_cash: number;
  slug: string;
  store: string;
  icon_url: string | null;
}

const sql = `SELECT q.public_id, qi.id AS item_id, qi.slot, qi.quantity, p.name AS product, l.id AS listing_id,
  l.price_cash, s.slug, s.name AS store, s.scraped_icon_url AS icon_url
FROM quote_items qi JOIN quotes q ON q.id = qi.quote_id JOIN products p ON p.id = qi.product_id
JOIN listings l ON l.product_id = qi.product_id JOIN stores s ON s.id = l.store_id
WHERE q.public_id IN (${ids.map((id) => `'${id.replace(/\W/g, "")}'`).join(",")})
  AND qi.is_selected = 1 AND l.is_active = 1 AND l.in_stock = 1
ORDER BY qi.position, qi.id, l.price_cash, l.id`;

const out = await $`bunx wrangler d1 execute framerate --remote --json --command ${sql}`.quiet();
const rows = (JSON.parse(out.stdout.toString()) as [{ results: Row[] }])[0].results;

function options(quoteRows: Row[]) {
  const stores = new Map<string, { slug: string; name: string; iconUrl: string | null }>();
  const items = new Map<
    number,
    { itemId: number; slot: string; name: string; quantity: number; offers: Map<string, Row> }
  >();
  for (const r of quoteRows) {
    stores.set(r.slug, { slug: r.slug, name: r.store, iconUrl: r.icon_url });
    const item = items.get(r.item_id) ?? {
      itemId: r.item_id,
      slot: r.slot,
      name: r.product,
      quantity: r.quantity,
      offers: new Map(),
    };
    // Filas ordenadas por precio: la primera de cada tienda es su mejor oferta.
    if (!item.offers.has(r.slug)) item.offers.set(r.slug, r);
    items.set(r.item_id, item);
  }
  const list = [...items.values()];
  const cheapest = new Map(list.map((i) => [i.itemId, [...i.offers.values()][0] as Row]));
  const minTotal = list.reduce((s, i) => s + (cheapest.get(i.itemId) as Row).price_cash * i.quantity, 0);
  const slugs = [...stores.keys()];

  const best = (k: number) => {
    let top: { total: number; picks: Row[] } | null = null;
    const pick: string[] = [];
    const visit = (from: number) => {
      if (pick.length === k) {
        let total = 0;
        const picks: Row[] = [];
        for (const item of list) {
          let offer: Row | undefined;
          for (const slug of pick) {
            const o = item.offers.get(slug);
            if (o && (!offer || o.price_cash < offer.price_cash)) offer = o;
          }
          if (!offer) return;
          total += offer.price_cash * item.quantity;
          picks.push(offer);
        }
        const used = new Set(picks.map((p) => p.slug)).size;
        const topUsed = top ? new Set(top.picks.map((p) => p.slug)).size : Number.POSITIVE_INFINITY;
        if (!top || total < top.total || (total === top.total && used < topUsed)) top = { total, picks };
        return;
      }
      for (let i = from; i < slugs.length; i++) {
        pick.push(slugs[i] as string);
        visit(i + 1);
        pick.pop();
      }
    };
    visit(0);
    return top as { total: number; picks: Row[] } | null;
  };

  const raw: { k: number; plan: ReturnType<typeof best> }[] = [];
  for (let k = 1; k <= slugs.length; k++) {
    const plan = best(k);
    raw.push({ k, plan });
    if (plan && plan.total === minTotal) break;
  }
  const storesNow = raw.at(-1)?.k ?? 0;

  const result = raw.map(({ k, plan }) => {
    if (!plan)
      return {
        stores: k,
        available: false,
        unavailableReason:
          k === 1
            ? `Ninguna tienda tiene los ${list.length} componentes`
            : `Ninguna combinación de ${k} tiendas tiene los ${list.length} componentes`,
        totalCash: 0,
        extraCash: 0,
        recommended: false,
        split: [],
      };
    const bySlug = new Map<string, { store: unknown; subtotalCash: number; items: unknown[] }>();
    list.forEach((item, n) => {
      const offer = plan.picks[n] as Row;
      const low = cheapest.get(item.itemId) as Row;
      const entry = bySlug.get(offer.slug) ?? { store: stores.get(offer.slug), subtotalCash: 0, items: [] };
      entry.subtotalCash += offer.price_cash * item.quantity;
      entry.items.push({
        itemId: item.itemId,
        listingId: offer.listing_id,
        slot: item.slot,
        name: item.name,
        quantity: item.quantity,
        priceCash: offer.price_cash,
        cheapest: offer.price_cash === low.price_cash,
        extraCash: (offer.price_cash - low.price_cash) * item.quantity,
      });
      bySlug.set(offer.slug, entry);
    });
    return {
      stores: bySlug.size,
      available: true,
      totalCash: plan.total,
      extraCash: plan.total - minTotal,
      recommended: false,
      split: [...bySlug.values()].sort((a, b) => b.subtotalCash - a.subtotalCash),
    };
  });
  // Una k que no mejora a la anterior (usa las mismas tiendas o menos) es la misma opción: no se repite.
  const deduped = result.filter((o, i) => !o.available || o.stores === raw[i]?.k);
  const pool = deduped.filter((o) => o.available);
  const score = (o: (typeof pool)[number]) => o.extraCash + STORE_VALUE * o.stores;
  const rec = pool.reduce((a, b) => (score(b) < score(a) ? b : a), pool[0] as (typeof pool)[number]);
  rec.recommended = true;
  return { itemCount: list.length, storesNow, minTotalCash: minTotal, options: deduped };
}

const body = ids
  .map((id) => {
    const o = options(rows.filter((r) => r.public_id === id));
    for (const opt of o.options)
      console.log(
        id,
        `k=${opt.stores}`,
        opt.available ? `$${opt.totalCash} +$${opt.extraCash}` : `no disponible`,
        opt.split.map((s) => (s.store as { name: string }).name).join(", "),
        opt.recommended ? "RECOMENDADA" : "",
      );
    return `  ${JSON.stringify(id)}: ${JSON.stringify({ quoteId: id, ...o })},`;
  })
  .join("\n");

const target = new URL("../../web/app/features/quote/prototypes/condensar/fixtures.ts", import.meta.url);
await Bun.write(
  target,
  `// Generado por apps/server/scripts/condense-options.ts con datos de producción (${new Date().toISOString().slice(0, 10)}).

/** Propuesta de contrato: una opción por número de tiendas, ya calculada en el servidor. */
export interface CondenseOption {
  /** Tiendas que usa de verdad el plan. */
  stores: number;
  available: boolean;
  unavailableReason?: string;
  totalCash: number;
  /** Diferencia contra el reparto más barato. */
  extraCash: number;
  /** La de menor \`extraCash + 10.000 × tiendas\`. */
  recommended: boolean;
  split: CondenseStoreSplit[];
}

export interface CondenseStoreSplit {
  store: { slug: string; name: string; iconUrl: string | null };
  subtotalCash: number;
  items: {
    itemId: number;
    listingId: number;
    slot: string;
    name: string;
    quantity: number;
    priceCash: number;
    cheapest: boolean;
    /** Lo que cuesta de más esta línea (por la cantidad) contra su tienda más barata. */
    extraCash: number;
  }[];
}

export interface CondenseOptions {
  quoteId: string;
  itemCount: number;
  /** Tiendas del reparto más barato. */
  storesNow: number;
  minTotalCash: number;
  options: CondenseOption[];
}

export const condenseOptions: Record<string, CondenseOptions> = {
${body}
};

export const highEndOptions = condenseOptions.HPC67R3PRX as CondenseOptions;
export const lowEndOptions = condenseOptions["5JN27XNGZA"] as CondenseOptions;
`,
);
console.log(`Escrito ${target.pathname}`);
