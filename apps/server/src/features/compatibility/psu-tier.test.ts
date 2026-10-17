import { describe, expect, test } from "bun:test";
import { checkCompatibility, type Part } from "./compatibility";
import { BRAND_BASE, brandBase, brandKeys, matchPsuTier, parsePsuTiers, parseWattages } from "./psu-tier";

// Encabezado y filas con la forma de la pestaña "Full List": marca, serie, subserie y variante sólo en la primera fila.
const CSV = `"Brand","Series ","","","Wattages ","Tier ","Year","Size","ATX","Input","Modularity","Efficiency","Prim","Sec","Reg","ODM","Platform","Notes"
"1st Player","ACK","","Bronze","650/750W","C-","2025","ATX","ATX 3.x","230V","No","B","DF","SR","DC-DC","Helly","ATX-0600T","5 year warranty"
"","","","","850W","E","2025","ATX","ATX 3.x","230V","No","B","DF","SR","DC-DC","Helly","ATX-0600T",""
"","","","Gold","750/850W","B*","2025","ATX","ATX 3.x","Full","Full","G","LLC","SR","DC-DC","Helly","",""
"MSI","MAG","A-GL","","650W","B","2022","ATX","ATX 2.X","Full","Full","G","LLC","SR","DC-DC","HEC","",""
"","","A-GL","PCIE5","750/850W","B","2023","ATX","ATX 3.x","Full","Full","G","LLC","SR","DC-DC","HEC","",""
"","","A-GLS PCIE5","","650/750W","A-","2024","ATX","ATX 3.x","Full","Full","G","LLC","SR","DC-DC","CWT","",""
"","","A-BN","-","650W","C","2022","ATX","ATX 2.x","Full","No","B","DF","SR","DC-DC","HEC","",""
"Corsair","RM-x","","2021","850W","A","2021","ATX","ATX 2.x","Full","Full","G","LLC","SR","DC-DC","CWT","",""
"","","","2024 Shift","850W","B+","2024","ATX","ATX 3.x","Full","Full","G","LLC","SR","DC-DC","CWT","",""
`;

const rows = parsePsuTiers(CSV);
const of = (brand: string) => rows.filter((r) => brandKeys(r.brand).includes(brand));

describe("lectura de la planilla", () => {
  test("hereda marca, serie y variante de la fila de arriba hasta el nivel que cambia", () => {
    expect(rows.map((r) => [r.brand, r.series, r.subseries, r.variant, r.tier, r.limited])).toEqual([
      ["1st Player", "ACK", "", "Bronze", "C-", false],
      ["1st Player", "ACK", "", "Bronze", "E", false],
      ["1st Player", "ACK", "", "Gold", "B", true],
      ["MSI", "MAG", "A-GL", "", "B", false],
      ["MSI", "MAG", "A-GL", "PCIE5", "B", false],
      ["MSI", "MAG", "A-GLS PCIE5", "", "A-", false],
      ["MSI", "MAG", "A-BN", "", "C", false],
      ["Corsair", "RM-x", "", "2021", "A", false],
      ["Corsair", "RM-x", "", "2024 Shift", "B+", false],
    ]);
    expect(rows[0]).toMatchObject({ wattages: [650, 750], modular: "none", efficiency: "bronze", atxVersion: "3.x" });
  });

  test("las marcas compuestas calzan por cada parte", () => {
    expect(brandKeys("Antec/Atom")).toEqual(["antecatom", "antec", "atom"]);
    expect(brandKeys("ADATA XPG")).toEqual(["adataxpg", "adata", "xpg"]);
    expect(brandKeys("be quiet!")).toEqual(["bequiet", "be", "quiet"]);
  });
});

