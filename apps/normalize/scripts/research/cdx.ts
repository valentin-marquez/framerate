// Lista las URLs archivadas en Wayback bajo las secciones de producto de cada marca (API CDX, sin el sitio de la marca).
const PREFIXES: Record<string, string[]> = {
  MSI: ["msi.com/PC-Case/", "msi.com/Liquid-Cooling/", "msi.com/PC-Component/", "msi.com/CPU-Cooler/"],
  ASUS: [
    "asus.com/motherboards-components/cooling/",
    "asus.com/motherboards-components/gaming-cases/",
    "rog.asus.com/cooling/",
    "rog.asus.com/cases/",
  ],
  Arctic: ["arctic.de/en/"],
  "be quiet!": ["bequiet.com/en/cpucooler/", "bequiet.com/en/case/"],
  Corsair: ["corsair.com/us/en/p/cpu-coolers/", "corsair.com/us/en/p/pc-cases/"],
  Gigabyte: ["gigabyte.com/PC-Case/", "gigabyte.com/Cooling/", "gigabyte.com/Liquid-Cooling/"],
  ADATA: ["xpg.com/en/xpg/"],
  Antec: ["antec.com/product/"],
  "Cooler Master": ["coolermaster.com/en-global/products/"],
  Deepcool: ["deepcool.com/products/"],
  "Lian Li": ["lian-li.com/product/"],
};
const out: Record<string, string[]> = {};
await Promise.all(
  Object.entries(PREFIXES).map(async ([brand, prefixes]) => {
    const urls = new Set<string>();
    for (const p of prefixes) {
      const q = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(p)}&matchType=prefix&fl=original&collapse=urlkey&filter=statuscode:200&limit=20000`;
      try {
        const t = await (await fetch(q, { signal: AbortSignal.timeout(90000) })).text();
        for (const line of t.split("\n")) {
          const u = line
            .trim()
            .replace(/^http:/, "https:")
            .replace(/[?#].*$/, "")
            .replace(/\/(Specification|Overview|Gallery|Support|Award|spec|specs)\/?$/i, "")
            .replace(/\/$/, "");
          if (u && !/\.(jpg|png|webp|pdf|css|js|svg)$/i.test(u)) urls.add(u);
        }
      } catch (e) {
        console.error(brand, p, String(e).slice(0, 60));
      }
    }
    out[brand] = [...urls];
    console.log(brand, urls.size);
  }),
);
await Bun.write(".wrangler/dataset/cdx-urls.json", JSON.stringify(out, null, 1));
