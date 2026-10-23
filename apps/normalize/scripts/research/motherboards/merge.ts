// Junta lo extraído por Haiku en filas para `part-reference.ts build motherboard`, con los nombres del catálogo como alias.
const S = process.argv[2];
const catalog: { product_id: number; model: string | null; name: string }[] = await Bun.file(
  `${S}/catalog-boards.json`,
).json();
const byId = new Map(catalog.map((c) => [c.product_id, c]));
const plan: { product_id: number; url: string | null }[] = await Bun.file(`${S}/plan-full.json`).json();
const planUrl = new Map(plan.map((p) => [p.product_id, p.url]));
const glob = new Bun.Glob("*.json");
const rows: any[] = [];
let dropped = 0;
for await (const f of glob.scan(`${S}/extracted`)) {
  for (const r of (await Bun.file(`${S}/extracted/${f}`).json()) as any[]) {
    const filled = ["socket", "memory_slots", "m2_slots", "chassis_fan_headers"].filter(
      (k) => r[k] !== null && r[k] !== undefined,
    ).length;
    if (!r.brand || !r.model || filled < 2) {
      dropped++;
      continue;
    }
    // Si la URL del plan cambió después de extraer (emparejamiento corregido), la fila vieja no vale.
    const planned = planUrl.get(Number(r.product_id));
    if (
      !planned ||
      (r.source_url &&
        !r.source_url.includes(
          planned
            .replace(/\/techspec\/?$/, "")
            .split("/")
            .pop() ?? "",
        ))
    ) {
      dropped++;
      continue;
    }
    const c = byId.get(Number(r.product_id));
    const aliases = new Set<string>();
    if (c?.model) aliases.add(c.model);
    // El catálogo escribe el modelo sin la serie: "PRIME B550M-A" → "B550M-A".
    aliases.add(
      r.model.replace(/^(PRIME|PRO|TUF GAMING|ROG STRIX|ROG CROSSHAIR|ROG MAXIMUS|ROG|MAG|MPG|MEG|AORUS)\s+/i, ""),
    );
    rows.push({ ...r, catalog_models: [...aliases] });
  }
}
await Bun.write(`${S}/rows-motherboard.json`, JSON.stringify(rows, null, 1));
console.log(`filas ${rows.length}, descartadas ${dropped}`);
const has = (k: string) => rows.filter((r) => r[k] !== null && r[k] !== undefined).length;
console.log(
  `velocidad ${has("memory_max_speed_mt_s")}, ranuras ${has("memory_slots")}, m2 ${has("m2_slots")}, fan gabinete ${has("chassis_fan_headers")}, argb ${has("argb_5v_headers")}, rgb ${has("rgb_12v_headers")}, usb-c ${has("usb_c_front_header")}, flashback ${has("bios_flashback")}`,
);
