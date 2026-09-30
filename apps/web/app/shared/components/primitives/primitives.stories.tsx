import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconSearch } from "@tabler/icons-react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Input } from "./input";
import { Skeleton } from "./skeleton";
import { Switch } from "./switch";
import { Textarea } from "./textarea";

const meta = { title: "Primitivos/Controles" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const VARIANTS = ["default", "secondary", "outline", "ghost", "destructive", "link"] as const;
const SIZES = ["xs", "sm", "default", "lg"] as const;

export const Botones: Story = {
  render: () => (
    <div className="space-y-4">
      {VARIANTS.map((variant) => (
        <div key={variant} className="flex flex-wrap items-center gap-3">
          <code className="w-24 font-mono text-muted-foreground text-xs">{variant}</code>
          {SIZES.map((size) => (
            <Button key={size} variant={variant} size={size}>
              Continuar
            </Button>
          ))}
          <Button variant={variant} size="icon" aria-label="Buscar">
            <IconSearch />
          </Button>
        </div>
      ))}
    </div>
  ),
};

export const Campos: Story = {
  render: () => (
    <div className="grid max-w-md gap-4">
      <Input placeholder="tu@correo.cl" />
      <Input placeholder="Deshabilitado" disabled />
      <Textarea placeholder="Cuéntanos tu experiencia con esta tienda" />
      <div className="flex items-center gap-3 text-foreground text-sm">
        <Switch defaultChecked aria-label="Mostrar sólo con stock" /> Mostrar sólo con stock
      </div>
    </div>
  ),
};

export const Insignias: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(["default", "secondary", "outline", "destructive", "ghost", "link"] as const).map((variant) => (
        <Badge key={variant} variant={variant}>
          {variant}
        </Badge>
      ))}
    </div>
  ),
};

export const Tarjeta: Story = {
  render: () => (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Historial de precios</CardTitle>
        <CardDescription>Mira cuánto costó antes de comprar.</CardDescription>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-24 w-full" />
      </CardContent>
    </Card>
  ),
};
