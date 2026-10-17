import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { gpuFacets, products } from "~/shared/storybook/fixtures";
import { CategoryHeader } from "../catalog-headers";
import {
  type HeaderProposalProps,
  HeaderQuickFilters,
  HeaderTagline,
  HeaderTwoTone,
  type QuickFilter,
} from "./category-header-proposals";

/** Cabecera de categoría: la actual y las propuestas A, B y C, con el nombre largo (SSD) y uno corto (GPU). */
const meta = { title: "Catálogo/Propuestas: cabecera de categoría", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const ssd: HeaderProposalProps = { category: "ssd", total: 162, minPrice: 23_900, brandCount: 33, storeCount: 21 };
const gpu: HeaderProposalProps = {
  category: "tarjetas-de-video",
  total: 180,
  minPrice: 279_990,
  brandCount: 12,
  storeCount: 18,
};

const memory = gpuFacets[0];
const gpuFilters: QuickFilter[] = memory.values.map((v) => ({
  label: v.label,
  count: v.count,
  imageUrl: products.find((p) => String(p.attributes.vram) === v.value)?.imageUrl ?? null,
}));
const ssdFilters: QuickFilter[] = [
  { label: "NVMe", count: 98, imageUrl: null },
  { label: "SATA", count: 64, imageUrl: null },
  { label: "M.2 2280", count: 110, imageUrl: null },
  { label: '2.5"', count: 52, imageUrl: null },
];

function Variant({ letter, title, children }: { letter: string; title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-border border-t pt-6 pb-12 first:border-t-0 first:pt-0">
      <p className="text-label-sm text-muted-foreground">
        <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-foreground text-background">
          {letter}
        </span>
        {title}
      </p>
      {children}
    </section>
  );
}

const actual = (p: HeaderProposalProps) => (
  <CategoryHeader
    category={p.category}
    total={p.total}
    priceRange={{ min: p.minPrice, max: (p.minPrice ?? 0) * 40 }}
    brandCount={p.brandCount}
  />
);

const variants = (p: HeaderProposalProps, filters: QuickFilter[]) => (
  <div className="mx-auto max-w-6xl">
    <Variant letter="0" title="Hoy: foto de stock en gris y datos chicos">
      {actual(p)}
    </Variant>
    <Variant letter="A" title="Dos tonos con datos reales (Apple Store), sin foto">
      <HeaderTwoTone {...p} />
    </Variant>
    <Variant letter="B" title="Título grande y frase a la derecha (Apple Store), sin foto">
      <HeaderTagline {...p} />
    </Variant>
    <Variant letter="C" title="Título y filtros rápidos con miniatura (IKEA), sin foto">
      <HeaderQuickFilters {...p} facet={memory.label} filters={filters} />
    </Variant>
  </div>
);

export const ComparacionSSD: Story = {
  name: "Comparación: SSD (nombre largo)",
  render: () => variants(ssd, ssdFilters),
};

export const ComparacionGPU: Story = {
  name: "Comparación: tarjetas de video",
  render: () => variants(gpu, gpuFilters),
};
