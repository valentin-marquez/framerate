import { type Db, refreshProductsPriceSummary } from "@framerate/database";
import { CompiledQuery } from "kysely";
import { compare } from "./domain/decide";
import type { Fingerprint } from "./domain/fingerprint";
import { loadCandidates } from "./repository";

export type MergeResult =
  | { status: "merged"; from: number; to: number }
  | { status: "skipped"; from: number; to: number; reason: string };

/**
 * Una oferta con el MPN de un producto y el GTIN de otro prueba que son el mismo componente: se fusionan, el de menos
 * ofertas en el de más. No se fusiona con un veto entre la oferta y cualquiera de los dos o entre ellos, ni si una
 * persona o la IA ya rechazó el par (`forbid` o revisión rechazada): el matching prefiere duplicados.
 * Devuelve null si la oferta no reparte su identidad entre dos productos.
 */
export async function mergeSplitIdentity(
  db: Db,
  input: { listingId: number; fingerprint: Fingerprint; decidedBy?: string; now: string },
): Promise<MergeResult | null> {
  const fp = input.fingerprint;
  if (!fp.mpn || !fp.gtin) return null;
  const owners = await db.query
    .selectFrom("product_identifiers as i")
    .innerJoin("products as p", "p.id", "i.product_id")
    .select(["i.kind", "p.id", "p.offer_count as offers"])
    .where((eb) =>
      eb.or([
        eb.and([eb("i.kind", "=", "mpn"), eb("i.value", "=", fp.mpn)]),
        eb.and([eb("i.kind", "=", "gtin"), eb("i.value", "=", fp.gtin)]),
      ]),
    )
    .execute();
  const mpnOwner = owners.find((o) => o.kind === "mpn");
  const gtinOwner = owners.find((o) => o.kind === "gtin");
  if (!mpnOwner || !gtinOwner || mpnOwner.id === gtinOwner.id) return null;

  const mpnWins =
    mpnOwner.offers > gtinOwner.offers || (mpnOwner.offers === gtinOwner.offers && mpnOwner.id < gtinOwner.id);
  const pair = mpnWins ? { from: gtinOwner.id, to: mpnOwner.id } : { from: mpnOwner.id, to: gtinOwner.id };
  const reason = await mergeBlocker(db, fp, pair.from, pair.to);
  if (reason) return { status: "skipped", ...pair, reason };
  await mergeProducts(db, {
    ...pair,
    listingId: input.listingId,
    decidedBy: input.decidedBy ?? "system",
    now: input.now,
  });
  return { status: "merged", ...pair };
}

/** `fp` nula: la fusión no la prueba una oferta sino quien la pide, así que sólo se comparan los dos productos. */
async function mergeBlocker(db: Db, fp: Fingerprint | null, a: number, b: number): Promise<string | null> {
  const candidates = await loadCandidates(db, [a, b], fp ?? { mpn: null, gtin: null });
  const [pa, pb] = [a, b].map((id) => candidates.find((c) => c.productId === id)?.fingerprint);
  if (!pa || !pb) return "product_missing";
  // Entre productos el MPN/GTIN de cada uno sólo dice que tienen identificadores distintos, no que lo sean.
  const between = compare({ ...pa, mpn: null, gtin: null }, { ...pb, mpn: null, gtin: null }).vetoes;
  const offer = fp ? [...compare(fp, pa).vetoes, ...compare(fp, pb).vetoes] : [];
  const vetoes = [...offer, ...between];
  if (vetoes.length > 0) return `veto:${[...new Set(vetoes)].join(",")}`;

  const rejected = await db.query.executeQuery(
    CompiledQuery.raw(
      `SELECT 1 FROM match_reviews r JOIN listings l ON l.id = r.listing_id WHERE r.status = 'rejected'
         AND ((l.product_id = ?1 AND r.candidate_product_id = ?2) OR (l.product_id = ?2 AND r.candidate_product_id = ?1))
       UNION ALL
       SELECT 1 FROM match_overrides o JOIN listings l ON l.id = o.listing_id WHERE o.kind = 'forbid'
         AND ((l.product_id = ?1 AND o.product_id = ?2) OR (l.product_id = ?2 AND o.product_id = ?1))
       LIMIT 1`,
      [a, b],
    ),
  );
  return rejected.rows.length > 0 ? "rejected" : null;
}

/**
 * Fusiona dos productos cuando nadie puede probarlo con una oferta: lo prueba quien lo pide (#147). El de menos
 * ofertas entra en el de más, y con las mismas ofertas gana el id menor, igual que la fusión por identificador.
 * Respeta los mismos frenos: un veto entre los dos, un `forbid` o una revisión ya rechazada.
 */
