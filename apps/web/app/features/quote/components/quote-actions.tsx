import {
  IconChevronDown,
  IconClipboard,
  IconDownload,
  IconFileTypeCsv,
  IconFileTypePdf,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "~/shared/components/primitives/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/shared/components/primitives/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/shared/components/primitives/dropdown-menu";

interface QuoteActionsProps {
  onDelete: () => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  onCopyClipboard: () => void;
  onCheckCompatibility: () => void;
  isDeleting?: boolean;
  isCheckingCompatibility?: boolean;
}

export function QuoteActions({
  onDelete,
  onExportPDF,
  onExportExcel,
  onCopyClipboard,
  onCheckCompatibility,
  isDeleting = false,
  isCheckingCompatibility = false,
}: QuoteActionsProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleDelete = () => {
    onDelete();
    setIsDeleteDialogOpen(false);
  };

  const handleCheckCompatibilityClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    onCheckCompatibility();
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-end">
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive">
            <IconTrash size={18} />
            Eliminar
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Estás seguro?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. La cotización será eliminada permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogClose />
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="link" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Button
        variant="secondary"
        className="gap-2 min-w-60"
        onClick={handleCheckCompatibilityClick}
        disabled={isCheckingCompatibility}
      >
        <IconRefresh size={18} className={isCheckingCompatibility ? "animate-spin" : ""} />
        {isCheckingCompatibility ? "Verificando..." : "Chequear Compatibilidad"}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button className="gap-2">
            <IconDownload size={18} />
            Guardar como
            <IconChevronDown size={16} className="opacity-50" />
          </Button>
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
