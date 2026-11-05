import { describe, expect, test } from "bun:test";
import { mouseProblem, socketText, toReference, uniqueAliases } from "../scripts/part-reference";
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

describe("referencia de mouses (#218)", () => {
  const url = "https://www.logitechg.com/g305";
  const mouse = (row: Record<string, unknown>) => {
    const ref = toReference("mouse", { brand: "Logitech", model: "G305 Lightspeed", source_url: url, ...row });
    if (!ref) throw new Error("sin referencia");
    return ref;
  };
  const size = { length_mm: 116.6, width_mm: 62.15, height_mm: 38.2 };

  test("forma y mano sólo con valores cerrados, y lo que la ficha no publica queda vacío", () => {
    expect(mouse({ ...size, shape: "rara", hand: "right" }).specs).toEqual({ ...size, hand: "right" });
  });

  test("la fila válida pasa, y sin alto también", () => {
    expect(mouseProblem(mouse(size))).toBeNull();
    expect(mouseProblem(mouse({ length_mm: 116.6, width_mm: 62.15 }))).toBeNull();
  });

  test("sin ficha oficial no se carga", () => {
    expect(mouseProblem(mouse({ ...size, source_url: undefined }))).toBe("sin URL de ficha oficial");
  });

  test("con las tres medidas los ejes se ordenan, porque cada ficha los nombra a su manera", () => {
    const swapped = mouse({ length_mm: 39, width_mm: 60, height_mm: 99 });
    expect(swapped.specs).toMatchObject({ length_mm: 99, width_mm: 60, height_mm: 39 });
    expect(mouseProblem(swapped)).toBeNull();
  });

  test("una fila parcial con los ejes cambiados, o con una medida imposible, se rechaza", () => {
    expect(mouseProblem(mouse({ length_mm: 62, width_mm: 116 }))).toBe("el largo no supera al ancho");
    expect(mouseProblem(mouse({ width_mm: 38, height_mm: 62 }))).toBe("el ancho no supera al alto");
    expect(mouseProblem(mouse({ length_mm: 400, width_mm: 62, height_mm: 38 }))).toBe("medida fuera de rango");
  });

  test("un mouse vertical puede ser más alto que ancho", () => {
    const lift = { length_mm: 108, width_mm: 71, height_mm: 70.5, shape: "vertical" };
    expect(mouseProblem(mouse({ ...lift, height_mm: 90 }))).toBeNull();
  });

  test("en un vertical el lado mayor es el largo, aunque la ficha lo llame Depth", () => {
    const lift = mouse({ length_mm: 71, width_mm: 70, height_mm: 108, shape: "vertical" });
    expect(lift.specs).toMatchObject({ length_mm: 108, height_mm: 71 });
    expect(mouseProblem(lift)).toBeNull();
  });

  test("un nombre del catálogo queda en una sola fila, la de ese modelo o la primera con medidas", () => {
    const row = (model: string, aliases: string[], specs = size) => ({ ...mouse(specs), model, aliases });
    const out = uniqueAliases([
      row("MX Master 3S for Business", ["mx master 3s", "mx master 3s business"]),
      row("Lift", ["lift vertical"], {} as typeof size),
      row("MX Master 3S", ["mx master 3s"]),
      row("Lift for Mac", ["lift vertical"]),
    ]);
    expect(out.map((r) => r.aliases)).toEqual([["mx master 3s business"], [], ["mx master 3s"], ["lift vertical"]]);
    const hits = out.filter((r) => pickPartReference([r], "mx master 3s"));
    expect(hits.map((r) => r.model)).toEqual(["MX Master 3S"]);
  });

  const ref = { ...mouse({ ...size, weight_g: 99 }), aliases: ["g305"] };
  const text = (specs: Record<string, number>) => ({
    specs,
    source: Object.fromEntries(Object.keys(specs).map((k) => [k, "text"])),
  });

  test("la referencia gana sobre la tienda", () => {
    const { specs, source } = text({ weight_g: 105 });
    const out = fillFromPartReference(specs, source, ref);
    expect(out.specs.weight_g).toBe(99);
    expect(out.source.weight_g).toBe("reference");
  });

  test("lo que la referencia no tiene conserva su valor y origen", () => {
    const { specs, source } = text({ max_dpi: 12000 });
    const out = fillFromPartReference(specs, source, ref);
    expect(out.specs.max_dpi).toBe(12000);
    expect(out.source.max_dpi).toBe("text");
  });

  test("en un cooler sigue ganando la tienda", () => {
    const { specs, source } = text({ height_mm: 150 });
    const cooler = { ...ref, category: "cpu_cooler", specs: { height_mm: 155 } };
    expect(fillFromPartReference(specs, source, cooler).specs.height_mm).toBe(150);
  });

  test("calza por nombre o alias, también en las variantes de color, y lo desconocido no toma nada", () => {
    expect(pickPartReference([ref], "g305")).toBe(ref);
    expect(pickPartReference([ref], "G305 Lightspeed")).toBe(ref);
    expect(pickPartReference([ref], "g502 x")).toBeUndefined();
    expect(pickPartReference([ref], "")).toBeUndefined();
  });
});
