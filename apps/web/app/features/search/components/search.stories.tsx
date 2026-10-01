import type { Meta, StoryObj } from "@storybook/react-vite";
import { categoryKeys } from "~/shared/lib/query-keys";
import { categories } from "~/shared/storybook/fixtures";
import { withQueryData } from "~/shared/storybook/with-query-data";
import { SearchDialog, SearchTrigger } from "./search-dialog";

/**
 * Hoy sólo la usa la página de cotización (apagada). El buscador del sitio es `MorphSearch`. Para ver resultados de
 * productos hay que escribir: la búsqueda pide a la API, que en Storybook no está.
 */
const meta = {
  title: "Catálogo/Búsqueda rápida",
  decorators: [withQueryData([[categoryKeys.all, categories]])],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Dialogo: Story = { name: "Diálogo abierto", render: () => <SearchDialog open onOpenChange={() => {}} /> };

export const Disparador: Story = {
  name: "Disparador (Ctrl+K)",
  render: () => <SearchTrigger />,
};
