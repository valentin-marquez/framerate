// Asigna cada modelo con stock del catálogo a la URL de producto de su marca: todas las palabras del modelo en el slug.
const urls: Record<string, string[]> = await Bun.file(".wrangler/dataset/sitemap-urls.json").json();
const toks = (s: string) =>
  s
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .split(/[^a-z0-9]+/)
    .filter(
      (w) =>
        w &&
        ![
          "the",
          "and",
          "de",
          "con",
          "pc",
          "case",
          "gabinete",
          "cooler",
          "cpu",
          "black",
          "white",
          "negro",
          "blanco",
          "edition",
        ].includes(w),
    );
const slug = (u: string) =>
  decodeURIComponent(new URL(u).pathname)
    .replace(/\.html?$/, "")
    .split("/")
    .filter(Boolean)
    .slice(-2)
    .join(" ");
const preferEn = (u: string) => (/\/(en|en-global|us)\//.test(u) ? 0 : 1);
const plan: { category: string; brand: string; model: string; url: string }[] = [];
const stats: Record<string, string> = {};
for (const category of ["cpu_cooler", "case"]) {
  const rows = (await Bun.file(`.wrangler/dataset/${category}-models.json`).json())[0].results.filter(
    (r: any) => r.stock === 1 && r.m && urls[r.brand],
  );
  for (const brand of new Set(rows.map((r: any) => r.brand as string))) {
    const cands = urls[brand]!.map((u) => ({ u, t: new Set(toks(slug(u))), len: slug(u).length }));
    let hit = 0,
      total = 0;
    for (const r of rows.filter((x: any) => x.brand === brand)) {
      total++;
      const mt = toks(r.m);
      const ok = cands.filter(
        (c) =>
          mt.length > 0 &&
          mt.every((w) => c.t.has(w) || [...c.t].some((t) => t.replace(/[^a-z0-9]/g, "") === mt.join(""))),
      );
      const best = ok.sort((a, b) => preferEn(a.u) - preferEn(b.u) || a.len - b.len)[0];
      if (best) {
        hit++;
        plan.push({ category, brand, model: r.m, url: best.u });
      }
    }
    stats[`${category} ${brand}`] = `${hit}/${total}`;
  }
}
await Bun.write(".wrangler/dataset/scrape-plan.json", JSON.stringify(plan, null, 1));
console.log(
  Object.entries(stats)
    .map(([k, v]) => `${k}=${v}`)
    .join("  "),
);
console.log(`${plan.length} fichas a bajar, ${new Set(plan.map((p) => p.url)).size} URLs distintas`);
console.log(
  plan
    .slice(0, 8)
    .map((p) => `${p.brand} ${p.model} → ${p.url}`)
    .join("\n"),
);
