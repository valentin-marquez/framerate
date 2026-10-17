// Junta extracciones (fichas bajadas) y búsquedas por categoría; las extracciones primero porque leyeron la ficha entera.
const D = ".wrangler/dataset";
const out: Record<string, any[]> = { cpu_cooler: [], case: [] };
for (const i of ["w0", "w1", "w2", 0, 1, 2, 3, 4]) {
  const path = `${D}/extract-${i}.json`;
  if (!(await Bun.file(path).exists())) {
    console.error("falta", path);
    continue;
  }
  const input: any[] = await Bun.file(`${D}/extract-${i}.input.json`).json();
  const cat = new Map(input.map((e) => [e.model, e.category]));
  for (const r of await Bun.file(path).json()) {
    const c =
      (r.catalog_models ?? []).map((m: string) => cat.get(m)).find(Boolean) ?? (r.motherboards ? "case" : "cpu_cooler");
    // Un ventilador de 240 mm no existe: es la medida del radiador (MSI FENIX 240).
    if (r.fan_size_mm && r.fan_size_mm > 200) r.fan_size_mm = null;
    // Si el nombre del AIO trae la medida del radiador, gana el nombre (Iceberg 120 Rainbow con "240" en la tabla).
    const named = String(r.model ?? "").match(/\b(120|240|280|360|420)\b/)?.[1];
    if (r.type === "aio" && named) r.radiator_mm = Number(named);
    out[c]?.push(r);
  }
}
for (const c of ["cpu_cooler", "case"])
  for (let i = 0; i <= 4; i++) {
    const path = `${D}/${c}-${i}.json`;
    if (await Bun.file(path).exists()) out[c]?.push(...(await Bun.file(path).json()));
  }
for (const [c, rows] of Object.entries(out)) {
  await Bun.write(`${D}/${c}-all.json`, JSON.stringify(rows));
  console.log(c, rows.length, "filas");
}
