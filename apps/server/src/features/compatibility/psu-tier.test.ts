import { describe, expect, test } from "bun:test";
import { checkCompatibility, type Part } from "./compatibility";
import { brandKeys, matchPsuTier, parsePsuTiers } from "./psu-tier";

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

  test("el año de la variante no se exige; lo que queda empatado con letras distintas no tiene tier", () => {
    expect(matchPsuTier("Corsair RM850x 850W 80 Plus Gold", 850, of("corsair"))?.tier).toBe("A");
    expect(matchPsuTier("Corsair RM850x Shift 850W 80 Plus Gold", 850, of("corsair"))?.tier).toBe("B+");
    const sameYearless = [
      { series: "CX", subseries: "2013 (Green Label)", variant: "", wattages: [750], tier: "C-", limited: false },
      { series: "CX", subseries: "2023 (Black Label)", variant: "", wattages: [750], tier: "C", limited: false },
      { series: "CX", subseries: "2016", variant: "", wattages: [750], tier: "B", limited: false },
    ];
    expect(matchPsuTier("Corsair CX750 750W", 750, sameYearless)).toBeNull();
    expect(matchPsuTier("Corsair CX750 750W", 750, sameYearless.slice(0, 2))?.tier).toBe("C-");
  });

  test("sin serie en el nombre o sin la potencia en la fila no hay vínculo", () => {
    expect(matchPsuTier("MSI MPG A850G 850W", 850, of("msi"))).toBeNull();
    expect(matchPsuTier("MSI MAG A1000GL 1000W", 1000, of("msi"))).toBeNull();
  });

  test("la potencia sale del nombre si no viene en los datos", () => {
    expect(matchPsuTier("1st Player ACK 650W Bronze", null, of("1stplayer"))?.tier).toBe("C-");
  });
});

describe("regla psu_tier", () => {
  const psu = (tier: string, limited = false): Part => ({
    itemId: 1,
    name: "Fuente",
    category: "psu",
    quantity: 1,
    facts: { wattage: 1000, psu_tier: { tier, limited } },
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

  test("sin GPU basta una fuente de nivel D", () => {
    expect(tierCheck([psu("D")])?.result).toBe("ok");
  });

  test("un tier especulativo o sin vínculo no agrega chequeo", () => {
    expect(tierCheck([psu("F", true), gpu(360)])).toBeUndefined();
    expect(tierCheck([{ ...psu("A"), facts: { wattage: 1000 } }, gpu(360)])).toBeUndefined();
  });

  test("los mensajes no muestran el tier", () => {
    for (const t of ["A", "B", "C", "E", "F"]) expect(tierCheck([psu(t), gpu(360)])?.message).not.toMatch(/tier/i);
  });
});
