import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createDb, type Db } from "../src/client";
import { createTestD1, resetD1 } from "../src/testing";

/**
 * Invariantes del modelo de datos, verificadas contra D1 real con las
 * migraciones reales. Cada test documenta una regla de negocio que vive en la
 * base (no sólo en la API) y que el sistema anterior violaba.
 */

let d1: D1Database;
let dispose: () => Promise<void>;
let db: Db;
const T = "2026-09-01T00:00:00.000Z";

beforeAll(async () => {
  ({ d1, dispose } = await createTestD1());
  db = createDb(d1);
});
afterAll(() => dispose());
beforeEach(() => resetD1(d1));

async function user(id: string, extra: Partial<{ username: string; role: "user" | "moderator" | "admin" }> = {}) {
  await db.query
    .insertInto("users")
    .values({
      id,
      email: `${id}@example.com`,
      username: extra.username ?? id,
      display_name: id,
      role: extra.role,
      created_at: T,
      updated_at: T,
    })
    .execute();
  return id;
}

async function store(slug = "alfa") {
  const row = await db.query
    .insertInto("stores")
    .values({ slug, name: slug, url: `https://${slug}.cl`, domain: `${slug}.cl`, created_at: T })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}

async function product(slug = "p1", category = "cpu") {
  const row = await db.query
    .insertInto("products")
    .values({ slug, name: slug, category, created_at: T, updated_at: T })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}

const rejects = (p: Promise<unknown>) => expect(p).rejects.toThrow();

describe("identidad", () => {
  test("username: 3–24 caracteres [a-z0-9_], único", async () => {
    await user("ana_01");
    await rejects(user("x1", { username: "ana_01" }));
    await rejects(user("x2", { username: "Ana" }));
    await rejects(user("x3", { username: "ab" }));
    await rejects(user("x4", { username: "con espacio" }));
    await rejects(user("x5", { username: "ana.perez" }));
  });

  test("rol único con valores cerrados; bans con historial", async () => {
    await user("mod", { role: "moderator" });
    await rejects(
      db.query
        .insertInto("users")
        .values({
          id: "z",
          email: "z@x.cl",
          username: "zzz",
          display_name: "z",
          role: "superadmin" as "admin",
          created_at: T,
          updated_at: T,
        })
        .execute(),
    );
    await user("ana");
    for (const created_at of [T, "2026-09-02T00:00:00.000Z"]) {
      await db.query.insertInto("user_bans").values({ user_id: "ana", banned_by: "mod", created_at }).execute();
    }
    expect(await db.query.selectFrom("user_bans").selectAll().execute()).toHaveLength(2);
  });
});

describe("tiendas y reseñas", () => {
  test("promedio mantenido por triggers, ignora reseñas eliminadas", async () => {
    const s = await store();
    await user("ana");
    await user("beto");
    const review = (user_id: string, rating: number) =>
      db.query.insertInto("store_reviews").values({ store_id: s, user_id, rating, created_at: T }).returning("id");
    const r1 = await review("ana", 5).executeTakeFirstOrThrow();
    await review("beto", 2).execute();

    const counters = () =>
      db.query
        .selectFrom("stores")
        .select(["rating_count", "rating_sum"])
        .where("id", "=", s)
        .executeTakeFirstOrThrow();
    expect(await counters()).toEqual({ rating_count: 2, rating_sum: 7 });

    await db.query.updateTable("store_reviews").set({ rating: 4 }).where("id", "=", r1.id).execute();
    expect(await counters()).toEqual({ rating_count: 2, rating_sum: 6 });

    await db.query
      .updateTable("store_reviews")
      .set({ deleted_at: T, deletion_reason: "author" })
      .where("id", "=", r1.id)
      .execute();
    expect(await counters()).toEqual({ rating_count: 1, rating_sum: 2 });
  });

  test("una reseña activa por usuario y tienda; se puede volver a reseñar tras eliminarla", async () => {
    const s = await store();
    await user("ana");
    const r = await db.query
      .insertInto("store_reviews")
      .values({ store_id: s, user_id: "ana", rating: 3, created_at: T })
      .returning("id")
      .executeTakeFirstOrThrow();
    await rejects(
      db.query.insertInto("store_reviews").values({ store_id: s, user_id: "ana", rating: 5, created_at: T }).execute(),
    );
    await db.query
      .updateTable("store_reviews")
      .set({ deleted_at: T, deletion_reason: "author" })
      .where("id", "=", r.id)
      .execute();
    await db.query
      .insertInto("store_reviews")
      .values({ store_id: s, user_id: "ana", rating: 5, created_at: T })
      .execute();
  });

  test("votos útiles: uno por usuario, contador por trigger", async () => {
    const s = await store();
    await user("ana");
    await user("beto");
    const r = await db.query
      .insertInto("store_reviews")
      .values({ store_id: s, user_id: "ana", rating: 4, created_at: T })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db.query
      .insertInto("store_review_votes")
      .values({ review_id: r.id, user_id: "beto", created_at: T })
      .execute();
    await rejects(
      db.query.insertInto("store_review_votes").values({ review_id: r.id, user_id: "beto", created_at: T }).execute(),
    );
    const { helpful_count } = await db.query
      .selectFrom("store_reviews")
      .select("helpful_count")
      .where("id", "=", r.id)
      .executeTakeFirstOrThrow();
    expect(helpful_count).toBe(1);
  });

  test("reclamos: un solo reclamo vivo por tienda (no hay 'toma' por un segundo usuario)", async () => {
    const s = await store();
    await user("ana");
    await user("beto");
    const claim = (claimant_id: string, token: string, status: "pending" | "confirmed" | "expired") =>
      db.query
        .insertInto("store_claims")
        .values({
          store_id: s,
          claimant_id,
          domain: "alfa.cl",
          token,
          status,
          expires_at: T,
          created_at: T,
          updated_at: T,
        })
        .execute();
    await claim("ana", "t1", "expired");
    await claim("ana", "t2", "confirmed");
    await rejects(claim("beto", "t3", "pending"));
  });
});

