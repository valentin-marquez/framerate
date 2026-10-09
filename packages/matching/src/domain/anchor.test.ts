import { describe, expect, test } from "bun:test";
import type { IdentitySource } from "@framerate/contracts";
import { anchorIdentity, decodeMpn, listingIdentityFrom } from "./anchor";

const raw = (
  category: IdentitySource["category"],
  identity: IdentitySource["identity"],
  extra: Partial<IdentitySource> = {},
): IdentitySource => ({
  category,
  brand: "",
  name: "producto de prueba",
  mpn: "",
  confidence: "high",
  identity,
  identity_from_mpn: [],
  identity_from_knowledge: [],
  ...extra,
});

// `traits` sale del título (traits.test.ts); aquí se mide sólo lo que viene de Haiku.
const fields = (identity: Record<string, unknown> | undefined) => {
  const { traits: _, ...rest } = identity ?? {};
  return rest;
};

describe("anclaje", () => {
  test("los valores por defecto sin token no entran; lo que dice el título sí", () => {
    // Medido: sin ficha, Haiku escribió modules=1, rgb=false, ecc=false, registered=false para una RAM que no lo dice.
    const r = anchorIdentity(
      raw("ram", {
        type: "ddr5",
        capacity_gb: 8,
        modules: 1,
        speed_mt_s: 4800,
        form_factor: "dimm",
        rgb: false,
        ecc: false,
        registered: false,
        cas_latency: null,
      }),
      { category: "ram", title: "Memoria RAM X-Micro 8 GB DDR5 4800 MHz U-DIMM Heatsink" },
    );
    // "U-DIMM" sí es un token negativo de registered (unbuffered).
    expect(fields(r.identity)).toEqual({
      type: "ddr5",
      capacity_gb: 8,
      speed_mt_s: 4800,
      form_factor: "dimm",
      registered: false,
    });
    expect(r.dropped).toEqual(["modules", "rgb", "ecc"]);
  });

  test("la ficha ancla lo que el título no dice, y el MPN impreso en la ficha cuenta", () => {
    const text = "Memoria RAM X-Micro XMD5U-HS-08G4800 DDR5 8GB 4800MHz CL40 color: Blanco";
    const { identity, anchored } = listingIdentityFrom(
      raw(
        "ram",
        { type: "ddr5", capacity_gb: 8, speed_mt_s: 4800, cas_latency: 40, color: "Blanco" },
        {
          brand: "X-Micro",
          mpn: "XMD5U-HS-08G4800",
        },
      ),
      { category: "ram", title: "Memoria RAM X-Micro 8 GB DDR5 4800 MHz U-DIMM", sourceText: text },
    );
    expect(anchored.identity).toMatchObject({ cas_latency: 40, color: "white" });
    expect(identity?.mpn).toBe("XMD5UHS08G4800");
    expect(identity?.brand).toBe("X-Micro");
  });

  test("un MPN que no está impreso no cuenta", () => {
    const { identity } = listingIdentityFrom(raw("ssd", { capacity_gb: 1000 }, { mpn: "ASU650SS-1TT-R" }), {
      category: "ssd",
      title: "DISCO SSD SATA ADATA SU650 1TB",
    });
    expect(identity?.mpn).toBeNull();
    expect(fields(identity?.identity)).toEqual({ capacity_gb: 1000 });
  });

  test("la ficha de otro producto no manda: el título contradice la línea y baja la confianza", () => {
    // Medido: Infor-Ingen publica "SSD PATRIOT ELITE 240GB" con la ficha del Patriot Burst.
    const r = anchorIdentity(raw("ssd", { capacity_gb: 240, interface: "sata", line: "Burst" }), {
      category: "ssd",
      title: 'DISCO DURO SSD PATRIOT ELITE 240GB SATA III 2.5"',
      sourceText: "Patriot Burst SSD 240GB SATA III unidad de estado sólido",
    });
    expect(fields(r.identity)).toEqual({ capacity_gb: 240, interface: "sata" });
    expect(r.dropped).toEqual(["line"]);
    expect(r.confidence).toBe("low");
  });

  test("el decodificador confirma lo que Haiku dice que sacó del MPN; lo no verificable se descarta", () => {
    const r = anchorIdentity(
      raw(
        "ram",
        { type: "ddr5", capacity_gb: 16, modules: 1, speed_mt_s: 5600, cas_latency: 36, line: "Fury Beast" },
        { identity_from_mpn: ["cas_latency"] },
      ),
      { category: "ram", title: "Memoria RAM Kingston Fury Beast 16GB DDR5 5600", mpn: "KF556C36BBE-16" },
    );
    expect(r.identity).toMatchObject({ cas_latency: 36, modules: 1 });
    expect(r.fromMpn).toEqual(["modules", "cas_latency"]);

    // El formato lo decodifica el extractor de hoy desde "H610M"; el color es un valor por defecto, no evidencia.
    const mobo = anchorIdentity(
      raw("motherboard", {
        chipset: "h610",
        model: "PRIME H610M-K",
        form_factor: "matx",
        memory_type: "ddr5",
        color: "black",
      }),
      { category: "motherboard", title: "PLACA MADRE ASUS PRIME H610M-K S1700 DDR5", mpn: "PRIMEH610M-K" },
    );
    expect(fields(mobo.identity)).toEqual({
      chipset: "h610",
      model: "prime h610m k",
      form_factor: "matx",
      memory_type: "ddr5",
    });
    expect(mobo.dropped).toEqual(["color"]);
  });

  test("booleanos sólo con token explícito; el O12G de ASUS vale como OC", () => {
    expect(
      fields(
        anchorIdentity(raw("gpu", { chipset: "rtx 5070", vram_gb: 12, oc: true, line: "Prime" }), {
          category: "gpu",
          title: "Tarjeta de Video ASUS Prime GeForce RTX 5070 12GB GDDR7",
          mpn: "PRIME-RTX5070-O12G",
        }).identity,
      ),
    ).toEqual({ chipset: "rtx 5070", vram_gb: 12, oc: true, line: "prime" });
    expect(
      anchorIdentity(raw("ram", { ecc: true }), {
        category: "ram",
        title: "Memoria RAM Kingston 16GB DDR5 5600MHz DIMM CL46 Non-ECC",
      }).dropped,
    ).toEqual(["ecc"]);
    expect(
      fields(
        anchorIdentity(raw("ram", { ecc: false, registered: false }), {
          category: "ram",
          title: "Memoria RAM Kingston 16GB DDR5 5600MHz DIMM CL46 Non-ECC",
        }).identity,
      ),
    ).toEqual({ ecc: false });
  });

  test("capacidades con unidad y chipset pegado o separado", () => {
    expect(
      fields(
        anchorIdentity(raw("ssd", { capacity_gb: 1000, interface: "nvme", form_factor: "m2_2280", pcie_gen: 4 }), {
          category: "ssd",
          title: "SSD Kingston NV3 1TB M.2 2280 PCIe 4.0 x4 NVMe",
        }).identity,
      ),
    ).toEqual({ capacity_gb: 1000, interface: "nvme", form_factor: "2280", pcie_gen: 4 });
    expect(
      fields(
        anchorIdentity(raw("gpu", { chipset: "rtx 5070 ti", vram_gb: 16 }), {
          category: "gpu",
          title: "MSI RTX5070Ti 16G VENTUS 3X OC",
        }).identity,
      ),
    ).toEqual({ chipset: "rtx 5070 ti", vram_gb: 16 });
  });

  test("decodificadores de MPN", () => {
    expect(decodeMpn("ram", "CMH32GX5M2X7200C34")).toEqual({
      capacity_gb: 32,
      type: "ddr5",
      modules: 2,
      speed_mt_s: 7200,
      cas_latency: 34,
    });
    expect(decodeMpn("ram", "KF556S40IB16")).toMatchObject({ form_factor: "sodimm", cas_latency: 40, capacity_gb: 16 });
    expect(decodeMpn("ram", "KF560C36BBE2AK232")).toMatchObject({ modules: 2, capacity_gb: 32, speed_mt_s: 6000 });
    expect(decodeMpn("gpu", "DUALRTX5050O8G")).toEqual({ oc: true, vram_gb: 8 });
    expect(decodeMpn("gpu", "DUALRTX50508G")).toEqual({ oc: false, vram_gb: 8 });
    expect(decodeMpn("ram", "100100000910WOF")).toEqual({});
  });
});
