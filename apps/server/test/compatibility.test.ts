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
import { chipsetKey, cpuFamily } from "@/features/compatibility/cpu-support";

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
    expect(checkCompatibility([gpu])).toEqual({ status: "unknown", checks: [], estimatedWatts: 40 + 285 });
  });

  test("advertencias: SO-DIMM, socket que el cooler no lista, CPU sin cooler y fuente justa", () => {
    const sodimm = part("ram", { type: "ddr5", form_factor: "sodimm", modules: 1 });
    expect(results([mb, sodimm]).memory_form_factor).toBe("warning");
    expect(results([cpu, part("cpu_cooler", { type: "air", sockets: "LGA1700" })]).cooler_socket).toBe("warning");
    expect(results([cpu, part("cpu_cooler", { type: "air", sockets: "LGA1700, LGA1851, AMD" })]).cooler_socket).toBe(
      "warning",
    );
    expect(results([cpu, part("cpu_cooler", { type: "air", sockets: "Intel/AMD" })]).cooler_socket).toBe("warning");
    expect(results([cpu, part("cpu_cooler", { type: "air", sockets: "Intel" })]).cooler_socket).toBe("unknown");
    expect(results([cpu]).cooler_missing).toBe("warning");
    // 40 + 105 + 285 = 430 W: el mínimo es 650 W (psuSizing), 600 W alcanza pero queda justa; 400 W no alcanza.
    expect(results([cpu, gpu, part("psu", { wattage: 600 })]).psu_wattage).toBe("warning");
    expect(results([cpu, gpu, part("psu", { wattage: 650 })]).psu_wattage).toBe("ok");
    expect(results([cpu, gpu, part("psu", { wattage: 400 })]).psu_wattage).toBe("incompatible");
  });

  test("tamaños y cantidades: placa, tarjeta, cooler, radiador y módulos", () => {
    const itxBox = part("case", { supported_motherboard_form_factors: "Mini ITX", max_gpu_length_mm: 300 });
    expect(results([mb, itxBox, gpu])).toMatchObject({ board_case: "incompatible", gpu_length: "incompatible" });
    const tall = part("cpu_cooler", { type: "air", height_mm: 170 });
    expect(results([tall, box]).cooler_height).toBe("incompatible");
    expect(results([part("cpu_cooler", { type: "aio", radiator_mm: 420 }), box]).radiator).toBe("incompatible");
    expect(results([part("ram", { type: "ddr5", modules: 2 }, 3), mb]).memory_slots).toBe("incompatible");
  });

  test("el consumo estimado suma CPU, GPU y la base de 40 W; sin un TDP queda null", () => {
    expect(checkCompatibility([cpu, gpu]).estimatedWatts).toBe(40 + 105 + 285);
    expect(checkCompatibility([cpu, part("gpu", {})]).estimatedWatts).toBeNull();
  });

  test("bajo la fuente mínima que recomienda el fabricante de la tarjeta, advierte aunque la suma alcance (#180)", () => {
    const rtx = part("gpu", { tdp_w: 250, min_psu_w: 650 });
    expect(results([cpu, rtx, part("psu", { wattage: 600 })]).psu_wattage).toBe("warning");
    expect(results([cpu, rtx, part("psu", { wattage: 650 })]).psu_wattage).toBe("ok");
  });

  test("del procesador vale su potencia máxima de la ficha oficial si la hay (#179)", () => {
    const i9 = part("cpu", { socket: "LGA1700", tdp_w: 125, max_power_w: 253 });
    expect(checkCompatibility([i9, gpu]).estimatedWatts).toBe(40 + 253 + 285);
  });
});

