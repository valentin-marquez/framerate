import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import {
  AdminTicketDetailSchema,
  AdminTicketSchema,
  ApiErrorSchema,
  CreatedTicketSchema,
  TicketDetailSchema,
  TicketMessageSchema,
  TicketSchema,
} from "@framerate/contracts";
import type { Db } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { z } from "zod";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { createUser, sessionHeaders, testEnv, WEB_ORIGIN } from "./helpers";

let d1: D1Database;
let db: Db;
let dispose: () => Promise<void>;
let env: Env;
const app = createApp();
const realFetch = globalThis.fetch;
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Siteverify simulado: el resto de las URLs sigue a la red real (no debería haber ninguna). */
let turnstilePasses = true;
let siteverifyForms: URLSearchParams[] = [];
function stubSiteverify() {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url !== SITEVERIFY) return realFetch(input, init);
    siteverifyForms.push(new URLSearchParams(init?.body as URLSearchParams));
    return Response.json({ success: turnstilePasses });
  }) as typeof fetch;
}

beforeAll(async () => {
  ({ d1, db, dispose } = await createTestD1());
  ({ env } = testEnv(d1, {}, { TURNSTILE_SECRET_KEY: "test-turnstile-secret" }));
});
afterAll(() => dispose());
beforeEach(async () => {
  turnstilePasses = true;
  siteverifyForms = [];
  stubSiteverify();
  // Antes que `users`: su ON DELETE SET NULL dejaría tickets sin dueño ni token y rompería el CHECK.
  await db.query.deleteFrom("support_tickets").execute();
  await resetD1(d1);
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** `actor`: id de usuario (sesión), "anon" o "token" (token de servicio de admin). */
async function call(actor: string, path: string, method = "GET", body?: unknown, useEnv = env) {
  const headers = new Headers({ "content-type": "application/json", "cf-connecting-ip": "203.0.113.7" });
  if (actor === "token") headers.set("authorization", `Bearer ${env.ADMIN_TOKEN}`);
  else if (actor !== "anon") {
    for (const [k, v] of await sessionHeaders(env, actor)) headers.set(k, v);
    headers.set("origin", WEB_ORIGIN);
  }
  return app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, useEnv);
}

const who = (name: string, role: "user" | "moderator" | "admin" = "user") => createUser(env, db, { name, role });
const code = async (res: Response) => ApiErrorSchema.parse(await res.json()).error.code;
const sha256 = async (value: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");

const ticketInput = { category: "bug", subject: "No carga la ficha", body: "Al abrir la ficha sale un error." };

async function createTicket(actor: string, extra: object = {}) {
  const res = await call(actor, "/v1/support/tickets", "POST", { ...ticketInput, ...extra });
  expect(res.status).toBe(201);
  return CreatedTicketSchema.parse(await res.json());
}
const anonTicket = () => createTicket("anon", { email: "visita@example.com", turnstileToken: "widget-token" });

async function detail(actor: string, id: string, token?: string) {
  const res = await call(actor, `/v1/support/tickets/${id}${token ? `?token=${token}` : ""}`);
  expect(res.status).toBe(200);
  return TicketDetailSchema.parse(await res.json());
}
async function adminDetail(id: string) {
  const res = await call("token", `/v1/admin/support/tickets/${id}`);
  expect(res.status).toBe(200);
  return AdminTicketDetailSchema.parse(await res.json());
}
const adminReply = (id: string, body: string, isInternal = false, actor = "token") =>
  call(actor, `/v1/admin/support/tickets/${id}/reply`, "POST", { body, isInternal });
const patch = (id: string, body: object, actor = "token") =>
  call(actor, `/v1/admin/support/tickets/${id}`, "PATCH", body);
const setStatus = (id: string, status: "waiting_user" | "resolved" | "closed") =>
  db.query.updateTable("support_tickets").set({ status }).where("public_id", "=", id).execute();

describe("crear", () => {
  test("con sesión usa el correo de la cuenta, guarda el primer mensaje y no entrega token", async () => {
    const ana = await who("Ana");
    const ticket = await createTicket(ana, { email: "otro@example.com" });
    expect(ticket).toMatchObject({ category: "bug", subject: "No carga la ficha", status: "open", accessToken: null });
    expect(ticket.id).toMatch(/^[ABCDEFGHJKMNPQRSTVWXYZ2-9]{8}$/);

    const [row] = await all(db, "support_tickets");
    expect(row).toMatchObject({ user_id: ana, email: "ana@example.com", access_token_hash: null, source: "web" });
    const messages = await all(db, "support_messages");
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ ticket_id: row?.id, author_id: ana, author_role: "user", is_internal: 0 });
    expect(siteverifyForms).toHaveLength(0);
  });

  test("sin sesión y sin secreto de Turnstile responde 503", async () => {
    const res = await call(
      "anon",
      "/v1/support/tickets",
      "POST",
      { ...ticketInput, email: "visita@example.com", turnstileToken: "widget-token" },
      { ...env, TURNSTILE_SECRET_KEY: undefined },
    );
    expect(res.status).toBe(503);
    expect(await code(res)).toBe("support_unavailable");
  });

  test("sin sesión verifica Turnstile y entrega el token una sola vez (en la base sólo su hash)", async () => {
    const ticket = await anonTicket();
    expect(ticket.accessToken).toMatch(/^[0-9a-f]{64}$/);
    expect(siteverifyForms).toHaveLength(1);
    expect(Object.fromEntries(siteverifyForms[0] ?? [])).toEqual({
      secret: "test-turnstile-secret",
      response: "widget-token",
      remoteip: "203.0.113.7",
    });

    const [row] = await all(db, "support_tickets");
    expect(row).toMatchObject({ user_id: null, email: "visita@example.com" });
    expect(row?.access_token_hash).toBe(await sha256(ticket.accessToken as string));

    expect((await detail("anon", ticket.id, ticket.accessToken as string)).messages).toHaveLength(1);
    for (const token of ["", "?token=incorrecto"]) {
      const res = await call("anon", `/v1/support/tickets/${ticket.id}${token}`);
      expect(res.status).toBe(404);
      expect(await code(res)).toBe("ticket_not_found");
    }
  });

  test("sin sesión exige correo y un Turnstile válido", async () => {
    turnstilePasses = false;
    const rejected = await call("anon", "/v1/support/tickets", "POST", {
      ...ticketInput,
      email: "visita@example.com",
      turnstileToken: "widget-token",
    });
    expect(rejected.status).toBe(400);
    expect(await code(rejected)).toBe("turnstile_failed");

    const noToken = await call("anon", "/v1/support/tickets", "POST", { ...ticketInput, email: "visita@example.com" });
    expect(await code(noToken)).toBe("turnstile_failed");
    const noEmail = await call("anon", "/v1/support/tickets", "POST", {
      ...ticketInput,
      turnstileToken: "widget-token",
    });
    expect(noEmail.status).toBe(400);
    expect(await all(db, "support_tickets")).toHaveLength(0);
  });
});

