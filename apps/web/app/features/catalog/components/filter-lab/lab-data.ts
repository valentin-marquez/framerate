import type { ProductSummary } from "@framerate/contracts";
import { useState } from "react";
import { products as baseProducts } from "~/shared/storybook/fixtures";
import { formatCLP } from "~/shared/utils/format";

/**
 * Datos de ejemplo de la exploración de filtros: 24 tarjetas con más atributos de los que hoy trae la API
 * (fabricante del chip, tipo de memoria, bus), para ver cómo se comporta cada layout con muchos grupos.
 */

type Row = [
  name: string,
  brand: string,
  maker: string,
  chipset: string,
  vram: number,
  memory: string,
  pcie: string,
  price: number,
  stock: boolean,
  dropped: boolean,
];

const ROWS: Row[] = [
  ["RTX 3050 MSI Ventus 2X 6GB", "MSI", "NVIDIA", "RTX 3050", 6, "GDDR6", "4.0", 279_990, true, false],
  ["RTX 5050 Zotac Twin Edge OC 8GB", "Zotac", "NVIDIA", "RTX 5050", 8, "GDDR6", "5.0", 379_990, true, false],
  ["RTX 5050 ASUS Dual 8GB", "ASUS", "NVIDIA", "RTX 5050", 8, "GDDR6", "5.0", 389_990, true, true],
  ["RTX 5060 MSI Shadow 2X 8GB", "MSI", "NVIDIA", "RTX 5060", 8, "GDDR7", "5.0", 449_990, true, false],
  ["RTX 5060 ASUS Dual OC 8GB", "ASUS", "NVIDIA", "RTX 5060", 8, "GDDR7", "5.0", 459_990, true, false],
  ["RTX 5060 Gigabyte Windforce 8GB", "Gigabyte", "NVIDIA", "RTX 5060", 8, "GDDR7", "5.0", 439_990, false, false],
  ["RTX 5060 Ti Zotac Twin Edge 16GB", "Zotac", "NVIDIA", "RTX 5060 Ti", 16, "GDDR7", "5.0", 579_990, true, true],
  ["RTX 5060 Ti MSI Gaming 16GB", "MSI", "NVIDIA", "RTX 5060 Ti", 16, "GDDR7", "5.0", 619_990, true, false],
  ["RTX 5070 MSI Shadow 3X 12GB", "MSI", "NVIDIA", "RTX 5070", 12, "GDDR7", "5.0", 909_990, true, false],
  ["RTX 5070 ASUS Prime 12GB", "ASUS", "NVIDIA", "RTX 5070", 12, "GDDR7", "5.0", 929_990, true, true],
  ["RTX 5070 Gigabyte Windforce 12GB", "Gigabyte", "NVIDIA", "RTX 5070", 12, "GDDR7", "5.0", 899_990, false, false],
  ["RTX 5070 Ti MSI Ventus 3X 16GB", "MSI", "NVIDIA", "RTX 5070 Ti", 16, "GDDR7", "5.0", 1_393_990, true, false],
  ["RTX 5070 Ti ASUS Prime 16GB", "ASUS", "NVIDIA", "RTX 5070 Ti", 16, "GDDR7", "5.0", 1_449_990, true, false],
  ["RX 7600 ASUS Dual EVO 8GB", "ASUS", "AMD", "RX 7600", 8, "GDDR6", "4.0", 319_990, true, true],
  ["RX 7600 Sapphire Pulse 8GB", "Sapphire", "AMD", "RX 7600", 8, "GDDR6", "4.0", 309_990, true, false],
  ["RX 9060 XT ASUS Dual 16GB", "ASUS", "AMD", "RX 9060 XT", 16, "GDDR6", "5.0", 549_990, true, false],
  ["RX 9060 XT ASRock Challenger 16GB", "ASRock", "AMD", "RX 9060 XT", 16, "GDDR6", "5.0", 557_900, true, true],
  ["RX 9060 XT Sapphire Pulse 8GB", "Sapphire", "AMD", "RX 9060 XT", 8, "GDDR6", "5.0", 489_990, true, false],
  ["RX 9070 XT ASUS Prime OC 16GB", "ASUS", "AMD", "RX 9070 XT", 16, "GDDR6", "5.0", 954_990, true, false],
  ["RX 9070 XT Sapphire Nitro+ 16GB", "Sapphire", "AMD", "RX 9070 XT", 16, "GDDR6", "5.0", 1_029_990, false, false],
  ["RX 9070 XT ASRock Steel Legend 16GB", "ASRock", "AMD", "RX 9070 XT", 16, "GDDR6", "5.0", 969_990, true, true],
  ["Arc B580 ASRock Challenger 12GB", "ASRock", "Intel", "Arc B580", 12, "GDDR6", "4.0", 329_990, true, false],
  ["Arc B570 Sparkle Titan 10GB", "Sparkle", "Intel", "Arc B570", 10, "GDDR6", "4.0", 279_990, true, true],
  ["Arc A750 ASRock Challenger 8GB", "ASRock", "Intel", "Arc A750", 8, "GDDR6", "4.0", 229_990, false, false],
];

