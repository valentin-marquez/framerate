import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "~/shared/components/primitives/button";
import { FeedbackDialog } from "./feedback-dialog";

const meta = { title: "Cuenta/Sugerir traducción" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function Demo({ lang }: { lang: "en" | "arn" }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Sugerir una traducción
      </Button>
      <FeedbackDialog open={open} onOpenChange={setOpen} lang={lang} />
    </>
  );
}

export const Ingles: Story = { name: "Diálogo: inglés", render: () => <Demo lang="en" /> };

export const Mapudungun: Story = { name: "Diálogo: mapudungun", render: () => <Demo lang="arn" /> };
