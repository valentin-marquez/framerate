import { IconChevronDown, IconClipboard, IconDownload, IconFileTypeCsv, IconFileTypePdf } from "@tabler/icons-react";
import { Button } from "~/shared/components/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/shared/components/primitives/dropdown-menu";

interface QuoteActionsProps {
  onExportPDF: () => void;
  onExportExcel: () => void;
  onCopyClipboard: () => void;
  /** A todo el ancho, dentro de una tarjeta. */
  block?: boolean;
}

export function QuoteActions({ onExportPDF, onExportExcel, onCopyClipboard, block }: QuoteActionsProps) {
  return (
    <div className={block ? "flex" : "flex flex-col sm:flex-row gap-4 justify-end"}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button size={block ? "lg" : undefined} className={block ? "w-full gap-2" : "gap-2"} />}
        >
          <IconDownload size={18} />
          Guardar como
          <IconChevronDown size={16} className="opacity-50" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align={block ? "center" : "end"}>
          <DropdownMenuItem onClick={onExportPDF}>
            <IconFileTypePdf size={16} />
            <span>PDF</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExportExcel}>
            <IconFileTypeCsv size={16} />
            <span>CSV / Excel</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCopyClipboard}>
            <IconClipboard size={16} />
            <span>Copiar al portapapeles</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