export interface LabProduct extends ProductSummary {
  maker: string;
  chip: string;
  memory: string;
  pcie: string;
}

/** Como en el catálogo real, las listas sólo traen productos con stock. */
export const labProducts: LabProduct[] = ROWS.filter((r) => r[8]).map(
  ([name, brand, maker, chip, vram, memory, pcie, price, , dropped], i) => ({
    id: i + 1,
    slug: `lab-${i + 1}`,
    name: `Tarjeta de video ${name}`,
    brand,
    category: "gpu",
    imageUrl: baseProducts[i % baseProducts.length].imageUrl,
    attributes: { chipset: chip.toLowerCase(), vram },
    bestPrice: price,
    bestCardPrice: price,
    offerCount: 2,
    mpn: null,
    referencePrice: dropped ? Math.round(price * 1.14) : null,
    maker,
    chip,
    memory,
    pcie,
  }),
);

/** Los grupos con lista de valores. `real`: ya existe en la API hoy; el resto necesitaría faceta nueva. */
export const GROUPS = [
  { key: "brand", label: "Marca", real: true, get: (p: LabProduct) => p.brand ?? "Otra" },
  { key: "maker", label: "Fabricante del chip", real: false, get: (p: LabProduct) => p.maker },
  { key: "chip", label: "Modelo", real: true, get: (p: LabProduct) => p.chip },
  { key: "vram", label: "Memoria", real: true, get: (p: LabProduct) => `${p.attributes.vram} GB` },
  { key: "memory", label: "Tipo de memoria", real: false, get: (p: LabProduct) => p.memory },
  { key: "pcie", label: "Bus PCIe", real: false, get: (p: LabProduct) => `PCIe ${p.pcie}` },
] as const;

export type GroupKey = (typeof GROUPS)[number]["key"];

export interface Selection {
  groups: Record<GroupKey, string[]>;
  min: number | null;
  max: number | null;
}

const EMPTY: Selection = {
  groups: { brand: [], maker: [], chip: [], vram: [], memory: [], pcie: [] },
  min: null,
  max: null,
};

/** `skip`: ignora un grupo, para contar sus valores como si no estuviera filtrado (varios valores son "o"). */
function matches(p: LabProduct, sel: Selection, skip?: GroupKey) {
  const price = p.bestPrice ?? 0;
  if (sel.min !== null && price < sel.min) return false;
  if (sel.max !== null && price > sel.max) return false;
  return GROUPS.every((g) => g.key === skip || sel.groups[g.key].length === 0 || sel.groups[g.key].includes(g.get(p)));
}

const prices = labProducts.map((p) => p.bestPrice ?? 0).filter(Boolean);
/** Límites del slider: el rango real de la categoría, redondeado a 10 mil. */
export const PRICE_MIN = Math.floor(Math.min(...prices) / 10_000) * 10_000;
export const PRICE_MAX = Math.ceil(Math.max(...prices) / 10_000) * 10_000;

