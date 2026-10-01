import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ReportButton } from "./report-button";
import { ReportModal } from "./report-modal";

const meta = { title: "Comunidad/Reportes" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Boton: Story = {
  name: "Botón de reporte",
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <ReportButton targetType="comment" targetId="c1" contextLabel="Comentario de matias" />
      <ReportButton targetType="comment" targetId="c1" size="xs" />
      <ReportButton targetType="store_review" targetId="r1" iconOnly />
      <ReportButton targetType="product" targetId="8" variant="secondary" label="Reportar un error de precio" />
    </div>
  ),
};

function OpenModal({ token }: { token?: string }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-muted-foreground text-sm underline">
        Abrir de nuevo
      </button>
      <ReportModal
        open={open}
        onOpenChange={setOpen}
        targetType="store_review"
        targetId="r1"
        token={token}
        contextLabel="Reseña de matias"
      />
    </>
  );
}

export const Modal: Story = { name: "Modal de reporte", render: () => <OpenModal token="sesion" /> };
