import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "@framerate/database";
import { createTestD1, resetD1 } from "@framerate/database/testing";
import { createApp } from "@/app";
import type { Env } from "@/env";
import { messageBody } from "@/features/support/support-inbound";
import worker from "@/index";
import { createUser, fakeEmail, testEnv } from "./helpers";

let d1: D1Database;
let db: Db;
let dispose: () => Promise<void>;
let env: Env;
let mail: ReturnType<typeof fakeEmail>;
const app = createApp();

beforeAll(async () => {
  ({ d1, db, dispose } = await createTestD1());
});
afterAll(() => dispose());
beforeEach(async () => {
  await resetD1(d1);
  mail = fakeEmail();
  ({ env } = testEnv(d1, {}, { EMAIL: mail.binding }));
});

const AUTH_OK =
  "i=1; mx.cloudflare.net; dkim=pass header.d=gmail.com; dmarc=pass header.from=gmail.com; spf=pass smtp.mailfrom=pedro@gmail.com";

/** Un correo como lo entrega Email Routing: sobre, cabeceras verificadas y el MIME crudo. */
function incoming(
  opts: {
    from?: string;
    envelope?: string;
    subject?: string;
    body?: string;
    messageId?: string;
    inReplyTo?: string;
    auth?: string;
    autoSubmitted?: string;
  } = {},
) {
  const from = opts.from ?? "pedro@gmail.com";
  const raw = [
    `From: Pedro <${from}>`,
    "To: soporte@framerate.cl",
    `Subject: ${opts.subject ?? "Precio equivocado"}`,
    `Message-ID: ${opts.messageId ?? "<m1@gmail.com>"}`,
    ...(opts.inReplyTo ? [`In-Reply-To: ${opts.inReplyTo}`] : []),
    "Content-Type: text/plain; charset=utf-8",
    "",
    opts.body ?? "Hola, la RTX 4060 aparece a $199.990 pero en la tienda está a $329.990.",
  ].join("\r\n");
  const headers = new Headers({ "arc-authentication-results": opts.auth ?? AUTH_OK });
  if (opts.autoSubmitted) headers.set("auto-submitted", opts.autoSubmitted);
  return {
    from: opts.envelope ?? from,
    to: "soporte@framerate.cl",
    headers,
    raw: new Response(raw).body,
    rawSize: raw.length,
    setReject() {},
    forward: async () => ({}),
    reply: async () => ({}),
  } as unknown as ForwardableEmailMessage;
}

async function receive(message: ForwardableEmailMessage) {
  await worker.email(message, env, mail.ctx);
  await mail.settle();
}

const tickets = () => db.query.selectFrom("support_tickets").selectAll().orderBy("id").execute();
const messages = (ticketId: number) =>
  db.query.selectFrom("support_messages").selectAll().where("ticket_id", "=", ticketId).orderBy("id").execute();

