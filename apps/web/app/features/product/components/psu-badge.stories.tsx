import type { ProductSummary } from "@framerate/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { toProduct } from "~/features/product/services/adapters";
import { ProductCard } from "./product-card";
import { PsuBadge } from "./psu-badge";

const meta = { title: "Producto/Sello de fuente de poder", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Una historia por nivel: el sello al tamaño de la tarjeta y al doble, sobre la tarjeta y sobre el fondo de la foto. */
const level = (value: string): Story => ({
  render: () => (
    <div className="flex items-end gap-6">
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
        <PsuBadge certification={value} />
        <div className="rounded-xl bg-[var(--product-stage)] p-3">
          <PsuBadge certification={value} />
        </div>
      </div>
      <PsuBadge certification={value} className="h-30 w-auto" />
      <code className="text-muted-foreground text-xs">"{value}"</code>
    </div>
  ),
});

export const PlusWhite = { ...level("white"), name: "80 Plus White" };
export const PlusBronze = { ...level("bronze"), name: "80 Plus Bronze" };
export const PlusSilver = { ...level("silver"), name: "80 Plus Silver" };
export const PlusGold = { ...level("gold"), name: "80 Plus Gold" };
export const PlusPlatinum = { ...level("platinum"), name: "80 Plus Platinum" };
export const PlusTitanium = { ...level("titanium"), name: "80 Plus Titanium" };
export const EtaStandard = { ...level("eta-standard"), name: "Cybenetics ETA Standard" };
export const EtaBronze = { ...level("eta-bronze"), name: "Cybenetics ETA Bronze" };
export const EtaSilver = { ...level("eta-silver"), name: "Cybenetics ETA Silver" };
export const EtaGold = { ...level("eta-gold"), name: "Cybenetics ETA Gold" };
export const EtaPlatinum = { ...level("eta-platinum"), name: "Cybenetics ETA Platinum" };
export const EtaTitanium = { ...level("eta-titanium"), name: "Cybenetics ETA Titanium" };
export const EtaDiamond = { ...level("eta-diamond"), name: "Cybenetics ETA Diamond" };
export const LambdaStandard = { ...level("lambda-standard"), name: "Cybenetics LAMBDA Standard" };
export const LambdaStandardPlus = { ...level("lambda-standard+"), name: "Cybenetics LAMBDA Standard+" };
export const LambdaStandardPlusPlus = { ...level("lambda-standard++"), name: "Cybenetics LAMBDA Standard++" };
export const LambdaAMinus = { ...level("lambda-a-"), name: "Cybenetics LAMBDA A-" };
export const LambdaA = { ...level("lambda-a"), name: "Cybenetics LAMBDA A" };
export const LambdaAPlus = { ...level("lambda-a+"), name: "Cybenetics LAMBDA A+" };
export const LambdaAPlusPlus = { ...level("lambda-a++"), name: "Cybenetics LAMBDA A++" };

const GROUPS = [
  { title: "80 Plus", values: ["white", "bronze", "silver", "gold", "platinum", "titanium"] },
  {
    title: "Cybenetics ETA (eficiencia)",
    values: ["eta-standard", "eta-bronze", "eta-silver", "eta-gold", "eta-platinum", "eta-titanium", "eta-diamond"],
  },
  {
    title: "Cybenetics LAMBDA (ruido)",
    values: [
      "lambda-standard",
      "lambda-standard+",
      "lambda-standard++",
      "lambda-a-",
      "lambda-a",
      "lambda-a+",
      "lambda-a++",
    ],
  },
];

export const TodosLosNiveles: Story = {
  name: "Todos los niveles",
  render: () => (
    <div className="space-y-6">
      {GROUPS.map((g) => (
        <section key={g.title} className="space-y-3">
          <h3 className="font-medium text-sm">{g.title}</h3>
          <div className="flex flex-wrap gap-3">
            {g.values.map((v) => (
              <PsuBadge key={v} certification={v} />
            ))}
          </div>
        </section>
      ))}
      <p className="max-w-md text-muted-foreground text-xs">
        También acepta el texto de la tienda ("80 Plus Gold", "80+ Bronce"). Un valor que no reconoce no dibuja nada.
      </p>
    </div>
  ),
};

const psu = (id: number, name: string, efficiency: string, image: string | null, price: number): ProductSummary => ({
  id,
  slug: `psu-${id}`,
  name,
  brand: name.split(" ")[0] ?? null,
  category: "psu",
  imageUrl: image && `https://dust2.gg/wp-content/uploads/${image}`,
  attributes: { wattage: 850, efficiency },
  bestPrice: price,
  lowestPrice: price,
  offerCount: 5,
  mpn: null,
});

// Productos reales de producción; el valor de `efficiency` es el que entrega la API (Cybenetics aún no lo extrae).
const cards = [
  psu(
    342,
    "Gigabyte GP-UD850GM PG5 V2 850W 80+ Gold",
    "gold",
    "2026/05/new-project-2026-05-25t172207296-0cfdb109-205a-4f6e-9022-44bcd9b21ab1.jpg",
    84_990,
  ),
  psu(
    352,
    "ASUS ROG Strix 1000W Platinum",
    "platinum",
    "2026/03/new-project-2026-03-27t204435723-6cae8ca6-f291-4f15-aa01-5f6cf201c281.jpg",
    189_326,
  ),
  psu(
    372,
    "XPG Pylon 550W 80 Plus Bronze",
    "bronze",
    "2025/10/new-project-14-b4e53a18-2bac-4176-91ee-b62875bf7e01.jpg",
    47_900,
  ),
  psu(901, "Cooler Master MWE 600 V2 80 Plus White", "white", null, 39_990),
  psu(
    902,
    "ASUS ROG Strix 1000W Platinum (simulado con Cybenetics ETA)",
    "eta-platinum",
    "2026/03/new-project-2026-03-27t204435723-6cae8ca6-f291-4f15-aa01-5f6cf201c281.jpg",
    189_326,
  ),
  psu(903, "Fuente sin foto con Cybenetics LAMBDA A+ (simulado)", "lambda-a+", null, 129_990),
].map(toProduct);

export const EnTarjeta: Story = {
  name: "En contexto de tarjeta",
  render: () => (
    <div className="grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  ),
};
