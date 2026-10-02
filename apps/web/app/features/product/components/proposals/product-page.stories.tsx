import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentType } from "react";
import { cases, type ProductCase } from "./fixtures";
import { ProductPageV1 } from "./product-page-v1";
import { ProductPageV2 } from "./product-page-v2";
import { ProductPageV3 } from "./product-page-v3";

/** #51: tres propuestas para la ficha de producto, cada una con los casos que tiene que resolver. */
const meta = {
  title: "Producto/Ficha: propuestas",
  parameters: { layout: "fullscreen", path: "/producto/asus-dual-radeon-rx-9060-xt-16gb" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const story = (Page: ComponentType<ProductCase>, data: ProductCase, name: string): Story => ({
  name,
  render: () => <Page {...data} />,
});

export const V1 = story(ProductPageV1, cases.normal, "v1: tabla de tiendas primero");
export const V1SinEspecificaciones = story(ProductPageV1, cases.sinEspecificaciones, "v1: sin especificaciones");
export const V1SinHistorial = story(ProductPageV1, cases.sinHistorial, "v1: sin historial");
export const V1UnaTienda = story(ProductPageV1, cases.unaTienda, "v1: una tienda");
export const V1SinStock = story(ProductPageV1, cases.sinStock, "v1: sin stock");

export const V2 = story(ProductPageV2, cases.normal, "v2: precio con contexto");
export const V2SinEspecificaciones = story(ProductPageV2, cases.sinEspecificaciones, "v2: sin especificaciones");
export const V2SinHistorial = story(ProductPageV2, cases.sinHistorial, "v2: sin historial");
export const V2UnaTienda = story(ProductPageV2, cases.unaTienda, "v2: una tienda");
export const V2SinStock = story(ProductPageV2, cases.sinStock, "v2: sin stock");

export const V3 = story(ProductPageV3, cases.normal, "v3: elige cómo pagas");
export const V3SinEspecificaciones = story(ProductPageV3, cases.sinEspecificaciones, "v3: sin especificaciones");
export const V3SinHistorial = story(ProductPageV3, cases.sinHistorial, "v3: sin historial");
export const V3UnaTienda = story(ProductPageV3, cases.unaTienda, "v3: una tienda");
export const V3SinStock = story(ProductPageV3, cases.sinStock, "v3: sin stock");