describe("seguimiento", () => {
  test("mis tickets: sólo los propios, el de actividad más reciente primero; exige sesión", async () => {
    const [ana, beto] = [await who("Ana"), await who("Beto")];
    const older = await createTicket(ana);
    const newer = await createTicket(ana);
    await createTicket(beto);
    await db.query
      .updateTable("support_tickets")
      .set({ last_message_at: "2020-01-01T00:00:00.000Z" })
      .where("public_id", "=", older.id)
      .execute();

    const res = await call(ana, "/v1/support/tickets/mine");
    const { items } = z.object({ items: z.array(TicketSchema) }).parse(await res.json());
    expect(items.map((t) => t.id)).toEqual([newer.id, older.id]);
    expect((await call("anon", "/v1/support/tickets/mine")).status).toBe(401);
  });

  test("el detalle no muestra notas internas y un usuario no ve el ticket de otro", async () => {
    const [ana, beto] = [await who("Ana"), await who("Beto")];
    const ticket = await createTicket(ana);
    expect((await adminReply(ticket.id, "Parece un bug de la caché", true)).status).toBe(201);
    expect((await adminReply(ticket.id, "Gracias, lo estamos revisando")).status).toBe(201);

    const seen = await detail(ana, ticket.id);
    expect(seen.messages.map((m) => [m.authorRole, m.body, m.isInternal])).toEqual([
      ["user", ticketInput.body, false],
      ["staff", "Gracias, lo estamos revisando", false],
    ]);

    for (const actor of [beto, "anon"]) {
      const res = await call(actor, `/v1/support/tickets/${ticket.id}`);
      expect(res.status).toBe(404);
      expect(await code(res)).toBe("ticket_not_found");
    }
    expect((await call(beto, `/v1/support/tickets/${ticket.id}/reply`, "POST", { body: "hola" })).status).toBe(404);
  });

  test("responder reabre lo que esperaba al usuario o estaba resuelto; un ticket cerrado no acepta respuestas", async () => {
    const ana = await who("Ana");
    const ticket = await createTicket(ana);
    const reply = (body: string) => call(ana, `/v1/support/tickets/${ticket.id}/reply`, "POST", { body });

    for (const status of ["waiting_user", "resolved"] as const) {
      await setStatus(ticket.id, status);
      const res = await reply(`Sigue fallando (${status})`);
      expect(res.status).toBe(201);
      expect(TicketMessageSchema.parse(await res.json())).toMatchObject({ authorRole: "user", isInternal: false });
      expect((await detail(ana, ticket.id)).status).toBe("open");
    }

    await setStatus(ticket.id, "closed");
    const closed = await reply("¿Hola?");
    expect(closed.status).toBe(409);
    expect(await code(closed)).toBe("ticket_closed");
  });

  test("sin cuenta se responde con el token del ticket", async () => {
    const ticket = await anonTicket();
    const path = `/v1/support/tickets/${ticket.id}/reply`;
    expect((await call("anon", path, "POST", { body: "Más datos", token: "incorrecto" })).status).toBe(404);
    expect((await call("anon", path, "POST", { body: "Más datos", token: ticket.accessToken })).status).toBe(201);
    const messages = await all(db, "support_messages");
    expect(messages.map((m) => [m.author_id, m.body])).toEqual([
      [null, ticketInput.body],
      [null, "Más datos"],
    ]);
  });
});