export const SORTS = {
  price_asc: {
    label: "Precio: menor a mayor",
    by: (a: LabProduct, b: LabProduct) => (a.bestPrice ?? 1e12) - (b.bestPrice ?? 1e12),
  },
  price_desc: {
    label: "Precio: mayor a menor",
    by: (a: LabProduct, b: LabProduct) => (b.bestPrice ?? 0) - (a.bestPrice ?? 0),
  },
  popularity: { label: "Más populares", by: (a: LabProduct, b: LabProduct) => a.id - b.id },
  name: { label: "Nombre", by: (a: LabProduct, b: LabProduct) => a.name.localeCompare(b.name, "es") },
  discount: { label: "Mayor baja", by: (a: LabProduct, b: LabProduct) => drop(b) - drop(a) },
} as const;
export type SortKey = keyof typeof SORTS;
const drop = (p: LabProduct) => (p.referencePrice && p.bestPrice ? p.referencePrice / p.bestPrice : 0);

export const PER_PAGE = [6, 12, 24] as const;

export interface Chip {
  id: string;
  label: string;
  clear: () => void;
}

export type Lab = ReturnType<typeof useLab>;

export function useLab(initial: Partial<Selection> = {}) {
  const [sel, setSelRaw] = useState<Selection>({
    ...EMPTY,
    ...initial,
    groups: { ...EMPTY.groups, ...initial.groups },
  });
  const [sort, setSort] = useState<SortKey>("price_asc");
  const [perPage, setPerPage] = useState<number>(PER_PAGE[0]);
  const [pageRaw, setPage] = useState(1);
  // Cambiar un filtro vuelve a la primera página, como en la URL real.
  const setSel = (next: Selection | ((s: Selection) => Selection)) => {
    setSelRaw(next);
    setPage(1);
  };

  const results = labProducts.filter((p) => matches(p, sel)).sort(SORTS[sort].by);
  const totalPages = Math.max(1, Math.ceil(results.length / perPage));
  const page = Math.min(pageRaw, totalPages);
  const pageItems = results.slice((page - 1) * perPage, page * perPage);

  const toggle = (key: GroupKey, value: string) =>
    setSel((s) => {
      const cur = s.groups[key];
      return {
        ...s,
        groups: { ...s.groups, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] },
      };
    });
  const clearGroup = (key: GroupKey) => setSel((s) => ({ ...s, groups: { ...s.groups, [key]: [] } }));

  /** Valores de un grupo con su conteo bajo el resto de filtros, de mayor a menor (los vacíos al final). */
  const options = (key: GroupKey) => {
    const g = GROUPS.find((x) => x.key === key);
    if (!g) return [];
    const counts = new Map<string, number>();
    for (const p of labProducts) counts.set(g.get(p), counts.get(g.get(p)) ?? 0);
    for (const p of labProducts.filter((x) => matches(x, sel, key)))
      counts.set(g.get(p), (counts.get(g.get(p)) ?? 0) + 1);
    return [...counts]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "es", { numeric: true }));
  };

  const edits: { id: string; label: string; edit: (s: Selection) => Selection }[] = [
    ...GROUPS.flatMap((g) =>
      sel.groups[g.key].map((v) => ({
        id: `${g.key}:${v}`,
        label: v,
        edit: (s: Selection) => ({ ...s, groups: { ...s.groups, [g.key]: s.groups[g.key].filter((x) => x !== v) } }),
      })),
    ),
    ...(sel.min !== null || sel.max !== null
      ? [
          {
            id: "price",
            label: `${formatCLP(sel.min ?? PRICE_MIN)} a ${formatCLP(sel.max ?? PRICE_MAX)}`,
            edit: (s: Selection) => ({ ...s, min: null, max: null }),
          },
        ]
      : []),
  ];
  const chips: Chip[] = edits.map((c) => ({ id: c.id, label: c.label, clear: () => setSel(c.edit) }));

  /** Sin resultados: qué filtro conviene quitar, con cuántos productos aparecerían. */
  const relax = results.length
    ? []
    : edits
        .map((c) => ({
          id: c.id,
          label: c.label,
          count: labProducts.filter((p) => matches(p, c.edit(sel))).length,
          clear: () => setSel(c.edit),
        }))
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count - a.count);

  return {
    sel,
    results,
    pageItems,
    page,
    totalPages,
    perPage,
    sort,
    setSort,
    setPage,
    setPerPage: (n: number) => {
      setPerPage(n);
      setPage(1);
    },
    total: results.length,
    options,
    chips,
    relax,
    toggle,
    clearGroup,
    clear: () => setSel(EMPTY),
    setPrice: (min: number | null, max: number | null) => setSel((s) => ({ ...s, min, max })),
  };
}
