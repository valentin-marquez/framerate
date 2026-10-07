import type { Meta, StoryObj } from "@storybook/react-vite";
import { PERIODS, type Period } from "~/features/product/utils/price-history";
import { ProductView } from "./product-view";
import { cases, type ProductCase } from "./product-view.fixtures";

/** La ficha de producto (#51, la v2 elegida) con los casos que tiene que resolver. */
const meta = {
  title: "Producto/Ficha",
  parameters: { layout: "fullscreen", path: "/producto/asus-dual-radeon-rx-9060-xt-16gb" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const story = (data: ProductCase, name: string, period: Period = PERIODS[0]): Story => ({
  name,
  render: () => <ProductView {...data} period={period} now={Date.now()} />,
});

export const Normal = story(cases.normal, "Con historial y varias tiendas");
export const SeisMeses = story(cases.unaTienda, "6 meses con un mes de datos", PERIODS[2]);
export const SinEspecificaciones = story(cases.sinEspecificaciones, "Sin especificaciones");
export const SinHistorial = story(cases.sinHistorial, "Sin historial");
export const UnaTienda = story(cases.unaTienda, "Una tienda");
export const SinStock = story(cases.sinStock, "Sin stock");
export const Retirado = story(cases.retirado, "Retirado: ninguna tienda lo publica");
