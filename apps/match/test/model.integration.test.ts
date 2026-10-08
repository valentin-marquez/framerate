import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import type { Db } from "@framerate/database";
import { all, createTestD1, resetD1 } from "@framerate/database/testing";
import { extractModels } from "@/model";

/** Saca el modelo del nombre donde no hay clave de atributos (#98), con guarda contra invención. */

let d1: D1Database;
let db: Db;
let dispose: () => Promise<void>;
const now = new Date("2026-10-08T12:00:00.000Z");
const at = "2026-10-07T12:00:00.000Z";

beforeAll(async () => {
  ({ d1, db, dispose } = await createTestD1());
});
afterAll(() => dispose());
beforeEach(() => resetD1(d1));

/** Workers AI falso: responde lo que se le diga, en orden, y cuenta las llamadas. */
function fakeAi(respuestas: string[]) {
  const ai = {
    calls: 0,
    async run() {
      const content = respuestas[ai.calls] ?? "none";
      ai.calls++;
      return { choices: [{ message: { content } }], usage: { neurons: 1.5 } };
    },
  };
  return ai as typeof ai & Ai;
}

async function seed(nombres: Array<{ name: string; category?: string; activa?: boolean }>) {
  const store = await db.query
    .insertInto("stores")
    .values({ slug: "alfa", name: "alfa", url: "https://alfa.cl", domain: "alfa.cl", created_at: at })
    .returning("id")
    .executeTakeFirstOrThrow();
  const ids: number[] = [];
  for (const [i, n] of nombres.entries()) {
    const { id } = await db.query
      .insertInto("products")
      .values({
        slug: `p-${i}`,
        name: n.name,
        category: n.category ?? "case",
        brand: "Cougar",
        created_at: at,
        updated_at: at,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    ids.push(id);
    await db.query
      .insertInto("listings")
      .values({
        store_id: store.id,
        product_id: id,
        external_id: `l-${i}`,
        url: `https://alfa.cl/p/${i}`,
        title: n.name,
        category: n.category ?? "case",
        price_cash: 50_000,
        price_card: 50_000,
        in_stock: 1,
        is_active: n.activa === false ? 0 : 1,
        first_seen_at: at,
        last_seen_at: at,
        updated_at: at,
      })
      .execute();
  }
  return ids;
}

test("guarda el modelo cuando aparece literal en el nombre y descarta lo inventado", async () => {
  const [bueno, inventado] = await seed([
    { name: "Cougar FV270 RGB Negro (2 front, 1 back fans)" },
    { name: "Cougar Duoface RGB TG Mid Tower Blanco" },
  ]);
  // El segundo devuelve algo que no está en el título: se descarta.
  const ai = fakeAi(["FV270", "MX410 Mesh"]);
  const result = await extractModels(db, ai, { now, neuronBudget: 100 });

  expect(result).toMatchObject({ asked: 2, valid: 1 });
  const productos = (await all(db, "products")) as Array<{ id: number; model_ai: string | null; model_ai_at: string }>;
  expect(productos.find((p) => p.id === bueno)?.model_ai).toBe("FV270");
  expect(productos.find((p) => p.id === inventado)?.model_ai).toBeNull();
  // Los dos quedan con fecha: no se vuelve a gastar neurons en el que falló.
  expect(productos.every((p) => p.model_ai_at === now.toISOString())).toBe(true);
});

test("no vuelve a preguntar por uno ya preguntado", async () => {
  await seed([{ name: "Cougar FV270 RGB Negro" }]);
  const ai = fakeAi(["FV270", "FV270"]);
  expect((await extractModels(db, ai, { now, neuronBudget: 100 })).asked).toBe(1);
  expect((await extractModels(db, ai, { now, neuronBudget: 100 })).asked).toBe(0);
  expect(ai.calls).toBe(1);
});

test("respeta el presupuesto y sólo mira categorías sin clave de atributos con oferta activa", async () => {
  await seed([
    { name: "Cougar FV270 RGB Negro" },
    { name: "Cougar MX410 Mesh Negro" },
    { name: "Cougar Poseidon GT 360 ARGB", category: "cpu_cooler" },
    // Fuera: tiene clave de atributos propia.
    { name: "Cougar GEX 750W 80 Plus Gold", category: "psu" },
    // Fuera: sin oferta activa.
    { name: "Cougar Airface RGB Blanco", activa: false },
  ]);
  const ai = fakeAi(["FV270", "MX410", "Poseidon GT 360"]);
  // 3 neurons alcanzan para 2 preguntas a 1,5 cada una.
  const corto = await extractModels(db, ai, { now, neuronBudget: 3 });
  expect(corto.asked).toBe(2);

  const resto = await extractModels(db, ai, { now, neuronBudget: 100 });
  expect(resto.asked).toBe(1);
  const conModelo = ((await all(db, "products")) as Array<{ model_ai: string | null }>).filter((p) => p.model_ai);
  expect(conModelo).toHaveLength(3);
});
