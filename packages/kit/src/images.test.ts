import { expect, test } from "bun:test";
import { imageVariant } from "./images";

test("variante de la copia propia; la URL de la tienda queda igual", () => {
  const hash = "f18b0630a87de9d368b53f27c2ed3db0";
  expect(imageVariant(`products/${hash}.webp`, 400)).toBe(`products/${hash}-w400.webp`);
  expect(imageVariant(`https://cdn.framerate.cl/products/${hash}.webp`, 400)).toBe(
    `https://cdn.framerate.cl/products/${hash}-w400.webp`,
  );
  expect(imageVariant(`products/${hash}-w400.webp`, 400)).toBe(`products/${hash}-w400.webp`);
  expect(imageVariant("https://tienda.cl/products/foto.webp", 400)).toBe("https://tienda.cl/products/foto.webp");
});
