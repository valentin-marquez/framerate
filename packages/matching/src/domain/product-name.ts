import { collapseWhitespace } from "@framerate/kit";

/** Prefijos genéricos que las tiendas anteponen al nombre ("Tarjeta de Video ASUS…"). */
const CATEGORY_PREFIX =
  /^(tarjeta (de )?(video|grafica|gráfica)|procesador|memoria( ram)?|disco (duro|s[oó]lido|ssd)|unidad ssd|ssd|fuente( de poder)?|placa madre|tarjeta madre|motherboard|gabinete|ventilador|cooler( cpu)?|refrigeraci[oó]n( l[ií]quida)?)\b[\s:–-]*/i;

/** Nombre de producto canónico a partir del título de la primera oferta. */
export function productNameFromTitle(title: string): string {
  const name = collapseWhitespace(title.replace(CATEGORY_PREFIX, ""));
  return name.length >= 5 ? name : title;
}
