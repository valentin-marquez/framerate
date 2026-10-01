import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ValidationIssue } from "~/features/quote/services/quotes";
import { Button } from "~/shared/components/primitives/button";
import { CompatibilityBadge } from "./compatibility-badge";
import { CreateQuoteDialog } from "./create-quote-dialog";
import { QuoteActions } from "./quote-actions";
import { QuoteHeader } from "./quote-header";
import { QuoteItemsList } from "./quote-items-list";
import { QuotePerformanceCard } from "./quote-performance-card";
import { QuoteTotals } from "./quote-totals";
import { QuoteValidationStatus } from "./quote-validation-status";

/** Heredado: la API de cotizaciones está apagada (`QUOTES_API_ENABLED = false`) y sus tipos son los de Supabase. */
const meta = { title: "Cotización/Piezas", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

export const InsigniaDeCompatibilidad: Story = {
  name: "Insignia de compatibilidad",
  render: () => (
    <div className="flex flex-wrap gap-2">
      {["valid", "warning", "incompatible", "empty", "unknown"].map((status) => (
        <CompatibilityBadge key={status} status={status} />
      ))}
      <CompatibilityBadge status="valid" isAnalyzing />
    </div>
  ),
};

export const Cabecera: Story = {
  render: () => (
    <QuoteHeader
      quoteName="PC gamer 1440p"
      userName="ana#1"
      updatedAt="2026-09-28T15:00:00.000Z"
      compatibilityStatus="warning"
      estimatedWattage={520}
    />
  ),
};

export const ListaVacia: Story = {
  name: "Lista de componentes vacía",
  render: () => (
    <QuoteItemsList
      flattenedItems={[]}
      activeItems={[]}
      totalNormal={0}
      totalCash={0}
      onRemove={noop}
      onChangeStore={noop}
      isOwner
      selectedVariants={{}}
      onSelectVariant={noop}
      onAdd={noop}
    />
  ),
};

export const Totales: Story = {
  render: () => (
    <div className="max-w-3xl space-y-4 overflow-hidden rounded-3xl border border-border/40 bg-card">
      <QuoteTotals totalNormal={1_289_970} totalCash={1_219_970} />
      <QuoteTotals totalNormal={1_289_970} totalCash={1_219_970} hasOutOfStockItems />
    </div>
  ),
};

export const Rendimiento: Story = {
  name: "Rendimiento estimado",
  render: () => (
    <div className="grid max-w-3xl gap-4 md:grid-cols-2">
      <QuotePerformanceCard
        performance={{ cpuScore: 21_450, gpuScore: 18_230, totalScore: 18_713, tier: "High / 1440p" }}
      />
      <QuotePerformanceCard
        performance={{ cpuScore: 9_800, gpuScore: 6_100, totalScore: 6_655, tier: "Mid / 1080p" }}
      />
    </div>
  ),
};

const issues: ValidationIssue[] = [
  {
    code: "PSU_UNDERPOWERED",
    severity: "error",
    message: "La fuente no alcanza para el consumo estimado",
    details: "Consumo estimado 620 W, fuente de 550 W.",
    componentA: "Fuente de poder",
    componentB: "Tarjeta de video",
  },
  {
    code: "RAM_SPEED",
    severity: "warning",
    message: "La RAM funcionará a 5600 MT/s en esta placa",
    componentA: "Memoria RAM",
  },
  { code: "INSUFFICIENT_DATA", severity: "info", message: "Falta el largo del gabinete", componentA: "Gabinete" },
];

export const Validacion: Story = {
  name: "Validación de compatibilidad",
  render: () => (
    <div className="max-w-3xl space-y-6">
      <QuoteValidationStatus status="valid" issues={[issues[2]]} />
      <QuoteValidationStatus status="warning" issues={[issues[1], issues[2]]} />
      <QuoteValidationStatus status="incompatible" issues={issues} />
    </div>
  ),
};

export const Acciones: Story = {
  render: () => (
    <div className="h-48">
      <QuoteActions
        onDelete={noop}
        onExportPDF={noop}
        onExportExcel={noop}
        onCopyClipboard={noop}
        onCheckCompatibility={noop}
      />
    </div>
  ),
};

export const CrearCotizacion: Story = {
  name: "Diálogo para crear cotización",
  render: () => <CreateQuoteDialog trigger={<Button>Nueva cotización</Button>} />,
};
