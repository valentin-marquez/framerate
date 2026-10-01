import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  IconBuildingStore,
  IconClipboard,
  IconCpu,
  IconFileTypeCsv,
  IconFileTypePdf,
  IconLogout,
  IconSettings,
  IconTag,
  IconTrash,
  IconUserCircle,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Toaster } from "./sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const meta = { title: "Primitivos/Superposiciones" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function ConfirmDialog({ defaultOpen }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <IconTrash />
          Eliminar cotización
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>¿Eliminar la cotización?</DialogTitle>
          <DialogDescription>No se puede deshacer. Perderás los componentes que elegiste.</DialogDescription>
        </DialogHeader>
        <DialogClose />
        <DialogFooter className="mt-6 gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => setOpen(false)}>
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const Dialogo: Story = { name: "Diálogo", render: () => <ConfirmDialog /> };

export const DialogoAbierto: Story = { name: "Diálogo abierto", render: () => <ConfirmDialog defaultOpen /> };

function FullMenu() {
  const [inStock, setInStock] = useState(true);
  const [sort, setSort] = useState("price_asc");
  return (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger render={<Button variant="secondary" />}>
        <IconUserCircle />
        Ana
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
          <DropdownMenuItem>
            <IconUserCircle />
            Perfil
            <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <IconSettings />
            Ajustes
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <IconBuildingStore />
            Mis tiendas (ninguna)
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={inStock} onCheckedChange={setInStock}>
          Sólo con stock
        </DropdownMenuCheckboxItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Ordenar por</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
              <DropdownMenuRadioItem value="price_asc">Menor precio</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="price_desc">Mayor precio</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="popularity">Más populares</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <IconLogout />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const MenuDesplegable: Story = {
  name: "Menú desplegable",
  render: () => (
    <div className="h-96">
      <FullMenu />
    </div>
  ),
};

export const MenuDeExportar: Story = {
  name: "Menú desplegable alineado al final",
  render: () => (
    <div className="flex h-56 justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button />}>Guardar como</DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <IconFileTypePdf />
            PDF
          </DropdownMenuItem>
          <DropdownMenuItem>
            <IconFileTypeCsv />
            CSV o Excel
          </DropdownMenuItem>
          <DropdownMenuItem>
            <IconClipboard />
            Copiar al portapapeles
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
};

export const Tooltips: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-6 py-16">
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <Tooltip key={side} defaultOpen={side === "top"}>
          <TooltipTrigger render={<Button variant="secondary" />}>{side}</TooltipTrigger>
          <TooltipContent side={side}>Agrega este producto a una cotización</TooltipContent>
        </Tooltip>
      ))}
    </div>
  ),
};

const CommandBody = () => (
  <>
    <CommandInput placeholder="Buscar productos, categorías…" />
    <CommandList>
      <CommandEmpty>No encontramos resultados.</CommandEmpty>
      <CommandGroup heading="Categorías">
        <CommandItem>
          <IconTag />
          Tarjetas de video
          <span className="ml-auto text-muted-foreground text-xs tabular-nums">128 productos</span>
        </CommandItem>
        <CommandItem>
          <IconCpu />
          Procesadores
          <span className="ml-auto text-muted-foreground text-xs tabular-nums">94 productos</span>
        </CommandItem>
        <CommandItem disabled>
          <IconTag />
          Gabinetes (próximamente)
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Acciones">
        <CommandItem>
          <IconSettings />
          Ajustes
          <CommandShortcut>⌘,</CommandShortcut>
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </>
);

export const PaletaDeComandos: Story = {
  name: "Paleta de comandos",
  render: () => (
    <Command className="max-w-md border border-border">
      <CommandBody />
    </Command>
  ),
};

export const PaletaDeComandosEnDialogo: Story = {
  name: "Paleta de comandos en diálogo",
  render: () => (
    <CommandDialog defaultOpen title="Buscar" description="Busca productos y categorías" showCloseButton>
      <Command className="md:w-120">
        <CommandBody />
      </Command>
    </CommandDialog>
  ),
};

export const Avisos: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Toaster />
      <Button variant="secondary" onClick={() => toast("Reporte enviado. Gracias por ayudarnos a moderar.")}>
        Normal
      </Button>
      <Button variant="secondary" onClick={() => toast.success("Cuenta de Google conectada")}>
        Éxito
      </Button>
      <Button variant="secondary" onClick={() => toast.error("No pudimos guardar los cambios. Intenta de nuevo.")}>
        Error
      </Button>
      <Button variant="secondary" onClick={() => toast.warning("Algunos productos están sin stock")}>
        Advertencia
      </Button>
      <Button variant="secondary" onClick={() => toast.info("Los precios se actualizan cada 6 horas")}>
        Información
      </Button>
      <Button variant="secondary" onClick={() => toast.loading("Verificando el DNS…")}>
        Cargando
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast("Producto agregado", {
            description: "RTX 5060 MSI Shadow 2X en «Mi PC gamer»",
            action: { label: "Ver", onClick: () => {} },
          })
        }
      >
        Con descripción y acción
      </Button>
    </div>
  ),
};