describe("vínculo de una fuente del catálogo", () => {
  test.each([
    ["1st Player ACK 750W 80 Plus Bronze", 750, "C-"],
    ["1st Player ACK 850W Bronze", 850, "E"],
    // La planilla escribe el modelo sin la potencia: A-GL es A750GL; con PCIE5 gana la fila más específica.
    ["MSI MAG A650GL 650W 80 Plus Gold", 650, "B"],
    ["MSI MAG A750GLS PCIE5 750W 80 Plus Gold", 750, "A-"],
    ["MSI MAG A650BN 650W 80 Plus Bronze", 650, "C"],
  ])("%s", (name, watts, tier) => {
    const brand = name.split(" ")[0] === "1st" ? "1stplayer" : (name.split(" ")[0] ?? "").toLowerCase();
    expect(matchPsuTier(name, watts, of(brand))?.tier).toBe(tier);
  });

  test("el año de la variante no se exige; lo empatado devuelve el rango de notas", () => {
    expect(matchPsuTier("Corsair RM850x 850W 80 Plus Gold", 850, of("corsair"))?.tier).toBe("A");
    expect(matchPsuTier("Corsair RM850x Shift 850W 80 Plus Gold", 850, of("corsair"))?.tier).toBe("B+");
    const sameYearless = [
      { series: "CX", subseries: "2013 (Green Label)", variant: "", wattages: [750], tier: "C-", limited: false },
      { series: "CX", subseries: "2023 (Black Label)", variant: "", wattages: [750], tier: "C", limited: false },
      { series: "CX", subseries: "2016", variant: "", wattages: [750], tier: "B", limited: false },
    ];
    expect(matchPsuTier("Corsair CX750 750W", 750, sameYearless)).toMatchObject({ tier: "C-", best: "B" });
    expect(matchPsuTier("Corsair CX750 750W", 750, sameYearless.slice(0, 2))).toMatchObject({ tier: "C-", best: "C" });
  });

  const row = (series: string, subseries: string, variant: string, wattages: number[], tier: string) => ({
    series,
    subseries,
    variant,
    wattages,
    tier,
    limited: false,
  });

  test("un rango de potencias cubre las de por medio", () => {
    expect(parseWattages("550-850W")).toEqual([550, 600, 650, 700, 750, 800, 850]);
    expect(parseWattages("650/750/850W")).toEqual([650, 750, 850]);
  });

  test("la abreviatura entre paréntesis vale por el nombre, y las palabras descriptivas no se exigen", () => {
    const antec = [
      row("Cuprum Strike (CSK)", "", "Bronze", [550], "E"),
      row("High Current Gamer (HCG)", "", "Pro Platinum ATX 3.1", [1000], "A"),
      row("GSK ATX 3.1", "", "V2", [850], "B"),
    ];
    expect(matchPsuTier("Antec CSK550 550W 80 Plus Bronze", 550, antec)?.tier).toBe("E");
    expect(matchPsuTier("Antec HCG1000 PRO Platinum 1000W", 1000, antec)?.tier).toBe("A");
    expect(matchPsuTier("Antec GSK850 V2 850W 80 Plus Gold", 850, antec)?.tier).toBe("B");
  });

  test("80 Plus no es la variante Plus, y GF no calza con GF1 si hay una fila de GF1", () => {
    const tt = [
      row("Toughpower", "GF", "Plus", [750], "A"),
      row("Toughpower", "GF A3", "Global (FAGK-H)", [750], "B"),
      row("Toughpower", "GF1", "Snow", [750], "A+"),
      row("Toughpower", "GF1", "", [750], "A+"),
    ];
    expect(matchPsuTier("Thermaltake Toughpower GF A3 750W 80 Plus Gold", 750, tt)?.tier).toBe("B");
    expect(matchPsuTier("Thermaltake Toughpower GF1 750W 80 Plus Gold", 750, tt)?.tier).toBe("A+");
  });

  test("una serie de una letra calza si va pegada a la potencia", () => {
    const nzxt = [row("C Series", "Gold", "ATX 3.1 (2024)", [850], "A+")];
    expect(matchPsuTier("NZXT C850 Gold ATX 3.1 850W", 850, nzxt)?.tier).toBe("A+");
    expect(matchPsuTier("NZXT 850W Gold Modular", 850, nzxt)).toBeNull();
  });

  test("sin serie en el nombre o sin la potencia en la fila no hay vínculo", () => {
    expect(matchPsuTier("MSI MPG A850G 850W", 850, of("msi"))).toBeNull();
    expect(matchPsuTier("MSI MAG A1000GL 1000W", 1000, of("msi"))).toBeNull();
  });

  test("la potencia sale del nombre si no viene en los datos", () => {
    expect(matchPsuTier("1st Player ACK 650W Bronze", null, of("1stplayer"))?.tier).toBe("C-");
  });
});

