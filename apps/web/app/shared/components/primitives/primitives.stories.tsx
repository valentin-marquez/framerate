import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  IconArrowRight,
  IconCopy,
  IconFilter,
  IconLoader2,
  IconMail,
  IconPlus,
  IconSearch,
  IconStarFilled,
  IconTrash,
} from "@tabler/icons-react";
import { Badge } from "./badge";
import { Button } from "./button";
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "./button-group";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";
import { Input } from "./input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupTextarea } from "./input-group";
import { Label } from "./label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Skeleton } from "./skeleton";
import { Switch } from "./switch";
import { Textarea } from "./textarea";

const meta = { title: "Primitivos/Controles" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const VARIANTS = ["default", "secondary", "outline", "ghost", "destructive", "link"] as const;
const SIZES = ["xs", "sm", "default", "lg", "wider"] as const;
const ICON_SIZES = ["icon-xs", "icon-sm", "icon", "icon-lg"] as const;

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-3">
    <code className="w-24 shrink-0 font-mono text-muted-foreground text-xs">{label}</code>
    {children}
  </div>
);

export const Botones: Story = {
  render: () => (
    <div className="space-y-4">
      {VARIANTS.map((variant) => (
        <Row key={variant} label={variant}>
          {SIZES.map((size) => (
            <Button key={size} variant={variant} size={size}>
              Continuar
            </Button>
          ))}
          {ICON_SIZES.map((size) => (
            <Button key={size} variant={variant} size={size} aria-label="Buscar">
              <IconSearch />
            </Button>
          ))}
        </Row>
      ))}
    </div>
  ),
};

export const BotonesEstados: Story = {
  name: "Botones: estados",
  render: () => (
    <div className="space-y-4">
      <Row label="con ícono">
        <Button>
          <IconPlus data-icon="inline-start" />
          Agregar a cotización
        </Button>
        <Button variant="secondary">
          Ver ofertas
          <IconArrowRight data-icon="inline-end" />
        </Button>
      </Row>
      <Row label="cargando">
        <Button disabled>
          <IconLoader2 className="animate-spin" />
          Guardando…
        </Button>
        <Button variant="secondary" disabled>
          <IconLoader2 className="animate-spin" />
          Verificando…
        </Button>
      </Row>
      <Row label="disabled">
        {VARIANTS.map((variant) => (
          <Button key={variant} variant={variant} disabled>
            {variant}
          </Button>
        ))}
      </Row>
      <Row label="aria-invalid">
        <Button variant="outline" aria-invalid>
          Revisa este campo
        </Button>
      </Row>
    </div>
  ),
};

export const GrupoDeBotones: Story = {
  name: "Grupo de botones",
  render: () => (
    <div className="space-y-4">
      <ButtonGroup>
        <Button variant="outline">Precio</Button>
        <Button variant="outline">Popularidad</Button>
        <Button variant="outline">Nombre</Button>
      </ButtonGroup>
      <ButtonGroup>
        <Button variant="secondary">
          <IconCopy />
          Copiar enlace
        </Button>
        <ButtonGroupSeparator />
        <Button variant="secondary" size="icon" aria-label="Eliminar">
          <IconTrash />
        </Button>
      </ButtonGroup>
      {/* Mismo armado que el campo de usuario en /ajustes. */}
      <ButtonGroup className="w-80">
        <ButtonGroupText>
          <Label htmlFor="sb-username">@</Label>
        </ButtonGroupText>
        <InputGroup className="h-10 w-full">
          <InputGroupInput id="sb-username" placeholder="usuario" defaultValue="ana" />
        </InputGroup>
      </ButtonGroup>
      <ButtonGroup orientation="vertical">
        <Button variant="outline">Arriba</Button>
        <Button variant="outline">Abajo</Button>
      </ButtonGroup>
    </div>
  ),
};

export const Campos: Story = {
  render: () => (
    <div className="grid max-w-md gap-5">
      <div className="grid gap-2">
        <Label htmlFor="sb-email">Correo</Label>
        <Input id="sb-email" type="email" placeholder="tu@correo.cl" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="sb-price">Precio máximo</Label>
        <Input id="sb-price" inputMode="numeric" defaultValue="99999999" aria-invalid />
        <p className="text-destructive text-xs">El máximo no puede ser menor que el mínimo.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="sb-disabled">Dominio</Label>
        <Input id="sb-disabled" defaultValue="tectec.cl" disabled />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="sb-review">Comentario</Label>
        <Textarea id="sb-review" placeholder="Cuéntanos tu experiencia con esta tienda" />
      </div>
      <Textarea placeholder="Texto demasiado largo" aria-invalid defaultValue="Esta reseña supera el máximo." />
    </div>
  ),
};

