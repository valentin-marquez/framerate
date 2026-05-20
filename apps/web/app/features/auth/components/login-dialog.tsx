import { AuthProvidersList } from "~/features/auth/components/auth-providers-list";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/shared/components/primitives/dialog";

interface LoginDialogProps {
  /** Botón/elemento que dispara el modal. Se compone con `DialogTrigger asChild`. */
  trigger: React.ReactNode;
  /** Path al que volver tras OAuth. Si se omite, AuthProvidersList lo deriva de window.location. */
  returnTo?: string;
  title?: string;
  description?: string;
}

export function LoginDialog({ trigger, returnTo, title, description }: LoginDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="w-full max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle>{title ?? "Iniciá sesión"}</DialogTitle>
          <DialogDescription>{description ?? "Elegí cómo querés continuar."}</DialogDescription>
        </DialogHeader>
        <AuthProvidersList returnTo={returnTo} />
      </DialogContent>
    </Dialog>
  );
}
