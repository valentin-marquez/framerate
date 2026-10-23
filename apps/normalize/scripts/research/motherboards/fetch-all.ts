// Baja la ficha de cada placa del plan (ASUS por odinapi, ROG directo, MSI y Gigabyte por Wayback) y guarda texto por producto.
const S = process.argv[2];
const plan: any[] = await Bun.file(`${S}/plan-full.json`).json();
const giga: Record<string, { ts: string; url: string } | null> = (await Bun.file(
  `${S}/gigabyte-verified.json`,
).exists())
  ? await Bun.file(`${S}/gigabyte-verified.json`).json()
  : {};
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";
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
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
const body = async (r: Response) => {
  const buf = new Uint8Array(await r.arrayBuffer());
  const raw = buf[0] === 0x1f && buf[1] === 0x8b ? Bun.gunzipSync(buf) : buf;
  return new TextDecoder().decode(raw);
};
const latestGood = async (url: string) => {
  const r = await fetch(
    `https://web.archive.org/cdx/search/cdx?url=${url.replace(/^https?:\/\/(www\.)?/, "")}&output=json&fl=timestamp,length&filter=statuscode:200&limit=-6`,
    { signal: AbortSignal.timeout(60_000) },
  );
  const rows: string[][] = r.ok ? await r.json().catch(() => []) : [];
  return rows
    .slice(1)
    .filter((x) => Number(x[1]) > 4000)
    .at(-1)?.[0];
};
// Sólo la tabla de specs: desde "CPU" hasta "Form Factor" (ASUS/ROG) para no mandar la navegación a Haiku.
const trimSpec = (t: string) => {
  const a = t.search(/\n\s*CPU\s*\n/);
  const b = t.search(/\n\s*Form Factor\s*\n[^\n]*\n/);
  return a >= 0 && b > a ? t.slice(a, b + 200) : t;
};
let i = 0,
  ok = 0,
  fail = 0;
async function worker() {
  while (i < plan.length) {
    const p = plan[i++];
    const file = `${S}/pages-full/${p.brand}-${p.product_id}.txt`;
    if (!p.url || (await Bun.file(file).exists())) continue;
    try {
      let text = "",
        source = p.url;
      if (p.via === "asus-json") {
        const slug = p.url
          .replace(/\/techspec\/?$/i, "")
          .split("/")
          .pop();
        const r = await fetch(
          `https://odinapi.asus.com/recent-data/apiv2/PDTechSpec?SystemCode=asus&WebSiteCode=global&ProductWebPath=${slug}&siteID=www&sitelang=`,
          { headers: { "user-agent": UA }, signal: AbortSignal.timeout(40_000) },
        );
        const j: any = await r.json();
        const list: { Title: string; Content: string }[] = j?.Result?.SpecList ?? [];
        if (!list.length) throw new Error("SpecList vacío");
        text = list.map((s) => `${s.Title}\n${strip(s.Content)}`).join("\n\n");
      } else if (p.via === "rog-direct") {
        const r = await fetch(p.url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(60_000) });
        if (!r.ok) throw new Error(`http ${r.status}`);
        text = trimSpec(strip(await r.text()));
      } else if (p.via === "wayback-guess") {
        const v = giga[p.name];
        if (!v) throw new Error("gigabyte sin captura");
        source = v.url;
        const r = await fetch(`https://web.archive.org/web/${v.ts}id_/${v.url}`, {
          headers: { "user-agent": UA },
          signal: AbortSignal.timeout(90_000),
        });
        if (!r.ok) throw new Error(`wayback ${r.status}`);
        text = strip(await body(r));
        const a = text.search(/\n\s*CPU\s*\n/);
        if (a > 0) text = text.slice(a);
        const b = text.search(/\n\s*Form Factor\s*\n[^\n]*\n/);
        if (b > 0) text = text.slice(0, b + 200);
      } else {
        const ts = await latestGood(p.url);
        if (!ts) throw new Error("sin captura buena");
        const r = await fetch(`https://web.archive.org/web/${ts}id_/${p.url}`, {
          headers: { "user-agent": UA },
          signal: AbortSignal.timeout(90_000),
        });
        if (!r.ok) throw new Error(`wayback ${r.status}`);
        text = strip(await body(r));
      }
      if (text.length < 500) throw new Error(`texto corto (${text.length})`);
      await Bun.write(
        file,
        `# brand: ${p.brand}\n# catalog_name: ${p.name}\n# product_id: ${p.product_id}\n# source_url: ${source}\n\n${text}`,
      );
      ok++;
    } catch (e) {
      fail++;
      console.log(`FALLO\t${p.brand}\t${p.name}\t${(e as Error).message}`);
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
console.log(`bajadas ${ok}, fallos ${fail}`);
