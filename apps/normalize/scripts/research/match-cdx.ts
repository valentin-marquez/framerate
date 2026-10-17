const urls: Record<string, string[]> = await Bun.file(".wrangler/dataset/cdx-urls.json").json();
const missing: Record<string, Record<string, string[]>> = await Bun.file(".wrangler/dataset/missing.json").json();
const STOP = [
  "the",
  "and",
  "pc",
  "case",
  "gabinete",
  "cooler",
  "cpu",
  "black",
  "white",
  "edition",
  "liquid",
  "aio",
  "en",
  "us",
  "global",
  "products",
  "product",
  "p",
];
const toks = (s: string) =>
  s
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.includes(w));
const isEn = (u: string) => !/\/(de|fr|es|it|ja|ko|zh|ru|pt|tw|cn|jp|kr|pl|nl|tr|uk|cz|hu)(-[a-z]{2})?\//i.test(u);
const plan: any[] = [];
const stats: string[] = [];
for (const [brand, cats] of Object.entries(missing)) {
  if (!urls[brand]) continue;
  const cands = urls[brand]?.filter(isEn).map((u) => ({
    u,
    t: new Set(
      toks(
        (() => {
          try {
            return decodeURIComponent(new URL(u).pathname);
          } catch {
            return u;
          }
        })(),
      ),
    ),
  }));
  for (const [category, models] of Object.entries(cats)) {
    let hit = 0;
    for (const m of models) {
      const mt = toks(m);
      if (!mt.length) continue;
      const ok = cands
        .filter((c) => mt.every((w) => c.t.has(w)))
        .sort((a, b) => a.t.size - b.t.size || a.u.length - b.u.length)[0];
      if (ok) {
        hit++;
        plan.push({ category, brand, model: m, url: ok.u });
      }
    }
    stats.push(`${brand}|${category}=${hit}/${models.length}`);
  }
}
const prev = (await Bun.file(".wrangler/dataset/browser-plan.json").json()) as any[];
const seen = new Set(plan.map((p) => `${p.category}|${p.brand}|${p.model}`));
for (const p of prev) if (!seen.has(`${p.category}|${p.brand}|${p.model}`)) plan.push(p);
await Bun.write(".wrangler/dataset/wayback-plan.json", JSON.stringify(plan, null, 1));
console.log(stats.join("  "));
console.log(plan.length, "fichas,", new Set(plan.map((p) => p.url)).size, "URLs");
