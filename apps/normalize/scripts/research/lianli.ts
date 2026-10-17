let raw = JSON.parse(await Bun.file(".wrangler/dataset/lianli.raw.json").text());
if (typeof raw === "string") raw = JSON.parse(raw);
const catalog: string[] = (await Bun.file(".wrangler/dataset/fans-a.models.json").json())["Lian Li"];
const nums = (s = "") => [...s.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
const KEYS = ["sl", "tl", "cl", "al", "p28", "st120", "v2", "wireless", "lcd", "reverse", "infinity"];
const tokens = (s: string) => {
  const t = s
    .toLowerCase()
    .replace(/uni fan|lian li/g, " ")
    .replace(/\binf(?=\d|\b)/g, " infinity ")
    .replace(/\brsl/g, " reverse sl ")
    .replace(/(sl|tl|cl|al)(\d{3})/g, "$1 $2 ")
    .replace(/v2/g, " v2 ")
    .replace(/reverso/g, "reverse");
  return new Set(t.split(/[^a-z0-9]+/).filter((w) => KEYS.includes(w)));
};
const rows: any[] = [];
for (const page of raw) {
  if (!page.rows?.length) continue;
  const blocks: string[][][] = [];
  let cur: string[][] = [];
  for (const r of page.rows) {
    if (/^(MODEL NAME|PRODUCT NAME)$/i.test(r[0]) && cur.some((x) => /^(MODEL NAME|PRODUCT NAME)$/i.test(x[0]))) {
      blocks.push(cur);
      cur = [];
    }
    cur.push(r);
  }
  blocks.push(cur);
  for (const b of blocks) {
    const get = (re: RegExp) => b.find((r) => re.test(r[0]))?.slice(1) ?? [];
    let names = get(/^(MODEL NAME|PRODUCT NAME)$/i);
    if (!names.length) names = [page.title.split(" - ")[0]];
    const p28 = /p28/i.test(page.slug);
    names.forEach((name, i) => {
      const at = (vals: string[]) => (p28 ? vals.at(-1) : vals.length === names.length ? vals[i] : vals[0]) ?? "";
      const speed = nums(at(get(/^FAN SPEED/i))).filter((n) => n >= 100 && Number.isInteger(n) && n <= 5000);
      const dim = nums(name).find((n) => n === 120 || n === 140) ?? nums(at(get(/^FAN DIMENSION/i)))[0] ?? 120;
      const size = dim <= 130 ? 120 : 140;
      const wireless = /wireless/i.test(name);
      rows.push({
        brand: "Lian Li",
        family: name
          .replace(/^LIAN LI\s+/i, "")
          .replace(/(SL|TL|AL)(120|140)/i, "$1")
          .replace(/\b(120|140)\b/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
        size_mm: size,
        rpm_min: speed.length > 1 ? speed[0] : null,
        rpm_max: speed.at(-1) ?? null,
        airflow_cfm: nums(at(get(/AIR ?FLOW/i)))[0] ?? null,
        static_pressure_mmh2o: nums(at(get(/PRESSURE/i)))[0] ?? null,
        noise_dba: Math.max(0, ...nums(at(get(/NOISE/i)))) || null,
        bearing: /fluid dynamic|fdb/i.test(at(get(/BEARING/i))) ? "fdb" : at(get(/BEARING/i)) || null,
        fan_connector: wireless ? "proprietary" : "4pin_pwm",
        lighting: /st120/i.test(name) ? "argb_5v" : wireless ? "proprietary" : "argb_5v",
        controller: wireless ? "Receptor inalámbrico L-Wireless" : "L-Connect 3 (viene con los packs de 3)",
        requires_controller: wireless,
        daisy_chain: !/st120/i.test(name),
        warranty_years: nums(at(get(/WARRANTY/i)))[0] ?? null,
        source_url: page.url,
      });
    });
  }
}
// Cada nombre del catálogo a la familia con el mismo conjunto de palabras que distinguen.
for (const name of catalog) {
  const n = tokens(name);
  const size = /\b140\b/.test(name) ? 140 : 120;
  const fam = rows.filter((r) => {
    const f = tokens(r.family);
    return f.size === n.size && [...f].every((w) => n.has(w));
  });
  const hit = fam.find((r) => r.size_mm === size) ?? fam[0];
  if (hit) {
    hit.catalog_models ??= [];
    hit.catalog_models.push(name);
  } else console.error("sin familia:", name, [...n]);
}
await Bun.write(".wrangler/dataset/fans-a.json", JSON.stringify(rows, null, 1));
for (const r of rows)
  console.log(
    `${r.family} ${r.size_mm}: ${r.rpm_min}-${r.rpm_max} rpm ${r.airflow_cfm} cfm ${r.static_pressure_mmh2o} mmH2O ${r.noise_dba} dBA ${r.bearing} gar=${r.warranty_years} ← ${(r.catalog_models ?? []).join(", ")}`,
  );