describe("admin", () => {
  test("lista con filtro de estado; exige personal", async () => {
    const [ana, mod] = [await who("Ana"), await who("Mod", "moderator")];
    const first = await createTicket(ana);
    await createTicket(ana);
    await setStatus(first.id, "closed");

    const list = async (query: string) => {
      const res = await call(mod, `/v1/admin/support/tickets${query}`);
      expect(res.status).toBe(200);
      return z.object({ items: z.array(AdminTicketSchema) }).parse(await res.json()).items;
    };
    expect(await list("")).toHaveLength(2);
    const closed = await list("?status=closed");
    expect(closed.map((t) => [t.id, t.email, t.userId])).toEqual([[first.id, "ana@example.com", ana]]);
    expect(await list("?limit=1")).toHaveLength(1);

    expect((await call(mod, "/v1/admin/support/tickets?status=inventado")).status).toBe(400);
    expect((await call(ana, "/v1/admin/support/tickets")).status).toBe(403);
  });

  test("detalle con notas internas; la nota no cambia el estado y la respuesta pública pasa a waiting_user", async () => {
    const [ana, mod] = [await who("Ana"), await who("Mod", "moderator")];
    const ticket = await createTicket(ana);
    const before = await adminDetail(ticket.id);

    const note = await adminReply(ticket.id, "Revisar logs", true, mod);
    expect(note.status).toBe(201);
    expect(TicketMessageSchema.parse(await note.json())).toMatchObject({ authorRole: "staff", isInternal: true });
    const afterNote = await adminDetail(ticket.id);
    expect(afterNote.status).toBe("open");
    expect(afterNote.lastMessageAt).toBe(before.lastMessageAt);

    expect((await adminReply(ticket.id, "Ya quedó", false, mod)).status).toBe(201);
    const after = await adminDetail(ticket.id);
    expect(after.status).toBe("waiting_user");
    expect(after.messages.map((m) => m.isInternal)).toEqual([false, true, false]);
    const staff = (await all(db, "support_messages")).filter((m) => m.author_role === "staff");
    expect(staff.map((m) => m.author_id)).toEqual([mod, mod]);
  });

  test("cerrar fija closed_at, reabrir lo limpia; asignarse exige una persona", async () => {
    const [ana, mod] = [await who("Ana"), await who("Mod", "moderator")];
    const ticket = await createTicket(ana);
    const closedAt = async () => (await all(db, "support_tickets"))[0]?.closed_at;

    const closed = await patch(ticket.id, { status: "closed" });
    expect(closed.status).toBe(200);
    expect(AdminTicketSchema.parse(await closed.json()).status).toBe("closed");
    expect(await closedAt()).toEqual(expect.any(String));

    expect((await patch(ticket.id, { status: "in_progress" })).status).toBe(200);
    expect(await closedAt()).toBeNull();

    const assigned = AdminTicketSchema.parse(await (await patch(ticket.id, { assignToSelf: true }, mod)).json());
    expect(assigned).toMatchObject({ assignedTo: mod, status: "in_progress" });

    const byToken = await patch(ticket.id, { assignToSelf: true });
    expect(byToken.status).toBe(400);
    expect(await code(byToken)).toBe("cannot_assign_token");
    expect((await patch("NOEXISTE", { status: "closed" })).status).toBe(404);
  });
});
