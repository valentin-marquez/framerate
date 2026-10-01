import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconPhotoOff } from "@tabler/icons-react";
import { getCategoryImage } from "~/features/category/utils/categories";
import { categories } from "~/shared/storybook/fixtures";
import { AsyncImage } from "./async-image";
import { Carousel, CarouselContent, CarouselIndicator, CarouselItem, CarouselNavigation } from "./carousel";
import { Separator } from "./separator";
import { Skeleton } from "./skeleton";

const meta = { title: "Primitivos/Contenido" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const PHOTO = "https://tectec.cl/wp-content/uploads/2025/07/RTX-5060-Asus-Dual_1.png";

const Frame = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <figure className="space-y-2">
    <div className="relative size-40 overflow-hidden rounded-2xl border border-border bg-card">{children}</div>
    <figcaption className="text-center text-muted-foreground text-xs">{label}</figcaption>
  </figure>
);

export const ImagenAsincrona: Story = {
  name: "Imagen asíncrona",
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Frame label="Con fundido">
        <AsyncImage
          src={PHOTO}
          alt="RTX 5060 Asus Dual"
          className="size-full object-contain p-3"
          fallback={<Skeleton className="size-full rounded-none" />}
        />
      </Frame>
      <Frame label="Prioritaria (LCP)">
        <AsyncImage src={PHOTO} alt="RTX 5060 Asus Dual" priority className="size-full object-contain p-3" />
      </Frame>
      <Frame label="Sin URL">
        <AsyncImage src={undefined} alt="" className="size-full" />
      </Frame>
      <Frame label="Falla al cargar">
        <AsyncImage
          src="https://tectec.cl/no-existe.png"
          alt=""
          className="size-full"
          errorFallback={<IconPhotoOff className="size-8 text-muted-foreground/50" />}
        />
      </Frame>
    </div>
  ),
};

export const Esqueletos: Story = {
  render: () => (
    <div className="flex max-w-md items-center gap-4 rounded-2xl border border-border bg-card p-4">
      <Skeleton className="size-16 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-6 w-24" />
      </div>
    </div>
  ),
};

export const Separadores: Story = {
  render: () => (
    <div className="max-w-sm space-y-4 text-foreground text-sm">
      <p>Precio normal</p>
      <Separator />
      <p>Precio con transferencia</p>
      <div className="flex h-5 items-center gap-3 text-muted-foreground">
        <span>8 productos</span>
        <Separator orientation="vertical" />
        <span>3 marcas</span>
        <Separator orientation="vertical" />
        <span>Desde $279.990</span>
      </div>
    </div>
  ),
};

export const Carrusel: Story = {
  render: () => (
    <Carousel className="max-w-3xl">
      <CarouselContent className="-ml-3">
        {categories.map((c) => (
          <CarouselItem key={c.id} className="basis-1/2 pl-3 md:basis-1/3">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
              <img src={getCategoryImage(c.slug)} alt="" className="size-full object-cover" />
              <span className="absolute top-3 left-3 font-medium text-sm text-white">{c.name}</span>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselNavigation alwaysShow className="right-1 left-1 w-auto" classNameButton="shadow-lg" />
      <CarouselIndicator className="bottom-3" />
    </Carousel>
  ),
};