describe("cotizaciones", () => {
  async function quote() {
    await user("ana");
    return db.query
      .insertInto("quotes")
      .values({ public_id: "abc12345", owner_id: "ana", name: "Mi PC", created_at: T, updated_at: T })
      .returning("id")
      .executeTakeFirstOrThrow();
  }

  test("una sola alternativa seleccionada por slot exclusivo; storage es aditivo", async () => {
    const q = await quote();
    const [cpuA, cpuB, ssdA, ssdB] = await Promise.all([
      product("cpu-a"),
      product("cpu-b"),
      product("ssd-a", "ssd"),
      product("ssd-b", "ssd"),
    ]);
    const item = (product_id: number, slot: "cpu" | "storage", is_selected: 0 | 1) =>
      db.query
        .insertInto("quote_items")
        .values({ quote_id: q.id, product_id, slot, is_selected, created_at: T, updated_at: T })
        .execute();
    await item(cpuA, "cpu", 1);
    await item(cpuB, "cpu", 0);
    await rejects(db.query.updateTable("quote_items").set({ is_selected: 1 }).where("product_id", "=", cpuB).execute());
    await item(ssdA, "storage", 1);
    await item(ssdB, "storage", 1);
  });

  test("cambiar ítems invalida el análisis guardado", async () => {
    const q = await quote();
    await db.query
      .updateTable("quotes")
      .set({ analysis_status: "valid", analysis: "{}", analyzed_at: T })
      .where("id", "=", q.id)
      .execute();
    await db.query
      .insertInto("quote_items")
      .values({ quote_id: q.id, product_id: await product(), slot: "cpu", created_at: T, updated_at: T })
      .execute();
    const row = await db.query
      .selectFrom("quotes")
      .select(["analysis_status", "analysis", "updated_at"])
      .where("id", "=", q.id)
      .executeTakeFirstOrThrow();
    expect(row.analysis_status).toBe("unknown");
    expect(row.analysis).toBeNull();
    expect(row.updated_at > T).toBe(true);
  });
});