describe("correo entrante a soporte@", () => {
  test("un correo nuevo abre un ticket por correo y avisa que llegó", async () => {
    await receive(incoming());
    const [ticket] = await tickets();
    expect(ticket).toMatchObject({ source: "email", email: "pedro@gmail.com", user_id: null, status: "open" });
    expect(ticket?.subject).toBe("Precio equivocado");
    expect((await messages(ticket?.id ?? 0)).map((m) => m.message_id)).toEqual(["<m1@gmail.com>"]);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]?.to).toBe("pedro@gmail.com");
    expect(mail.sent[0]?.subject).toBe(`Precio equivocado [Framerate #${ticket?.public_id}]`);
    // Sin cuenta ni token, el aviso no trae enlace de seguimiento: se responde por correo.
    expect(mail.sent[0]?.html).not.toContain("?t=");
  });

  test("si la dirección es de una cuenta verificada, el ticket queda en la cuenta", async () => {
    const userId = await createUser(env, db, { name: "Pedro", email: "pedro@gmail.com" });
    await receive(incoming({ from: "Pedro@Gmail.com", envelope: "pedro@gmail.com" }));
    expect((await tickets())[0]?.user_id).toBe(userId);
  });

  test("una respuesta con [Framerate #id] se suma al hilo sin lo citado y reabre el ticket", async () => {
    await receive(incoming());
    const [ticket] = await tickets();
    await db.query.updateTable("support_tickets").set({ status: "waiting_user" }).execute();
    await receive(
      incoming({
        subject: `Re: Precio equivocado [Framerate #${ticket?.public_id}]`,
        messageId: "<m2@gmail.com>",
        body: "Gracias, ya lo vi.\n\nEl mié, 1 oct 2026 a las 21:05, Framerate <soporte@framerate.cl>\nescribió:\n> Hola Pedro, revisamos el precio.",
      }),
    );
    expect(await tickets()).toHaveLength(1);
    expect((await messages(ticket?.id ?? 0)).map((m) => m.body)).toEqual([
      "Hola, la RTX 4060 aparece a $199.990 pero en la tienda está a $329.990.",
      "Gracias, ya lo vi.",
    ]);
    expect((await tickets())[0]?.status).toBe("open");
    expect(mail.sent).toHaveLength(1);
  });

  test("In-Reply-To encuentra el ticket aunque cambie el asunto", async () => {
    await receive(incoming());
    await receive(incoming({ subject: "Otra cosa", messageId: "<m2@gmail.com>", inReplyTo: "<m1@gmail.com>" }));
    expect(await tickets()).toHaveLength(1);
  });

  test("la respuesta del equipo guarda su Message-ID y la respuesta de la persona llega al mismo ticket", async () => {
    await receive(incoming());
    const [ticket] = await tickets();
    const res = await app.request(
      `/v1/admin/support/tickets/${ticket?.public_id}/reply`,
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env.ADMIN_TOKEN}` },
        body: JSON.stringify({ body: "Ya quedó corregido." }),
      },
      env,
      mail.ctx,
    );
    expect(res.status).toBe(201);
    await mail.settle();
    const staff = (await messages(ticket?.id ?? 0)).find((m) => m.author_role === "staff");
    expect(staff?.message_id).toBe("<test-2@framerate.cl>");

    await receive(
      incoming({ subject: "Re: gracias", messageId: "<m3@gmail.com>", inReplyTo: "<test-2@framerate.cl>" }),
    );
    expect(await tickets()).toHaveLength(1);
    expect(await messages(ticket?.id ?? 0)).toHaveLength(3);
  });

  test("con el número de un ticket ajeno abre uno aparte en vez de escribir en el ajeno", async () => {
    await receive(incoming());
    const [ticket] = await tickets();
    await receive(
      incoming({
        from: "intruso@gmail.com",
        subject: `Re: [Framerate #${ticket?.public_id}]`,
        messageId: "<x1@gmail.com>",
        auth: "dmarc=pass; spf=pass",
      }),
    );
    const all = await tickets();
    expect(all).toHaveLength(2);
    expect(await messages(ticket?.id ?? 0)).toHaveLength(1);
  });

  test("un ticket cerrado no se reabre por correo: la respuesta abre uno nuevo", async () => {
    await receive(incoming());
    const [ticket] = await tickets();
    await db.query.updateTable("support_tickets").set({ status: "closed" }).execute();
    await receive(incoming({ subject: `Re: [Framerate #${ticket?.public_id}]`, messageId: "<m2@gmail.com>" }));
    expect(await tickets()).toHaveLength(2);
  });

  test("un reintento con el mismo Message-ID no se duplica", async () => {
    await receive(incoming());
    await receive(incoming());
    expect(await tickets()).toHaveLength(1);
  });

  test("lo que no se autentica se descarta", async () => {
    await receive(incoming({ auth: "spf=fail; dkim=none; dmarc=fail" }));
    // SPF pasa, pero para el dominio del sobre, que no es el del From: alguien escribiendo a nombre de otro.
    await receive(incoming({ envelope: "bounce@spammer.example", auth: "spf=pass; dkim=none", messageId: "<m2@x>" }));
    expect(await tickets()).toHaveLength(0);
    expect(mail.sent).toHaveLength(0);
  });

  test("las respuestas automáticas y los correos propios se ignoran", async () => {
    await receive(incoming({ autoSubmitted: "auto-replied" }));
    await receive(incoming({ from: "otro@framerate.cl", auth: "dmarc=pass", messageId: "<m2@framerate.cl>" }));
    expect(await tickets()).toHaveLength(0);
  });

  test("más de 5 tickets nuevos por hora desde la misma dirección se descartan", async () => {
    for (let i = 0; i < 7; i++) await receive(incoming({ subject: `Consulta ${i}`, messageId: `<n${i}@gmail.com>` }));
    expect(await tickets()).toHaveLength(5);
  });
});

describe("messageBody", () => {
  test("corta lo citado, recorta a 5000 y nunca queda vacío", () => {
    expect(messageBody("Respuesta.\n\nOn Wed, Oct 1, 2026 at 9:05 PM Framerate wrote:\n> antes")).toBe("Respuesta.");
    expect(messageBody("Arriba\n-----Original Message-----\nabajo")).toBe("Arriba");
    expect(messageBody("x".repeat(6000))).toHaveLength(5000);
    expect(messageBody("   ")).toBe("(Correo sin texto)");
  });
});
