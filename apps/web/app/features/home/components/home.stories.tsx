import type { Meta, StoryObj } from "@storybook/react-vite";
import { categories, stores } from "~/shared/storybook/fixtures";
import { CategoryMosaic, StoresStrip, ValueProps } from "./home-blocks";

const meta = { title: "Home/Bloques" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Promesas: Story = { render: () => <ValueProps storeCount={2} /> };

export const MosaicoDeCategorias: Story = {
  name: "Mosaico de categorías",
  render: () => <CategoryMosaic categories={categories} />,
};

export const Tiendas: Story = { render: () => <StoresStrip stores={stores} /> };
