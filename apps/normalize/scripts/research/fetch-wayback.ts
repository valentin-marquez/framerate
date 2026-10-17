// Baja de Wayback la última copia archivada de cada ficha (id_: el HTML original, sin la barra de Wayback).
const plan: any[] = await Bun.file(".wrangler/dataset/wayback-plan.json").json();
const urls = [...new Set(plan.map((p) => p.url as string))];
const strip = (h: string) =>
  h
    .replace(
      /<script(?![^>]*application\/(ld\+)?json)[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi,
      " ",
    )
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d|dt|dd|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
const variants = (u: string) =>
  /msi\.com/i.test(u) ? [`${u}/Specification`, u] : /asus\.com/i.test(u) ? [`${u}/techspec`, u] : [u];
const specScore = (t: string) =>
  (t.match(/\d{2,3}(\.\d)?\s*mm/gi) ?? []).length +
  (t.match(/socket|lga|am5|radiator|vga|graphics card|cpu cooler|clearance/gi) ?? []).length;
const name = (u: string) =>
  `${u
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .slice(0, 150)}.txt`;
const idx: Record<string, string> = {};
const stats = { ok: 0, poor: 0, fail: 0 };
let i = 0;
async function worker() {
  while (i < urls.length) {
    const u = urls[i++]!;
    let best = { text: "", score: 0, from: "" };
    for (const v of variants(u)) {
      try {
        const r = await fetch(`https://web.archive.org/web/2026id_/${v}`, {
          signal: AbortSignal.timeout(45000),
          redirect: "follow",
        });
        if (!r.ok) continue;
        const text = strip(await r.text());
        const score = specScore(text);
        if (score > best.score) best = { text, score, from: v };
        if (score >= 8) break;
      } catch {}
      await Bun.sleep(400);
    }
    if (!best.text) {
      stats.fail++;
      continue;
    }
    stats[best.score >= 4 ? "ok" : "poor"]++;
    await Bun.write(
      `.wrangler/dataset/pages/${name(u)}`,
      `URL: ${u}\nCOPIA: Wayback Machine (${best.from})\n\n${best.text.slice(0, 40000)}`,
    );
    idx[u] = name(u);
  }
}
const t0 = performance.now();
await Promise.all(Array.from({ length: 4 }, worker));
const input = plan
  .filter((p) => idx[p.url])
  .map((p) => ({ ...p, page: `/mnt/datos/dev/framerate/.wrangler/dataset/pages/${idx[p.url]}` }));
await Bun.write(".wrangler/dataset/wayback-input.json", JSON.stringify(input, null, 1));
console.log(
  `${urls.length} URLs en ${Math.round((performance.now() - t0) / 1000)} s:`,
  stats,
  `${input.length} fichas listas para extraer`,
);
