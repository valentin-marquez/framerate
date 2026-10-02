import { CATEGORY_LABELS, type QuoteDetail } from "@framerate/contracts";

/** Lo que cuenta en el total: los seleccionados (las alternativas guardadas no se exportan). */
const selectedItems = (quote: QuoteDetail) => quote.items.filter((item) => item.isSelected);

export const exportToExcel = async (quote: QuoteDetail) => {
  const XLSX = await import("xlsx");
  const data = selectedItems(quote).map(({ product, offer, quantity }) => ({
    Producto: product.name,
    Categoría: CATEGORY_LABELS[product.category],
    Tienda: offer?.store.name ?? "No disponible",
    "Enlace a la tienda": offer?.url ?? "",
    Cantidad: quantity,
    "Precio unitario con tarjeta": offer?.priceCard ?? 0,
    "Precio unitario efectivo": offer?.priceCash ?? 0,
    "Total con tarjeta": (offer?.priceCard ?? 0) * quantity,
    "Total efectivo": (offer?.priceCash ?? 0) * quantity,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Cotización");

  worksheet["!cols"] = [
    { wch: 40 },
    { wch: 18 },
    { wch: 20 },
    { wch: 30 },
    { wch: 10 },
    { wch: 26 },
    { wch: 24 },
    { wch: 18 },
    { wch: 15 },
  ];

  XLSX.writeFile(workbook, `${quote.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.xlsx`);
};

export const copyToClipboard = async (quote: QuoteDetail) => {
  const lines = [`Cotización: ${quote.name}`, `Fecha: ${new Date().toLocaleDateString("es-CL")}`, ""];

  for (const { product, offer, quantity } of selectedItems(quote)) {
    lines.push(`- ${quantity}x ${product.name}`);
    lines.push(`  ${offer ? `${offer.store.name} - $${offer.priceCash.toLocaleString("es-CL")}` : "No disponible"}`);
    if (offer) lines.push(`  Link: ${offer.url}`);
  }

  lines.push("", `Total: $${quote.totals.cash.toLocaleString("es-CL")}`, "", "Generado en Framerate.cl");

  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    return true;
  } catch (err) {
    console.error("Failed to copy: ", err);
    return false;
  }
};