export async function mergeProductPair(
  db: Db,
  input: { a: number; b: number; decidedBy: string; now: string },
): Promise<MergeResult> {
  const { a, b } = input;
  if (a === b) return { status: "skipped", from: a, to: b, reason: "same_product" };
  const rows = await db.query.selectFrom("products").select(["id", "offer_count"]).where("id", "in", [a, b]).execute();
  const [ra, rb] = [a, b].map((id) => rows.find((r) => r.id === id));
  if (!ra || !rb) return { status: "skipped", from: a, to: b, reason: "product_missing" };
  const aWins = ra.offer_count > rb.offer_count || (ra.offer_count === rb.offer_count && a < b);
  const pair = aWins ? { from: b, to: a } : { from: a, to: b };
  const reason = await mergeBlocker(db, null, pair.from, pair.to);
  if (reason) return { status: "skipped", ...pair, reason };
  await mergeProducts(db, { ...pair, listingId: null, decidedBy: input.decidedBy, now: input.now });
  return { status: "merged", ...pair };
}

/**
 * Todo lo que apunta a `from` pasa a `to` en una transacción y `from` se borra; su slug redirige a `to`. Cada oferta
 * que se muda queda auditada con `previousProductId`, así `splitListing` puede sacarla otra vez.
 */
async function mergeProducts(
  db: Db,
  input: { from: number; to: number; listingId: number | null; decidedBy: string; now: string },
) {
  const { from, to, now } = input;
  const evidence = JSON.stringify({ mergedFrom: from, previousProductId: from, proofListingId: input.listingId });
  const statements: [string, unknown[]][] = [
    ["UPDATE match_decisions SET product_id = ?2 WHERE product_id = ?1", [from, to]],
    [
      `INSERT INTO match_decisions (listing_id, product_id, method, confidence, evidence, decided_by, created_at)
       SELECT l.id, ?2, CASE WHEN (SELECT d.method FROM match_decisions d WHERE d.listing_id = l.id
         ORDER BY d.id DESC LIMIT 1) = 'manual' THEN 'manual' ELSE 'identifier' END, 1, ?3, ?4, ?5
       FROM listings l WHERE l.product_id = ?1`,
      [from, to, evidence, input.decidedBy, now],
    ],
    ["UPDATE listings SET product_id = ?2 WHERE product_id = ?1", [from, to]],
    ["UPDATE product_identifiers SET product_id = ?2 WHERE product_id = ?1", [from, to]],
    // Ofertas distintas el mismo día: el mínimo es el de los dos y los conteos se suman.
    [
      `INSERT INTO product_price_daily (product_id, day, min_cash, min_card, offer_count)
       SELECT ?2, day, min_cash, min_card, offer_count FROM product_price_daily WHERE product_id = ?1
       ON CONFLICT (product_id, day) DO UPDATE SET
         min_cash = MIN(min_cash, excluded.min_cash),
         min_card = MIN(min_card, excluded.min_card),
         offer_count = offer_count + excluded.offer_count`,
      [from, to],
    ],
    ["UPDATE match_reviews SET candidate_product_id = ?2 WHERE candidate_product_id = ?1", [from, to]],
    // Las pendientes de ofertas que ya quedaron en su candidato no tienen nada que decidir.
    [
      `UPDATE match_reviews SET status = 'accepted', resolved_at = ?3 WHERE status = 'pending'
       AND candidate_product_id = ?2 AND listing_id IN (SELECT id FROM listings WHERE product_id = ?2)`,
      [from, to, now],
    ],
    // Los choques de UNIQUE (la cotización ya tenía `to`, el override ya existía) se quedan en `from` y se borran.
    ["UPDATE OR IGNORE match_overrides SET product_id = ?2 WHERE product_id = ?1", [from, to]],
    ["UPDATE OR IGNORE quote_items SET product_id = ?2 WHERE product_id = ?1", [from, to]],
    ["DELETE FROM quote_items WHERE product_id = ?1", [from]],
    ["UPDATE comments SET product_id = ?2 WHERE product_id = ?1", [from, to]],
    ["UPDATE outbound_clicks SET product_id = ?2 WHERE product_id = ?1", [from, to]],
    [
      "UPDATE OR IGNORE reports SET target_id = CAST(?2 AS TEXT) WHERE target_type = 'product' AND target_id = CAST(?1 AS TEXT)",
      [from, to],
    ],
    [
      "UPDATE moderation_actions SET target_id = CAST(?2 AS TEXT) WHERE target_type = 'product' AND target_id = CAST(?1 AS TEXT)",
      [from, to],
    ],
    ["UPDATE product_slug_redirects SET product_id = ?2 WHERE product_id = ?1", [from, to]],
    [
      "INSERT OR IGNORE INTO product_slug_redirects (old_slug, product_id, created_at) SELECT slug, ?2, ?3 FROM products WHERE id = ?1",
      [from, to, now],
    ],
    [
      `UPDATE products SET
         image_url = COALESCE(image_url, (SELECT image_url FROM products WHERE id = ?1)),
         views_7d = views_7d + (SELECT views_7d FROM products WHERE id = ?1), updated_at = ?3
       WHERE id = ?2`,
      [from, to, now],
    ],
    ["DELETE FROM products WHERE id = ?1", [from]],
  ];
  await db.batch(statements.map(([sql, params]) => ({ compile: () => CompiledQuery.raw(sql, params) })));
  await refreshProductsPriceSummary(db, [to], new Date(now));
}