export const GrupoDeCampo: Story = {
  name: "Grupo de campo",
  render: () => (
    <div className="grid max-w-md gap-4">
      <InputGroup>
        <InputGroupAddon>
          <IconSearch />
        </InputGroupAddon>
        <InputGroupInput placeholder="Busca RTX 4070, Ryzen 7…" />
      </InputGroup>
      <InputGroup>
        <InputGroupInput placeholder="Precio desde" inputMode="numeric" />
        <InputGroupAddon align="inline-end">CLP</InputGroupAddon>
      </InputGroup>
      <InputGroup>
        <InputGroupAddon>
          <IconMail />
        </InputGroupAddon>
        <InputGroupInput placeholder="tu@correo.cl" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton variant="secondary">Enviar</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <InputGroup>
        <InputGroupInput aria-invalid defaultValue="usuario con espacios" />
      </InputGroup>
      <InputGroup>
        <InputGroupTextarea placeholder="Escribe una respuesta visible públicamente…" />
        <InputGroupAddon align="block-end" className="justify-between">
          <span className="text-xs">0/1000</span>
          <InputGroupButton variant="default" size="sm" className="h-7 px-3">
            Publicar
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
};

const SORTS: Record<string, string> = {
  price_asc: "Menor precio",
  price_desc: "Mayor precio",
  popularity: "Más populares",
  name: "Nombre",
};

export const Selector: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-4">
      <Select defaultValue="price_asc">
        <SelectTrigger className="w-44">
          <SelectValue>{(value: string) => SORTS[value] ?? value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(SORTS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select defaultValue="es">
        <SelectTrigger size="sm" className="w-40">
          <SelectValue>{(value: string) => ({ es: "Español", en: "English", arn: "Mapudungun" })[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Idioma</SelectLabel>
            <SelectItem value="es">Español</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectItem value="arn">
            Mapudungun <span className="text-[10px] text-muted-foreground uppercase">beta</span>
          </SelectItem>
        </SelectContent>
      </Select>
      <Select defaultValue="price_asc" disabled>
        <SelectTrigger className="w-44">
          <SelectValue>{(value: string) => SORTS[value] ?? value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="price_asc">Menor precio</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const SelectorAbierto: Story = {
  name: "Selector abierto",
  render: () => (
    <div className="h-64">
      <Select defaultValue="popularity" defaultOpen>
        <SelectTrigger className="w-44">
          <SelectValue>{(value: string) => SORTS[value] ?? value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(SORTS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ),
};

export const Interruptor: Story = {
  render: () => (
    <div className="grid gap-4 text-foreground text-sm">
      <Label className="gap-3">
        <Switch defaultChecked /> Mostrar sólo con stock
      </Label>
      <Label className="gap-3">
        <Switch /> Cotización pública
      </Label>
      <Label className="gap-3">
        <Switch size="sm" defaultChecked /> Tamaño sm
      </Label>
      <Label className="gap-3">
        <Switch disabled defaultChecked /> Deshabilitado
      </Label>
    </div>
  ),
};

export const Insignias: Story = {
  render: () => (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(["default", "secondary", "outline", "destructive", "ghost", "link"] as const).map((variant) => (
          <Badge key={variant} variant={variant}>
            {variant}
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">
          <IconStarFilled data-icon="inline-start" />
          Destacada
        </Badge>
        <Badge variant="secondary">
          <IconFilter data-icon="inline-start" />3 filtros
        </Badge>
        <Badge variant="destructive">Sin stock</Badge>
      </div>
    </div>
  ),
};

export const Tarjeta: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Historial de precios</CardTitle>
          <CardDescription>Mira cuánto costó antes de comprar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader className="border-b">
          <CardTitle>Reseñas</CardTitle>
          <CardDescription>Tamaño sm, con acción y pie.</CardDescription>
          <CardAction>
            <Button size="sm" variant="secondary">
              Escribir
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Todavía no hay reseñas de esta tienda.</p>
        </CardContent>
        <CardFooter className="border-t">
          <Button variant="link" className="px-0">
            Ver todas
          </Button>
        </CardFooter>
      </Card>
    </div>
  ),
};
