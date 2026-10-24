import { expect, test } from "bun:test";
import { silentLogger } from "@framerate/kit";
import type { RawOffer } from "../domain/normalize";
import type { CrawlContext } from "./adapter";
import { fichaDue, fichaText, findLd, jsonLdNodes, parseClp, refreshByListing } from "./html";

const page = `<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"Tienda"},{"@type":["Product"],"sku":"DUAL-RTX3060-O12G-V2","gtin13":"4711081878452"}]}</script>
<script type="application/ld+json">{ roto </script>
<script type='application/ld+json'>[{"@type":"BreadcrumbList"}]</script>
</head></html>`;

test("jsonLdNodes aplana @graph y arreglos e ignora bloques rotos", () => {
  expect(new Set(jsonLdNodes(page).map((n) => String(n["@type"])))).toEqual(
    new Set(["undefined", "Product", "WebSite", "BreadcrumbList"]),
  );
});

test("findLd encuentra el Product aunque @type sea arreglo", () => {
  expect(findLd(page, "Product")).toMatchObject({ sku: "DUAL-RTX3060-O12G-V2" });
  expect(findLd(page, "Offer")).toBeUndefined();
});

test("parseClp lee precios chilenos con entidades", () => {
  expect(parseClp("&#036; 639.990")).toBe(639_990);
  expect(parseClp("$1.234.990")).toBe(1_234_990);
  expect(parseClp("")).toBeNull();
});

test("fichaText: reusa el texto guardado, pide el de la nueva y reintenta la vacía sólo en su turno", async () => {
  const saved = new Map<string, Partial<RawOffer>>([
    ["https://t.example/con", { sourceText: "Guardado" }],
    ["https://t.example/sin", { sourceText: null }],
  ]);
  const ctx = {
    log: silentLogger,
    known: async (url: string) => saved.get(url) as RawOffer | undefined,
  } as unknown as CrawlContext;
  let calls = 0;
  const fetchText = async () => {
    calls++;
    return "Nuevo";
  };
  const slots = Array.from({ length: 4 }, (_, i) => i * 6 * 3_600_000);
  const due = slots.find((t) => fichaDue("https://t.example/sin", t)) ?? 0;
  const notDue = slots.find((t) => !fichaDue("https://t.example/sin", t)) ?? 0;

  expect(await fichaText(ctx, { url: "https://t.example/con", inStock: true }, due, fetchText)).toBe("Guardado");
  expect(await fichaText(ctx, { url: "https://t.example/nueva", inStock: true }, notDue, fetchText)).toBe("Nuevo");
  expect(await fichaText(ctx, { url: "https://t.example/sin", inStock: true }, notDue, fetchText)).toBeNull();
  expect(await fichaText(ctx, { url: "https://t.example/sin", inStock: true }, due, fetchText)).toBe("Nuevo");
  expect(calls).toBe(2);
  // Agotada y desconocida: no se guarda, así que no vale la petición.
  expect(await fichaText(ctx, { url: "https://t.example/agotada", inStock: false }, due, fetchText)).toBeNull();
  expect(calls).toBe(2);

  const failing = async () => {
    throw new Error("429");
  };
  expect(await fichaText(ctx, { url: "https://t.example/nueva", inStock: true }, notDue, failing)).toBeNull();
});

test("refreshByListing: entrega sólo las pedidas y deja de recorrer la categoría al verlas todas", async () => {
  const listed: string[] = [];
  async function* list(category: string) {
    for (const id of ["1", "2", "3", "4"]) {
      listed.push(`${category}:${id}`);
      yield { externalId: id } as RawOffer;
    }
  }
  const refs = [
    { externalId: "2", url: "", category: "gpu" as const },
    { externalId: "1", url: "", category: "gpu" as const },
    { externalId: "9", url: "", category: "cpu" as const },
  ];
  const offers = await Array.fromAsync(refreshByListing(refs, list));
  expect(offers.map((o) => o.externalId)).toEqual(["1", "2"]);
  expect(listed).toEqual(["gpu:1", "gpu:2", "cpu:1", "cpu:2", "cpu:3", "cpu:4"]);
});
