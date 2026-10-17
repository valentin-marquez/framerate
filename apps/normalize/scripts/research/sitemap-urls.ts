// Junta las URLs de producto de los sitemaps de cada marca (expande los índices) y las guarda por marca.
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";
const SITES: Record<string, string[]> = {
  "Cooler Master": ["https://www.coolermaster.com/sitemap_index.xml"],
  Thermaltake: ["https://www.thermaltake.com/sitemap.xml"],
  Cougar: ["https://cougargaming.com/sitemap.xml"],
  Antec: ["https://www.antec.com/sitemap.xml"],
  Thermalright: ["https://www.thermalright.com/sitemap.xml"],
  GameMax: ["https://www.gamemaxpc.com/sitemap.xml"],
  Xigmatek: ["https://www.xigmatek.com/sitemap.xml"],
  Noctua: ["https://noctua.at/sitemap.xml"],
  NZXT: ["https://www.nzxt.com/sitemap.xml"],
  Montech: ["https://www.montechpc.com/sitemap.xml"],
};
const get = async (u: string) => {
  const r = await fetch(u.replace(/&amp;/g, "&"), {
    headers: { "user-agent": UA },
    signal: AbortSignal.timeout(20000),
  });
  return r.ok ? r.text() : "";
};
const out: Record<string, string[]> = {};
await Promise.all(
  Object.entries(SITES).map(async ([brand, roots]) => {
    const seen = new Set<string>();
    const urls = new Set<string>();
    const queue = [...roots];
    while (queue.length && seen.size < 60) {
      const u = queue.shift()!;
      if (seen.has(u)) continue;
      seen.add(u);
      const xml = await get(u).catch(() => "");
      for (const [, loc] of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
        const l = loc.replace(/&amp;/g, "&");
        if (/\.xml(\?|$)/.test(l)) {
          if (/product|post-type|sitemap_\d|sitemap\.xml|posts-product|product-sitemap/i.test(l) || roots.includes(u))
            queue.push(l);
        } else if (!/\.(jpg|png|webp|pdf)$/i.test(l)) urls.add(l);
      }
    }
    // Sólo las de producto y en inglés cuando hay idiomas.
    out[brand] = [...urls]
      .filter((l) => /product|\/p\/|catalog|\/case|cooler|\/en\//i.test(l))
      .filter(
        (l) => !/\/(de|fr|es|it|ja|ko|zh|ru|pt|tw|cn|jp|kr)(-[a-z]{2})?\//i.test(l) || /\/en(-[a-z]+)?\//.test(l),
      );
    console.log(
      brand,
      `${seen.size} sitemaps, ${urls.size} urls, ${out[brand].length} de producto`,
      out[brand].slice(0, 2).join(" "),
    );
  }),
);
await Bun.write(".wrangler/dataset/sitemap-urls.json", JSON.stringify(out, null, 1));