describe("consumo del resto del equipo (#217)", () => {
  const cpu = part("cpu", { socket: "AM5", tdp_w: 105 });
  const gpu = part("gpu", { tdp_w: 285 });
  const watts = (parts: Part[]) => checkCompatibility(parts).estimatedWatts;
  const normal = [
    cpu,
    gpu,
    part("ram", { modules: 2 }),
    part("ssd", { interface: "nvme" }),
    part("case_fan", { quantity: 1 }, 3),
    part("cpu_cooler", { type: "air" }),
  ];

  test("un equipo normal queda a ±10 W de los 75 W de antes", () => {
    expect(Math.abs((watts(normal) ?? 0) - (75 + 105 + 285))).toBeLessThanOrEqual(10);
  });

  test("4 discos duros y 9 ventiladores suben la estimación por tipo y cantidad", () => {
    const loaded = [cpu, gpu, part("ram", { modules: 4 }), part("hdd", {}, 4), part("case_fan", { quantity: 3 }, 3)];
    // 40 + 20 + 40 + 27 + 105 + 285
    expect(watts(loaded)).toBe(517);
  });

  test("una AIO suma su bomba y un SSD SATA menos que uno NVMe", () => {
    expect(watts([cpu, gpu, part("cpu_cooler", { type: "aio" })])).toBe(40 + 6 + 105 + 285);
    expect(watts([cpu, gpu, part("ssd", { interface: "sata" })])).toBe(40 + 4 + 105 + 285);
    expect(watts([cpu, gpu, part("ssd", { interface: "nvme" })])).toBe(40 + 8 + 105 + 285);
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

describe("soporte de procesador por chipset (#188)", () => {
  const cpu = (model: string, socket = "AM5") => part("cpu", { model, socket, tdp_w: 65 });
  const mb = (chipset: string, socket = "AM5") => part("motherboard", { chipset, socket, memory_type: "DDR5" });
  const support = (c: Part, m: Part) =>
    checkCompatibility([c, m]).checks.find((k) => k.rule === "cpu_support")?.result ?? null;

  test.each([
    ["ryzen 7 7800x3d", "r7000"],
    ["ryzen 5 5600g", "r5000g"],
    ["ryzen 5 5600x", "r5000"],
    ["ryzen 7 8700g", "r8000g"],
    ["ryzen 9 9950x3d", "r9000"],
    ["ryzen 5 pro 4650g", "r4000g"],
    ["ryzen 5 2400g", "r2000"],
    ["athlon 3000g", "r3000g"],
    ["core i5 12400f", "i12"],
    ["core i9-14900k", "i14"],
    ["core i7 9700k", "i9"],
    ["core ultra 7 265k", "u200"],
    ["celeron g6900", "i12"],
    ["pentium gold g6405", "i10"],
    ["ryzen threadripper 7970x", null],
    ["xeon silver 4410y", null],
  ])("cpuFamily(%p) = %p", (model, expected) => expect(cpuFamily(model)).toBe(expected));

  test.each([
    ["B650E", "b650e"],
    ["AMD X870", "x870"],
    ["Intel Z790", "z790"],
    ["TRX50", null],
    [null, null],
  ])("chipsetKey(%p) = %p", (input, expected) => expect(chipsetKey(input)).toBe(expected));

  test("de fábrica, con BIOS y no soportado", () => {
    expect(support(cpu("ryzen 7 7800x3d"), mb("B650"))).toBe("ok");
    expect(support(cpu("ryzen 7 9800x3d"), mb("B650"))).toBe("warning");
    expect(support(cpu("ryzen 7 9800x3d"), mb("X870E"))).toBe("ok");
    expect(support(cpu("ryzen 5 5600x", "AM4"), mb("B450", "AM4"))).toBe("warning");
    expect(support(cpu("ryzen 5 3400g", "AM4"), mb("B550", "AM4"))).toBe("incompatible");
    expect(support(cpu("core i5 14600k", "LGA1700"), mb("Z690", "LGA1700"))).toBe("warning");
    expect(support(cpu("core i5 13400f", "LGA1700"), mb("B760", "LGA1700"))).toBe("ok");
    expect(support(cpu("core i5 11400", "LGA1200"), mb("B460", "LGA1200"))).toBe("incompatible");
    expect(support(cpu("core ultra 5 245k", "LGA1851"), mb("B860", "LGA1851"))).toBe("ok");
    const flashback = part("motherboard", { chipset: "B650", socket: "AM5", bios_flashback: true });
    expect(
      checkCompatibility([cpu("ryzen 7 9800x3d"), flashback]).checks.find((k) => k.rule === "cpu_support")?.message,
    ).toContain("tiene BIOS Flashback");
  });

  test("sin chipset es desconocido; con otro socket, Threadripper o Xeon no opina", () => {
    expect(support(cpu("ryzen 7 7800x3d"), part("motherboard", { socket: "AM5" }))).toBe("unknown");
    expect(support(cpu("ryzen 7 7800x3d"), mb("Z790", "LGA1700"))).toBeNull();
    expect(
      support(cpu("ryzen threadripper 7970x", "sTR5"), part("motherboard", { chipset: "TRX50", socket: "sTR5" })),
    ).toBeNull();
  });
});
