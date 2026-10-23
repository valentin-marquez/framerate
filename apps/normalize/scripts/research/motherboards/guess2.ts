// Segunda pasada para las placas sin URL: adivina la URL por el nombre y la verifica (ASUS por odinapi, ROG directo, MSI por CDX).
const S = process.argv[2];
const plan: any[] = await Bun.file(`${S}/plan-full.json`).json();
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";
const clean = (name: string) =>
  name
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(mATX|Micro ATX|ATX|AM5|AM4|LGA1700|LGA1851|DDR5|DDR4|motherboard)\b/gi, " ")
    .replace(/Wi-?Fi/gi, "WIFI")
    .replace(/R2\.0/gi, "R2")
    .trim();
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const results: Record<number, { url: string; via: string }> = {};
let i = 0;
async function worker() {
  while (i < plan.length) {
    const p = plan[i++];
    if (p.url || !["asus", "msi"].includes(p.brand)) continue;
    const name = clean(p.name.replace(/^(ASUS|MSI)\s+/i, ""));
    try {
      if (p.brand === "asus" && /^ROG/i.test(name)) {
        const series = /crosshair/i.test(name) ? "rog-crosshair" : /maximus/i.test(name) ? "rog-maximus" : "rog-strix";
        const u = `https://rog.asus.com/motherboards/${series}/${slug(name)}/spec/`;
        const r = await fetch(u, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(40_000) });
        const t = r.ok ? await r.text() : "";
        if (/x DIMM/i.test(t)) results[p.product_id] = { url: u, via: "rog-direct" };
      } else if (p.brand === "asus") {
        const sl = slug(name);
        const u = `https://odinapi.asus.com/recent-data/apiv2/PDTechSpec?SystemCode=asus&WebSiteCode=global&ProductWebPath=${sl}&siteID=www&sitelang=`;
        const r = await fetch(u, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(40_000) });
        const j: any = r.ok ? await r.json() : null;
        if (j?.Result?.SpecList?.length)
          results[p.product_id] = {
            url: `https://www.asus.com/motherboards-components/motherboards/all-series/${sl}/techspec/`,
            via: "asus-json",
          };
      } else if (p.brand === "msi") {
        const sl = clean(p.name.replace(/^MSI\s+/i, ""))
          .replace(/\s+/g, "-")
          .toUpperCase()
          .replace(/WIFI6E/g, "WIFI6E");
        const u = `msi.com/Motherboard/${sl}/Specification`;
        const r = await fetch(
          `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(u)}&output=json&fl=original,timestamp,length&filter=statuscode:200&limit=-3`,
          { signal: AbortSignal.timeout(60_000) },
        );
        const rows: string[][] = r.ok ? await r.json().catch(() => []) : [];
        const good = rows
          .slice(1)
          .filter((x) => Number(x[2]) > 4000)
          .at(-1);
        if (good) results[p.product_id] = { url: good[0], via: "wayback" };
      }
    } catch {}
  }
}
await Promise.all(Array.from({ length: 2 }, worker));
let n = 0;
for (const p of plan)
  if (!p.url && results[p.product_id]) {
    Object.assign(p, results[p.product_id]);
    n++;
  }
await Bun.write(`${S}/plan-full.json`, JSON.stringify(plan, null, 1));
console.log(`segunda pasada: ${n} placas más con URL`);
for (const p of plan) if (results[p.product_id]) console.log("+", p.name, "->", results[p.product_id].url);
console.log("--- siguen sin URL");
for (const p of plan) if (!p.url && p.brand !== "asrock") console.log(`${p.brand}\t${p.con_stock}\t${p.name}`);