describe("nota base por marca", () => {
  test("es el rango donde cae la mitad central de sus notas; con menos de 3 no hay", () => {
    expect(brandBase(["A", "B", "B", "C", "E", "F"])).toEqual({ tier: "E", best: "B" });
    expect(brandBase(["B", "C"])).toBeNull();
  });

  test("se usa sólo cuando ningún modelo calza, y siempre especulativa", () => {
    const rows = [
      { series: "Focus", subseries: "GX", variant: "", wattages: [850], tier: "A", limited: false },
      { series: BRAND_BASE, subseries: "", variant: "", wattages: [], tier: "C", best: "A", limited: true },
    ];
    expect(matchPsuTier("Seasonic Focus GX-850 850W", 850, rows)).toEqual({ tier: "A", best: "A", limited: false });
    expect(matchPsuTier("Seasonic B12 BC-650 650W", 650, rows)).toEqual({ tier: "C", best: "A", limited: true });
    expect(matchPsuTier("Seasonic sin potencia", null, rows)).toEqual({ tier: "C", best: "A", limited: true });
  });
});

describe("regla psu_tier", () => {
  const psu = (tier: string, limited = false, best = tier): Part => ({
    itemId: 1,
    name: "Fuente",
    category: "psu",
    quantity: 1,
    facts: { wattage: 1000, psu_tier: { tier, best, limited } },
  });
  const gpu = (tdp: number): Part => ({ itemId: 2, name: "GPU", category: "gpu", quantity: 1, facts: { tdp_w: tdp } });
  const tierCheck = (parts: Part[]) => checkCompatibility(parts).checks.find((c) => c.rule === "psu_tier");

  test.each([
    ["A", 360, "ok"],
    ["B+", 360, "warning"],
    ["B", 250, "ok"],
    ["C", 250, "warning"],
    ["C", 115, "ok"],
    ["E", 115, "warning"],
    ["F", 115, "warning"],
  ] as const)("tier %s con una GPU de %i W: %s", (tier, tdp, result) => {
    expect(tierCheck([psu(tier), gpu(tdp)])?.result).toBe(result);
  });

  test("con un rango de notas sólo decide si todo el rango da la misma respuesta", () => {
    expect(tierCheck([psu("C", false, "B"), gpu(250)])).toBeUndefined();
    expect(tierCheck([psu("C", false, "B"), gpu(115)])?.result).toBe("ok");
    expect(tierCheck([psu("C", false, "B"), gpu(360)])?.result).toBe("warning");
    expect(tierCheck([psu("F", false, "E"), gpu(115)])?.message).toMatch(/mala calidad/);
  });

  test("sin GPU basta una fuente de nivel D", () => {
    expect(tierCheck([psu("D")])?.result).toBe("ok");
  });

  test("una nota especulativa sólo advierte si todo su rango es E o F; sin vínculo no hay chequeo", () => {
    expect(tierCheck([psu("F", true), gpu(360)])?.message).toMatch(/no es segura/);
    expect(tierCheck([psu("E", true), gpu(115)])?.message).toMatch(/poca información/);
    expect(tierCheck([psu("E", true, "C"), gpu(115)])).toBeUndefined();
    expect(tierCheck([psu("C", true), gpu(360)])).toBeUndefined();
    expect(tierCheck([{ ...psu("A"), facts: { wattage: 1000 } }, gpu(360)])).toBeUndefined();
  });

  test("los mensajes no muestran el tier", () => {
    for (const t of ["A", "B", "C", "E", "F"]) expect(tierCheck([psu(t), gpu(360)])?.message).not.toMatch(/tier/i);
  });
});
