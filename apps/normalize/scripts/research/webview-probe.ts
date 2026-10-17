const urls = process.argv.slice(2);
const t0 = performance.now();
const out = await Promise.all(
  urls.map(async (url) => {
    const view = new Bun.WebView();
    try {
      await view.navigate(url);
      await Bun.sleep(3000);
      const text = String(await view.evaluate("document.body.innerText"));
      const links = Number(await view.evaluate("document.querySelectorAll('a[href]').length"));
      return {
        url,
        title: String(await view.title).slice(0, 60),
        len: text.length,
        links,
        blocked: /just a moment|un momento|access denied|attention required|forbidden/i.test(text.slice(0, 400)),
      };
    } catch (e) {
      return { url, error: String(e).slice(0, 100) };
    } finally {
      view.close();
    }
  }),
);
for (const o of out) console.log(JSON.stringify(o));
console.log(`${Math.round(performance.now() - t0)} ms`);
