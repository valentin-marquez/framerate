import type { Db } from "@framerate/database";
import type { Logger } from "@framerate/kit";
import { sql } from "kysely";
import { MODEL } from "./judge";

/**
 * Saca el modelo del nombre de un producto donde no hay clave de atributos (#98). En gabinetes, coolers y
 * ventiladores el puntaje máximo es 0,45 y la banda de revisión empieza en 0,6, así que dos fichas del mismo
 * gabinete nunca se comparan. Lo que las identifica es un código corto (FV270, TD 300, Master Elite 302) que
 * ninguna regla general reconoce, pero el modelo lo saca bien: 94 de 100 títulos reales, a 1,41 neurons.
 *
 * Se guarda en `products.model_ai` y se pregunta UNA vez por producto, no por oferta: preguntar por oferta en cada
 * corrida no entra en ningún presupuesto. Lo usa el detector de duplicados (`detect.ts`), que sólo propone
 * revisiones; una clave que salió de un modelo de lenguaje nunca fusiona sola.
 */
const SYSTEM =
  "You extract the manufacturer's model name from a PC component listing title from a Chilean store. " +
  "Answer with only the model name, copied verbatim from the title, and nothing else. " +
  "The model name identifies the product line and version, for example: NR200P, 4000D AIRFLOW, H5 Flow, AK620, " +
  "P12 PWM, FV270, FN12A, MasterLiquid 240L. " +
  "Do NOT include: the brand, the color, the size in mm or inches, the form factor (ATX, mATX, ITX), the pack size, " +
  "RGB or ARGB, the wattage, or marketing words. " +
  "If the title has no model name, answer exactly: none";

/** Medido con 100 títulos de producción. */
export const NEURONS_PER_MODEL = 1.5;

const CATEGORIES = ["case", "cpu_cooler", "case_fan"];

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

export interface ExtractResult {
  asked: number;
  valid: number;
  neurons: number;
}

async function ask(ai: Ai, brand: string | null, name: string) {
  const response = (await ai.run(
    MODEL as Parameters<Ai["run"]>[0],
    {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Brand: ${brand ?? "unknown"}\nTitle: ${name}` },
      ],
      max_tokens: 24,
      temperature: 0,
      // Sin esto Gemma gasta los tokens razonando y devuelve contenido vacío.
      chat_template_kwargs: { enable_thinking: false },
    } as never,
  )) as {
    response?: string;
    choices?: Array<{ message: { content: string } }>;
    usage?: { neurons?: number };
  };
  const raw = (response.response ?? response.choices?.[0]?.message?.content ?? "").trim();
  return { raw: raw.replace(/^model( name)?:/i, "").trim(), neurons: response.usage?.neurons ?? NEURONS_PER_MODEL };
}

export async function extractModels(
  db: Db,
  ai: Ai,
  input: { now: Date; neuronBudget: number; log?: Logger },
): Promise<ExtractResult> {
  const result: ExtractResult = { asked: 0, valid: 0, neurons: 0 };
  const limit = Math.floor(input.neuronBudget / NEURONS_PER_MODEL);
  if (limit <= 0) return result;

  const rows = await db.query
    .selectFrom("products as p")
    .select(["p.id", "p.brand", "p.name"])
    .where("p.category", "in", CATEGORIES)
    .where("p.model_ai_at", "is", null)
    .where(sql<boolean>`exists (select 1 from listings l where l.product_id = p.id and l.is_active = 1)`)
    .orderBy("p.in_stock_offer_count", "desc")
    .orderBy("p.id")
    .limit(limit)
    .execute();

  const at = input.now.toISOString();
  for (const row of rows) {
    if (result.neurons >= input.neuronBudget) break;
    let modelo: string | null = null;
    try {
      const { raw, neurons } = await ask(ai, row.brand, row.name);
      result.neurons += neurons;
      result.asked++;
      // Guarda contra invención: lo que devuelve tiene que estar literal en el nombre.
      const ok = raw.toLowerCase() !== "none" && raw.length > 1 && fold(row.name).includes(fold(raw));
      if (ok) {
        modelo = raw;
        result.valid++;
      }
    } catch (error) {
      input.log?.error("model.extract_failed", { productId: row.id, error });
      continue; // Sin fecha: se reintenta en la corrida siguiente.
    }
    await db.query
      .updateTable("products")
      .set({ model_ai: modelo, model_ai_at: at })
      .where("id", "=", row.id)
      .execute();
  }
  return result;
}
