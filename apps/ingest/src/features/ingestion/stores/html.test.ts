import { expect, test } from "bun:test";
import { findLd, jsonLdNodes, parseClp } from "./html";

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
