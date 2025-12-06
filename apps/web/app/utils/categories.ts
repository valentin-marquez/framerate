export const CATEGORY_CONFIG: Record<string, { label: string; urlSlug: string }> = {
  motherboard: { label: "Placas Madre", urlSlug: "placas-madre" },
  case: { label: "Gabinetes", urlSlug: "gabinetes" },
  gpu: { label: "Tarjetas de Video", urlSlug: "tarjetas-de-video" },
  ssd: { label: "SSD", urlSlug: "ssd" },
  psu: { label: "Fuentes de Poder", urlSlug: "fuentes-de-poder" },
  cpu: { label: "Procesadores", urlSlug: "procesadores" },
  cpu_cooler: { label: "Coolers CPU", urlSlug: "coolers-cpu" },
  hdd: { label: "Discos Duros", urlSlug: "discos-duros" },
  case_fan: { label: "Ventiladores", urlSlug: "ventiladores" },
  ram: { label: "Memorias RAM", urlSlug: "memorias-ram" },
};

export function getCategoryConfig(apiSlug: string) {
  return CATEGORY_CONFIG[apiSlug] || { label: apiSlug, urlSlug: apiSlug };
}

export function getApiSlugFromUrl(urlSlug: string) {
  const entry = Object.entries(CATEGORY_CONFIG).find(([_, config]) => config.urlSlug === urlSlug);
  return entry ? entry[0] : null;
}
