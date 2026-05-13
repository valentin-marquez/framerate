export const CATEGORY_CONFIG: Record<string, { label: string; urlSlug: string }> = {
  "placas-madre": { label: "Placas Madre", urlSlug: "placas-madre" },
  gabinetes: { label: "Gabinetes", urlSlug: "gabinetes" },
  "tarjetas-de-video": { label: "Tarjetas de Video", urlSlug: "tarjetas-de-video" },
  ssd: { label: "SSD", urlSlug: "ssd" },
  "fuentes-de-poder": { label: "Fuentes de Poder", urlSlug: "fuentes-de-poder" },
  procesadores: { label: "Procesadores", urlSlug: "procesadores" },
  "coolers-cpu": { label: "Coolers CPU", urlSlug: "coolers-cpu" },
  "discos-duros": { label: "Discos Duros", urlSlug: "discos-duros" },
  ventiladores: { label: "Ventiladores", urlSlug: "ventiladores" },
  "memorias-ram": { label: "Memorias RAM", urlSlug: "memorias-ram" },
};

export function getCategoryConfig(apiSlug: string) {
  return CATEGORY_CONFIG[apiSlug] || { label: apiSlug, urlSlug: apiSlug };
}

export function getApiSlugFromUrl(urlSlug: string) {
  const entry = Object.entries(CATEGORY_CONFIG).find(([_, config]) => config.urlSlug === urlSlug);
  return entry ? entry[0] : null;
}
