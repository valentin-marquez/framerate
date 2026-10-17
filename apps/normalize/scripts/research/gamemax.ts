const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";
const CATS = {
  cpu_cooler: ["cpu-air-cooler", "cpu-liquid-cooler", "cooler"],
  case: ["x5-mid-tower", "x9-full-tower", "x1-sff-itx", "pc-case-news", "eco-range", "alpha", "mechanic"],
};
const locs = (await Bun.file(".wrangler/dataset/gamemax-sitemap.txt").text()).split("\n");
const strip = (h: string) =>
  h
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
const toks = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(
      (w) => w && !["gamemax", "case", "cooler", "pc", "the", "black", "white", "wh", "bk", "argb", "rgb"].includes(w),
    );
const models: Record<string, string[]> = {};
for (const c of ["cpu_cooler", "case"])
  models[c] = (await Bun.file(`.wrangler/dataset/${c}-models.json`).json())[0].results
    .filter((r: any) => r.brand === "GameMax" && r.stock === 1 && r.m)
    .map((r: any) => r.m as string);
const plan: any[] = [];
const idx: Record<string, string> = {};
for (const [category, cats] of Object.entries(CATS)) {
  const urls = locs.filter((l) => cats.some((c) => new RegExp(`gamemaxpc\\.com/${c}/\\d+\\.html`).test(l)));
  const pages: { url: string; title: string; text: string }[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: 10 }, async () => {
      while (i < urls.length) {
        const url = urls[i++]!;
        try {
          const h = await (
            await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000) })
          ).text();
          const title = (h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? h.match(/<title>([^<]+)/i)?.[1] ?? "")
            .replace(/<[^>]+>/g, " ")
            .trim();
          pages.push({ url, title, text: strip(h) });
        } catch {}
      }
    }),
  );
  let hit = 0;
  for (const m of models[category]!) {
    const mt = toks(m);
    if (!mt.length) continue;
    const ok = pages
      .filter((p) => {
        const t = new Set(toks(p.title));
        return mt.every((w) => t.has(w));
      })
      .sort((a, b) => a.title.length - b.title.length)[0];
    if (!ok) continue;
    hit++;
    const file = `${ok.url.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "_")}.txt`;
    await Bun.write(
      `.wrangler/dataset/pages/${file}`,
      `URL: ${ok.url}\nTÍTULO: ${ok.title}\n\n${ok.text.slice(0, 40000)}`,
    );
    idx[ok.url] = file;
    plan.push({
      category,
      brand: "GameMax",
      model: m,
      url: ok.url,
      page: `/mnt/datos/dev/framerate/.wrangler/dataset/pages/${file}`,
    });
  }
  console.log(
    category,
    `${urls.length} páginas, ${pages.length} leídas, ${hit}/${models[category]?.length} modelos calzan`,
  );
}
await Bun.write(".wrangler/dataset/extract-4.input.json", JSON.stringify(plan, null, 1));
