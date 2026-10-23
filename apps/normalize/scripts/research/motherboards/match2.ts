// Emparejamiento estricto: los tokens del modelo (sin ruido) tienen que ser los mismos en el nombre y en la URL.
const S = process.argv[2];
type Row = {
  brand: string;
  model: string | null;
  chipset: string | null;
  name: string;
  product_id: number;
  ofertas: number;
  con_stock: number;
};
const rows: Row[] = await Bun.file(`${S}/catalog-boards.json`).json();
const load = async (f: string) =>
  (await Bun.file(`${S}/${f}`).exists())
    ? ((await Bun.file(`${S}/${f}`).json()) as string[][]).slice(1).map((r) => r[0])
    : [];
const asus = await load("cdx-asus.json"),
  rog = await load("cdx-rog.json"),
  msi = await load("cdx-msi.json");
const NOISE = new Set([
  "atx",
  "matx",
  "micro",
  "mini",
  "itx",
  "e",
  "am4",
  "am5",
  "lga1700",
  "lga1851",
  "lga1200",
  "ddr4",
  "ddr5",
  "pcie",
  "m.2",
  "m2",
  "amd",
  "intel",
  "socket",
  "placa",
  "madre",
  "motherboard",
  "mb",
  "4.0",
  "3.0",
  "5.0",
  "ryzen",
  "core",
  "con",
  "para",
  "gen",
  "14va",
  "13va",
  "12va",
  "y",
  "asus",
  "msi",
  "gigabyte",
  "all",
  "series",
  "csm",
  "motherboards",
  "components",
  "spec",
  "techspec",
  "specification",
]);
const SYN: Record<string, string> = {
  wi: "wifi",
  fi: "",
  "wi-fi": "wifi",
  wifi6e: "wifi6e",
  "r2.0": "r2",
  r2: "r2",
  ii: "ii",
};
const norm = (t: string) => SYN[t] ?? t;
const toks = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/\(.*?\)/g, " ")
      .replace(/wi-fi|wi fi/g, "wifi")
      .replace(/c\.s\.m\./g, "csm")
      .split(/[^a-z0-9.]+/)
      .map(norm)
      .filter((t) => t && !NOISE.has(t) && !/^\d{3}-/.test(t)),
  );
const eq = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((t) => b.has(t));
const slugOf = (u: string) =>
  u
    .replace(/\/(techspec|spec|Specification)\/?$/i, "")
    .split("/")
    .pop() ?? "";
const out: any[] = [];
for (const r of rows) {
  const nt = toks(r.name);
  // El catálogo a veces escribe "TUF B650M-PLUS" por "TUF GAMING B650M-PLUS".
  if (nt.has("tuf") && !nt.has("gaming")) nt.add("gaming");
  let url: string | null = null,
    via = "none";
  const tryList = (list: string[], v: string) => {
    for (const u of list)
      if (eq(nt, toks(slugOf(u).replace(/-/g, " ")))) {
        url = u;
        via = v;
        return true;
      }
    return false;
  };
  if (r.brand === "asus") tryList(asus, "asus-json") || tryList(rog, "wayback");
  else if (r.brand === "msi") tryList(msi, "wayback");
  else if (r.brand === "gigabyte") {
    url = `https://www.gigabyte.com/Motherboard/${[...nt].map((t) => t.toUpperCase()).join("-")}-rev-10/sp`;
    via = "wayback-guess";
  }
  out.push({
    brand: r.brand,
    product_id: r.product_id,
    name: r.name,
    model: r.model,
    chipset: r.chipset,
    con_stock: r.con_stock,
    url,
    via,
  });
}
await Bun.write(`${S}/plan-full.json`, JSON.stringify(out, null, 1));
for (const b of ["asus", "msi", "gigabyte"]) {
  const l = out.filter((o) => o.brand === b);
  console.log(`${b}: ${l.length} productos, con URL ${l.filter((o) => o.url).length}`);
}
console.log("--- sin URL");
for (const o of out.filter((o) => !o.url && o.brand !== "asrock")) console.log(`${o.brand}\t${o.con_stock}\t${o.name}`);
