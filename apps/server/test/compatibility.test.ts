import { describe, expect, test } from "bun:test";
import type { Category } from "@framerate/contracts";
import {
  checkCompatibility,
  highlights,
  largestBoard,
  largestRadiator,
  memoryTypes,
  type Part,
  socket,
  sockets,
} from "@/features/compatibility/compatibility";

/** Valores tal como los escribe Haiku en producción (`listing_identity`). */

describe("normalizadores", () => {
  test.each([
    ["AM5", "am5"],
    ["am4", "am4"],
    ["LGA 1700", "lga1700"],
    ["FCLGA1851", "lga1851"],
    ["LGA-1700", "lga1700"],
    ["S1700", "lga1700"],
    [1700, "lga1700"],
    ["LGA1151-v2", "lga1151"],
    ["sTR5", "str5"],
    ["Socket AM4", "am4"],
    ["Intel", null],
    [null, null],
  ])("socket(%p) = %p", (input, expected) => expect(socket(input)).toBe(expected));

  test("sockets de cooler", () => {
    expect([...(sockets("1200/1700/1851/AM4/AM5") ?? [])]).toEqual(["lga1200", "lga1700", "lga1851", "am4", "am5"]);
    expect(sockets("LGA 115x / LGA 1200")?.has("lga1151")).toBe(true);
    expect(sockets("Intel LGA 1700/1851, AMD AM5/AM4")?.has("am5")).toBe(true);
    expect(sockets("Intel/AMD")).toBeNull();
  });

  test("memorias del procesador", () => {
    expect([...(memoryTypes("DDR5 5600 MT/s, DDR4 3200 MT/s") ?? [])]).toEqual(["ddr5", "ddr4"]);
    expect([...(memoryTypes("DDR4-2666") ?? [])]).toEqual(["ddr4"]);
    expect(memoryTypes("")).toBeNull();
  });

  test.each([
    ["atx", 2],
    ["ATX, Micro-ATX, Mini-ITX", 2],
    ["micro_atx, mini_itx", 1],
    ["M-ATX, ITX", 1],
    ["Extended ATX", 3],
    ["mini_itx, micro_atx, atx, e_atx", 3],
    ["Mini ITX", 0],
    ["Vidrio", null],
  ])("largestBoard(%p) = %p", (input, expected) => expect(largestBoard(input)).toBe(expected));

  test.each([
    [360, 360],
    ["front 360, top 240, rear 120", 360],
    ["240/360", 360],
    ["Top up to 360 mm; rear up to 120 mm", 360],
    ["sin soporte", null],
  ])("largestRadiator(%p) = %p", (input, expected) => expect(largestRadiator(input)).toBe(expected));
});

let nextId = 1;
const part = (category: Category, facts: Record<string, unknown>, quantity = 1): Part => ({
  itemId: nextId++,
  name: category,
  category,
  quantity,
  facts,
});
const results = (parts: Part[]) => Object.fromEntries(checkCompatibility(parts).checks.map((c) => [c.rule, c.result]));