describe("comentarios", () => {
  async function comment(product_id: number, parent_id: number | null, author_id = "ana") {
    return db.query
      .insertInto("comments")
      .values({ product_id, parent_id, author_id, body: "hola", created_at: T })
      .returning("id")
      .executeTakeFirstOrThrow();
  }

  test("árbol: root, depth y path calculados; reply_count sólo cuenta respuestas vivas", async () => {
    await user("ana");
    const p = await product();
    const root = await comment(p, null);
    const reply = await comment(p, root.id);
    const nested = await comment(p, reply.id);

    const rows = await db.query
      .selectFrom("comments")
      .select(["id", "root_id", "depth", "path", "reply_count"])
      .orderBy("path")
      .execute();
    expect(rows.map((r) => [r.id, r.root_id, r.depth])).toEqual([
      [root.id, root.id, 0],
      [reply.id, root.id, 1],
      [nested.id, root.id, 2],
    ]);
    expect(rows[2]?.path).toBe(
      `${String(root.id).padStart(10, "0")}/${String(reply.id).padStart(10, "0")}/${String(nested.id).padStart(10, "0")}`,
    );
    expect(rows[0]?.reply_count).toBe(2);

    await db.query
      .updateTable("comments")
      .set({ deleted_at: T, deletion_reason: "author", body: null })
      .where("id", "=", nested.id)
      .execute();
    const rootRow = await db.query
      .selectFrom("comments")
      .select("reply_count")
      .where("id", "=", root.id)
      .executeTakeFirstOrThrow();
    expect(rootRow.reply_count).toBe(1);
  });

  test("profundidad máxima 10 y la respuesta debe ser del mismo producto", async () => {
    await user("ana");
    const p = await product();
    let parent = await comment(p, null);
    for (let i = 1; i <= 10; i++) parent = await comment(p, parent.id);
    await rejects(comment(p, parent.id));

    const other = await product("p2");
    const root = await comment(p, null);
    await rejects(comment(other, root.id));
  });

  test("likes: uno por usuario, contador por trigger; un comentario vivo necesita cuerpo", async () => {
    await user("ana");
    await user("beto");
    const p = await product();
    const c = await comment(p, null);
    await db.query.insertInto("comment_likes").values({ comment_id: c.id, user_id: "beto", created_at: T }).execute();
    await db.query.deleteFrom("comment_likes").where("user_id", "=", "beto").execute();
    await db.query.insertInto("comment_likes").values({ comment_id: c.id, user_id: "ana", created_at: T }).execute();
    const row = await db.query
      .selectFrom("comments")
      .select("like_count")
      .where("id", "=", c.id)
      .executeTakeFirstOrThrow();
    expect(row.like_count).toBe(1);
    await rejects(db.query.updateTable("comments").set({ body: null }).where("id", "=", c.id).execute());
  });
});

describe("moderación y soporte", () => {
  test("un reporte vivo por (objetivo, denunciante); resolver exige fecha", async () => {
    await user("ana");
    const report = () =>
      db.query
        .insertInto("reports")
        .values({ target_type: "comment", target_id: "1", reporter_id: "ana", reason: "spam", created_at: T })
        .returning("id");
    const r = await report().executeTakeFirstOrThrow();
    await rejects(report().execute());
    await rejects(db.query.updateTable("reports").set({ status: "resolved" }).where("id", "=", r.id).execute());
    await db.query
      .updateTable("reports")
      .set({ status: "resolved", resolved_at: T, resolution: "content_removed" })
      .where("id", "=", r.id)
      .execute();
    await report().execute();
  });

  test("tickets: anónimo requiere token; notas internas sólo de staff; mensajes públicos actualizan la actividad", async () => {
    await rejects(
      db.query
        .insertInto("support_tickets")
        .values({
          public_id: "tk1",
          email: "a@b.cl",
          category: "bug",
          subject: "Falla",
          created_at: T,
          updated_at: T,
          last_message_at: T,
        })
        .execute(),
    );
    const t = await db.query
      .insertInto("support_tickets")
      .values({
        public_id: "tk2",
        email: "a@b.cl",
        category: "bug",
        subject: "Falla",
        access_token_hash: "h",
        created_at: T,
        updated_at: T,
        last_message_at: T,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await rejects(
      db.query
        .insertInto("support_messages")
        .values({ ticket_id: t.id, author_role: "user", body: "nota", is_internal: 1, created_at: T })
        .execute(),
    );
    const later = "2026-09-05T00:00:00.000Z";
    await db.query
      .insertInto("support_messages")
      .values({ ticket_id: t.id, author_role: "staff", body: "respuesta", created_at: later })
      .execute();
    const row = await db.query
      .selectFrom("support_tickets")
      .select("last_message_at")
      .where("id", "=", t.id)
      .executeTakeFirstOrThrow();
    expect(row.last_message_at).toBe(later);
  });
});

describe("catálogo", () => {
  test("facetas: exactamente un tipo de valor por fila", async () => {
    const p = await product();
    await db.query
      .insertInto("product_spec_values")
      .values([
        { product_id: p, key: "socket", value_text: "am5", value_num: null },
        { product_id: p, key: "cores.total", value_text: null, value_num: 8 },
      ])
      .execute();
    await rejects(
      db.query
        .insertInto("product_spec_values")
        .values({ product_id: p, key: "x", value_text: "a", value_num: 1 })
        .execute(),
    );
  });

  test("dominio de tienda único (base del reclamo)", async () => {
    await store("alfa");
    await rejects(
      db.query
        .insertInto("stores")
        .values({ slug: "alfa2", name: "x", url: "https://alfa.cl", domain: "alfa.cl", created_at: T })
        .execute(),
    );
  });
});
