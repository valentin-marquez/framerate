import { describe, expect, test } from "bun:test";
import { socketText, toReference } from "../scripts/part-reference";
import { fillFromPartReference, type PartReference, pickPartReference } from "../src/part-reference";

describe("referencia de coolers y gabinetes", () => {
  test("los sockets quedan en el texto que lee la regla, y lo vago no se escribe (#178)", () => {
    expect(socketText(["lga1851", "lga1700", "lga115x", "am5", "am4", "intel"])).toBe(
      "LGA1851, LGA1700, LGA115X, AM5, AM4",
    );
    const vague = toReference("cpu_cooler", {
      brand: "X",
      model: "Y",
      type: "air",
      height_mm: 155,
      sockets: [],
      sockets_vague: true,
    });
    expect(vague?.specs).toEqual({ type: "air", height_mm: 155 });
  });

  test("un AIO no lleva alto y un disipador de aire no lleva radiador", () => {
    const aio = toReference("cpu_cooler", { brand: "X", model: "Y 360", type: "aio", height_mm: 52, radiator_mm: 360 });
    expect(aio?.specs).toEqual({ type: "aio", radiator_mm: 360 });
  });

  test("el gabinete queda con placas y radiadores en el formato de las reglas", () => {
    const box = toReference("case", {
      brand: "Corsair",
      model: "4000D Airflow",
      motherboards: ["eatx", "atx", "matx", "itx"],
      max_gpu_length_mm: 360,
      max_cpu_cooler_height_mm: 170,
      radiators: { front: 360, top: 280, rear: 120 },
      included_fans: 2,
    });
    expect(box?.specs).toEqual({
      supported_motherboard_form_factors: "E-ATX, ATX, mATX, ITX",
      max_gpu_length_mm: 360,
      max_cpu_cooler_height_mm: 170,
      radiator_support_mm: "frente 360, techo 280, atrás 120",
      included_fans: 2,
    });
    expect(toReference("case", { brand: "X", model: null })).toBeNull();
  });

  const ref = (model: string, specs: PartReference["specs"], aliases: string[] = []): PartReference => ({
    category: "cpu_cooler",
    brand: "Cougar",
    model,
    specs,
    aliases,
    source_url: null,
  });

  test("calza por nombre o alias; con dos radiadores del mismo nombre desempata el de la oferta", () => {
    const refs = [ref("Poseidon Elite ARGB", { radiator_mm: 240 }), ref("Poseidon Elite ARGB", { radiator_mm: 360 })];
    expect(pickPartReference(refs, "poseidon elite argb", 360)?.specs.radiator_mm).toBe(360);
    expect(pickPartReference(refs, "poseidon elite argb", null)).toBeUndefined();
    expect(pickPartReference([ref("Forza 85", {}, ["forza 85 argb"])], "Forza 85 ARGB")?.model).toBe("Forza 85");
  });

  test("completa lo que falta, nunca lo que dice la tienda", () => {
    const out = fillFromPartReference(
      { height_mm: 150 },
      { height_mm: "text" },
      ref("A", { height_mm: 155, tdp_rating_w: 220 }),
    );
    expect(out.specs).toEqual({ height_mm: 150, tdp_rating_w: 220 });
    expect(out.source).toEqual({ height_mm: "text", tdp_rating_w: "reference" });
  });
});