describe("checkCompatibility", () => {
  const cpu = part("cpu", { socket: "AM5", tdp_w: 105, includes_cooler: false, memory_types: "DDR5" });
  const mb = part("motherboard", { socket: "am5", memory_type: "ddr5", form_factor: "atx", memory_slots: 4 });
  const ram = part("ram", { type: "ddr5", form_factor: "dimm", modules: 2 });
  const box = part("case", {
    supported_motherboard_form_factors: "ATX, Micro-ATX, Mini-ITX",
    max_gpu_length_mm: 400,
    max_cpu_cooler_height_mm: 165,
    radiator_support_mm: "front 360, top 240",
  });
  const gpu = part("gpu", { length_mm: 338, tdp_w: 285 });
  const psu = part("psu", { wattage: 850 });
  const air = part("cpu_cooler", { type: "air", height_mm: 155, sockets: "LGA1700, LGA1851, AM4, AM5" });

  test("un armado que calza da todo ok y estado valid", () => {
    const result = checkCompatibility([cpu, mb, ram, box, gpu, psu, air]);
    expect(result.status).toBe("valid");
    expect(result.checks.every((c) => c.result === "ok")).toBe(true);
    expect(result.checks.map((c) => c.rule as string).sort()).toEqual(
      [
        "board_case",
        "cooler_height",
        "cooler_socket",
        "gpu_length",
        "memory_form_factor",
        "memory_slots",
        "memory_type",
        "memory_type_cpu",
        "psu_wattage",
        "socket",
      ].sort(),
    );
  });

  test("socket y DDR distintos son incompatibles; el estado toma el peor", () => {
    const intel = part("motherboard", { socket: "LGA 1700", memory_type: "ddr4", form_factor: "atx", memory_slots: 4 });
    const result = checkCompatibility([cpu, intel, ram]);
    expect(result.status).toBe("incompatible");
    expect(results([cpu, intel, ram])).toMatchObject({ socket: "incompatible", memory_type: "incompatible" });
    expect(result.checks.find((c) => c.rule === "socket")?.message).toBe(
      "El procesador es AM5 y la placa LGA1700: no calzan.",
    );
  });

  test("desconocido nunca es incompatible", () => {
    const blank = part("motherboard", {});
    expect(checkCompatibility([cpu, blank]).status).not.toBe("incompatible");
    expect(results([cpu, blank]).socket).toBe("unknown");
  });

  test("sin pares que revisar el estado es unknown y no hay chequeos", () => {
    expect(checkCompatibility([gpu])).toEqual({ status: "unknown", checks: [], estimatedWatts: 75 + 285 });
  });

  test("advertencias: SO-DIMM, socket que el cooler no lista, CPU sin cooler y fuente justa", () => {
    const sodimm = part("ram", { type: "ddr5", form_factor: "sodimm", modules: 1 });
    expect(results([mb, sodimm]).memory_form_factor).toBe("warning");
    expect(results([cpu, part("cpu_cooler", { type: "air", sockets: "LGA1700" })]).cooler_socket).toBe("warning");
    expect(results([cpu]).cooler_missing).toBe("warning");
    // 75 + 105 + 285 = 465 W: 500 W alcanza pero sin 25 % de margen; 450 W no alcanza.
    expect(results([cpu, gpu, part("psu", { wattage: 500 })]).psu_wattage).toBe("warning");
    expect(results([cpu, gpu, part("psu", { wattage: 450 })]).psu_wattage).toBe("incompatible");
  });

  test("tamaños y cantidades: placa, tarjeta, cooler, radiador y módulos", () => {
    const itxBox = part("case", { supported_motherboard_form_factors: "Mini ITX", max_gpu_length_mm: 300 });
    expect(results([mb, itxBox, gpu])).toMatchObject({ board_case: "incompatible", gpu_length: "incompatible" });
    const tall = part("cpu_cooler", { type: "air", height_mm: 170 });
    expect(results([tall, box]).cooler_height).toBe("incompatible");
    expect(results([part("cpu_cooler", { type: "aio", radiator_mm: 420 }), box]).radiator).toBe("incompatible");
    expect(results([part("ram", { type: "ddr5", modules: 2 }, 3), mb]).memory_slots).toBe("incompatible");
  });

  test("el consumo estimado suma CPU, GPU y 75 W; sin un TDP queda null", () => {
    expect(checkCompatibility([cpu, gpu]).estimatedWatts).toBe(75 + 105 + 285);
    expect(checkCompatibility([cpu, part("gpu", {})]).estimatedWatts).toBeNull();
  });

  test("del procesador vale su potencia máxima de la ficha oficial si la hay (#179)", () => {
    const i9 = part("cpu", { socket: "LGA1700", tdp_w: 125, max_power_w: 253 });
    expect(checkCompatibility([i9, gpu]).estimatedWatts).toBe(75 + 253 + 285);
  });
});

describe("highlights", () => {
  test.each([
    ["cpu", { socket: "LGA 1700", cores_total: 8, tdp_w: 65 }, ["LGA1700", "8 núcleos", "65 W"]],
    [
      "motherboard",
      { socket: "AM5", memory_type: "ddr5", form_factor: "matx", memory_slots: 2 },
      ["AM5", "DDR5", "mATX", "2 slots"],
    ],
    ["ram", { type: "ddr4", speed_mt_s: 3200, modules: 2 }, ["DDR4", "3200 MT/s", "2 módulos"]],
    ["psu", { wattage: 850, efficiency: "gold", modular: "full" }, ["850 W", "Gold", "Modular"]],
    [
      "case",
      { supported_motherboard_form_factors: "ATX, Micro-ATX", max_gpu_length_mm: 400 },
      ["Hasta ATX", "GPU hasta 400 mm"],
    ],
    ["cpu_cooler", { type: "aio", radiator_mm: 360 }, ["Líquida", "360 mm"]],
    ["ssd", { capacity_gb: 1000, interface: "nvme", pcie_gen: 4 }, ["1 TB", "NVMe", "PCIe 4.0"]],
    ["gpu", {}, []],
  ] as const)("%s", (category, facts, expected) => expect(highlights(category, facts)).toEqual([...expected]));
});
