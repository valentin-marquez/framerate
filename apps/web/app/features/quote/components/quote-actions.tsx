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
}

export function QuoteActions({ onExportPDF, onExportExcel, onCopyClipboard }: QuoteActionsProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button className="gap-2" />}>
          <IconDownload size={18} />
          Guardar como
          <IconChevronDown size={16} className="opacity-50" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
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
