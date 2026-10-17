// Recibe lo que manda Playwright y lo guarda en .wrangler/dataset/<nombre>.
Bun.serve({
  hostname: "127.0.0.1",
  port: 4997,
  async fetch(req) {
    const name = new URL(req.url).pathname.slice(1).replace(/[^a-z0-9._-]/gi, "_");
    if (req.method !== "POST" || !name) return new Response("no", { status: 400 });
    await Bun.write(`.wrangler/dataset/${name}`, await req.text());
    return new Response("ok");
  },
});
console.log("escuchando en 127.0.0.1:4997");
