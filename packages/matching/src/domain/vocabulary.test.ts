import { describe, expect, test } from "bun:test";
import type { IdentitySource } from "@framerate/contracts";
import { anchorIdentity } from "./anchor";
import { canonicalText, canonicalValues } from "./vocabulary";

const same = (category: string, brand: string, field: string, values: string[]) =>
  new Set(values.map((v) => canonicalText(category, brand, field, v)));

describe("vocabulario canónico", () => {
  test("se juntan las formas del mismo producto (medidas en producción)", () => {
    expect(same("gpu", "ASUS", "line", ["tuf gaming", "tuf", "tuf gaming oc"])).toEqual(new Set(["tuf"]));
    expect(canonicalText("gpu", "ASUS", "line", "tuf gaming evo")).toBe("tuf evo");
    expect(canonicalText("gpu", "ASUS", "line", "strix")).toBe("rog strix");
    expect(same("gpu", "Zotac", "line", ["gaming twin edge", "twin edge"])).toEqual(new Set(["twin edge"]));
    expect(same("ssd", "Kingston", "line", ["ssdnow a400", "a400"])).toEqual(new Set(["a400"]));
    expect(same("ssd", "Kingston", "line", ["fury renegade", "renegade"])).toEqual(new Set(["renegade"]));
    expect(same("ssd", "Kingston", "line", ["fury renegade g5", "renegade g5"])).toEqual(new Set(["renegade g5"]));
    expect(same("ssd", "Kingston", "line", ["snv3", "nv3"])).toEqual(new Set(["nv3"]));
    expect(same("ssd", "ADATA", "line", ["ultimate su650", "su650"])).toEqual(new Set(["su650"]));
    expect(same("ssd", "Western Digital", "line", ["wd green", "green"])).toEqual(new Set(["green"]));
    expect(same("ram", "Corsair", "line", ["lpx", "vengeance lpx"])).toEqual(new Set(["vengeance lpx"]));
    expect(same("ram", "ADATA", "line", ["d35", "gammix d35"])).toEqual(new Set(["gammix d35"]));
    expect(same("psu", "ASUS", "line", ["tuf gaming", "tuf"])).toEqual(new Set(["tuf"]));
    expect(same("psu", "Corsair", "line", ["cv series", "cv"])).toEqual(new Set(["cv"]));
    expect(same("motherboard", "ASRock", "line", ["phantom gaming", "pg"])).toEqual(new Set(["pg"]));
    expect(same("motherboard", "ASRock", "line", ["riptide", "pg riptide"])).toEqual(new Set(["pg riptide"]));
    expect(
      same("cpu_cooler", "Cooler Master", "model", ["masterliquid 240l core", "ml240l core", "240l core"]),
    ).toEqual(new Set(["masterliquid 240l core"]));
    expect(
      same("cpu_cooler", "Cooler Master", "model", [
        "masterliquid core nex 360",
        "masterliquid core nex series 360",
        "ml core nex 360",
        "core nex 360",
      ]),
    ).toEqual(new Set(["masterliquid core nex 360"]));
    expect(same("cpu_cooler", "MSI", "model", ["mag coreliquid a13 240", "a13 240"])).toEqual(
      new Set(["coreliquid a13 240"]),
    );
  });

  test("no se juntan los que son otro producto", () => {
    const distinct = (category: string, brand: string, field: string, values: string[]) =>
      expect(same(category, brand, field, values).size).toBe(values.length);
    distinct("gpu", "MSI", "line", ["gaming", "gaming x", "gaming x trio", "gaming trio", "gaming x slim"]);
    distinct("gpu", "MSI", "line", ["shadow", "shadow 2x", "shadow 3x"]);
    distinct("gpu", "ASUS", "line", ["rog strix", "rog strix v2", "dual", "dual evo"]);
    distinct("gpu", "Gigabyte", "line", ["gaming", "eagle", "eagle ice", "aorus", "aorus elite"]);
    distinct("ram", "ADATA", "line", ["lancer", "lancer blade", "spectrix d35", "spectrix d35g", "gammix d35"]);
    distinct("ssd", "ADATA", "line", ["legend 800", "legend 860", "legend 960", "legend 960 max", "legend"]);
    distinct("ssd", "Kingston", "line", ["renegade", "renegade g5", "fury"]);
    distinct("cpu_cooler", "Cooler Master", "model", ["masterliquid 240 core", "masterliquid 240l core"]);
  });

  test("sólo el texto libre, y nunca lo deja vacío", () => {
    // El modelo de una placa es un código: veta y no se toca.
    expect(canonicalText("motherboard", "ASUS", "model", "tuf gaming b850m plus")).toBe("tuf gaming b850m plus");
    // "ZOTAC GAMING" a secas no dice la línea, pero borrarla cambiaría la clave: queda lo que dijo Haiku.
    expect(canonicalText("gpu", "Zotac", "line", "gaming")).toBe("gaming");
    // Sin marca, sólo las reglas de la categoría.
    expect(canonicalText("gpu", null, "line", "gaming oc")).toBe("gaming");
    expect(canonicalValues("gpu", "ASUS")).toContain("tuf");
    expect(canonicalValues("gpu", null)).toEqual([]);
  });
});

const raw = (category: IdentitySource["category"], identity: IdentitySource["identity"]): IdentitySource => ({
  category,
  brand: "",
  name: "producto de prueba",
  mpn: "",
  confidence: "high",
  identity,
  identity_from_mpn: [],
  identity_from_knowledge: [],
});

describe("identidad canónica al anclar", () => {
  test("la forma canónica que copia Haiku se ancla con el alias del título", () => {
    const r = anchorIdentity(raw("ram", { line: "Vengeance LPX", capacity_gb: 16 }), {
      category: "ram",
      title: "Memoria Corsair LPX 16GB DDR4 3200",
      brand: "Corsair",
    });
    expect(r.identity.line).toBe("vengeance lpx");
    const cooler = anchorIdentity(raw("cpu_cooler", { model: "MasterLiquid 240L Core" }), {
      category: "cpu_cooler",
      title: "Refrigeración Líquida Cooler Master ML240L Core ARGB",
      brand: "Cooler Master",
    });
    expect(cooler.identity.model).toBe("masterliquid 240l core");
  });

  test("lo que la línea canónica suelta tampoco queda en el modelo", () => {
    const r = anchorIdentity(raw("motherboard", { line: "TUF Gaming", model: "TUF GAMING B850M-PLUS WIFI" }), {
      category: "motherboard",
      title: "Placa Madre ASUS TUF GAMING B850M-PLUS WIFI",
      brand: "ASUS",
    });
    expect(r.identity.line).toBe("tuf");
    expect(r.identity.model).toBe("b850m plus");
  });
});
