import type { QuoteDetail, QuoteItem } from "~/features/quote/services/quotes";

export const exportToExcel = async (quote: QuoteDetail, items?: QuoteItem[]) => {
  const XLSX = await import("xlsx");
  const itemsToExport = items || quote.items;
  const data = itemsToExport.map((item) => {
    const priceNormal = item.selected_listing ? item.selected_listing.price_normal : item.product.prices?.normal || 0;
    const priceCash = item.selected_listing ? item.selected_listing.price_cash : item.product.prices?.cash || 0;

    return {
      Producto: item.product.name,
      Categoría: item.product.category?.name || "",
      Tienda: item.selected_listing?.store?.name || "Mejor precio",
      "Link Tienda": item.selected_listing?.url || "",
      Cantidad: item.quantity,
      "Precio Normal Unitario": priceNormal,
      "Precio Efectivo Unitario": priceCash,
      "Total Normal": (priceNormal ?? 0) * item.quantity,
      "Total Efectivo": (priceCash ?? 0) * item.quantity,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Cotización");

  // Adjust column widths
  const wscols = [
    { wch: 40 }, // Producto
    { wch: 15 }, // Categoría
    { wch: 20 }, // Tienda
    { wch: 30 }, // Link Tienda
    { wch: 10 }, // Cantidad
    { wch: 15 }, // Precio Normal
    { wch: 15 }, // Precio Efectivo
    { wch: 15 }, // Total Normal
    { wch: 15 }, // Total Efectivo
  ];
  worksheet["!cols"] = wscols;

  XLSX.writeFile(workbook, `${quote.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.xlsx`);
};

export const copyToClipboard = async (quote: QuoteDetail, items?: QuoteItem[]) => {
  const itemsToExport = items || quote.items;
  const lines = [`Cotización: ${quote.name}`];
  lines.push(`Fecha: ${new Date().toLocaleDateString("es-CL")}`);
  lines.push("");

  itemsToExport.forEach((item) => {
    const priceCash = item.selected_listing ? item.selected_listing.price_cash : item.product.prices?.cash || 0;
    const store = item.selected_listing?.store?.name || "Mejor precio";

    lines.push(`- ${item.quantity}x ${item.product.name}`);
    lines.push(`  ${store} - $${(priceCash ?? 0).toLocaleString("es-CL")}`);
    if (item.selected_listing?.url) {
      lines.push(`  Link: ${item.selected_listing.url}`);
    }
  });

  const totalCash = itemsToExport.reduce((acc, item) => {
    const price = item.selected_listing ? item.selected_listing.price_cash : item.product.prices?.cash || 0;
    return acc + (price ?? 0) * item.quantity;
  }, 0);

  lines.push("");
  lines.push(`Total: $${totalCash.toLocaleString("es-CL")}`);
  lines.push("");
  lines.push("Generado en Framerate.cl");

  const text = lines.join("\n");

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error("Failed to copy: ", err);
    return false;
  }
};
