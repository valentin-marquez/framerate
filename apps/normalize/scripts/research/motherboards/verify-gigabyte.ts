// Comprueba en Wayback (CDX) la URL adivinada de cada placa Gigabyte y guarda la última captura con 200.
const S = process.argv[2];
const plan: { brand: string; url: string | null; name: string }[] = await Bun.file(`${S}/plan-full.json`).json();
const guesses = plan.filter((p) => p.brand === "gigabyte" && p.url);
const out: Record<string, { ts: string; url: string } | null> = {};
let i = 0;
const statuses: Record<number, number> = {};
async function worker() {
  while (i < guesses.length) {
    const g = guesses[i++];
    if (!g?.url) continue;
    const base = g.url.replace(/^https?:\/\/www\./, "").replace(/-rev-10\/sp$/, "");
    try {
      let good: string[] | undefined;
      for (const rev of ["rev-10", "rev-11", "rev-1x", "rev-12", "rev-20", "rev-2x"]) {
        const r = await fetch(
          `https://web.archive.org/cdx/search/cdx?url=${base}-${rev}/sp&output=json&fl=original,timestamp,length&filter=statuscode:200&limit=-4`,
          { signal: AbortSignal.timeout(60_000) },
        );
        if (!r.ok) {
          statuses[r.status] = (statuses[r.status] ?? 0) + 1;
          if (r.status === 429) await Bun.sleep(5000);
        }
        const rows: string[][] = r.ok ? await r.json().catch(() => []) : [];
        good = rows
          .slice(1)
          .filter((x) => Number(x[2]) > 8000)
          .at(-1);
        if (good) break;
      }
      out[g.name] = good ? { ts: good[1], url: good[0] } : null;
    } catch {
      out[g.name] = null;
    }
  }
}
await Promise.all(Array.from({ length: 1 }, worker));
console.log("estados no-200:", JSON.stringify(statuses));
await Bun.write(`${S}/gigabyte-verified.json`, JSON.stringify(out, null, 1));
const ok = Object.values(out).filter(Boolean).length;
console.log(`gigabyte: ${ok}/${guesses.length} con ficha archivada`);
for (const [n, v] of Object.entries(out)) if (!v) console.log("sin captura:", n);
