// Baja las fichas del plan en paralelo: fetch primero y Bun.WebView si la ficha se arma en el navegador o fetch falla.
// Guarda el texto visible (sin scripts) por URL; las protecciones anti-bot se respetan: lo bloqueado se anota y se salta.
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";
const plan: { url: string }[] = await Bun.file(".wrangler/dataset/scrape-plan.json").json();
const urls = [...new Set(plan.map((p) => p.url))];
const dir = ".wrangler/dataset/pages";
const SPEC = /(\d{2,3}(\.\d)?\s*mm)|socket|lga|am5|radiator|gpu|clearance|height|dimension/i;
const strip = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d|dt|dd|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;|&ndash;/g, "-")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
const blocked = (t: string) =>
  /just a moment|un momento|access denied|attention required|verify you are human/i.test(t.slice(0, 600));
const name = (u: string) =>
  u
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .slice(0, 150) + ".txt";
const result: Record<string, string> = {};
async function viaFetch(u: string) {
  const r = await fetch(u, {
    headers: { "user-agent": UA, "accept-language": "en" },
    signal: AbortSignal.timeout(25000),
  });
  return r.ok ? strip(await r.text()) : "";
}
async function viaView(u: string) {
  const v = new Bun.WebView();
  try {
    await v.navigate(u);
    await Bun.sleep(3500);
    return String(await v.evaluate("document.body.innerText"));
  } finally {
    v.close();
  }
}
let i = 0;
async function worker() {
  while (i < urls.length) {
    const u = urls[i++]!;
    let text = await viaFetch(u).catch(() => "");
    let how = "fetch";
    if (!text || blocked(text) || (text.match(SPEC) ?? []).length === 0 || text.length < 1500) {
      text = await viaView(u).catch(() => "");
      how = "webview";
    }
    if (!text || blocked(text)) {
      result[u] = "bloqueada";
      continue;
    }
    await Bun.write(`${dir}/${name(u)}`, `URL: ${u}\n\n${text.slice(0, 40000)}`);
    result[u] = `${how} ${text.length}`;
  }
}
const t0 = performance.now();
await Promise.all(Array.from({ length: 8 }, worker));
await Bun.write(
  ".wrangler/dataset/pages-index.json",
  JSON.stringify(Object.fromEntries(urls.map((u) => [u, name(u)])), null, 1),
);
const vals = Object.values(result);
console.log(
  `${urls.length} URLs en ${Math.round((performance.now() - t0) / 1000)} s: fetch ${vals.filter((v) => v.startsWith("fetch")).length}, webview ${vals.filter((v) => v.startsWith("webview")).length}, bloqueadas ${vals.filter((v) => v === "bloqueada").length}`,
);
