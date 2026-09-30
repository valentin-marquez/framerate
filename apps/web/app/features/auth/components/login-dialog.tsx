import { IconLogin2 } from "@tabler/icons-react";
import { Link } from "react-router";
import { AuthProvidersList } from "~/features/auth/components/auth-providers-list";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "~/shared/components/primitives/dialog";

interface LoginCardProps {
  /** Path al que volver tras OAuth. Si se omite, AuthProvidersList lo deriva de window.location. */
  returnTo?: string;
  title?: string;
  description?: string;
}

/** Contenido del login: ícono, bienvenida, proveedores y aviso legal. Se usa en el diálogo y en Storybook. */
export function LoginCard({ returnTo, title, description }: LoginCardProps) {
  return (
    <div className="flex flex-col">
      <div className="space-y-4 p-6 pb-5">
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-foreground/70">
          <IconLogin2 className="size-6" stroke={1.5} />
        </span>
        <div className="space-y-1">
          <DialogTitle className="font-semibold text-foreground text-xl">
            {title ?? "Bienvenido a Framerate"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {description ?? "Inicia sesión o crea tu cuenta para guardar cotizaciones y reseñar tiendas."}
          </DialogDescription>
        </div>
        <AuthProvidersList returnTo={returnTo} />
      </div>
      <p className="border-border border-t px-6 py-4 text-muted-foreground text-xs">
        Al continuar aceptas los{" "}
        <Link to="/terms" className="underline underline-offset-2 hover:text-foreground">
          Términos
        </Link>{" "}
        y la{" "}
        <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">
          Privacidad
        </Link>
        .
      </p>
    </div>
  );
}

interface LoginDialogProps extends LoginCardProps {
  /** Botón/elemento que dispara el modal. Se compone con `DialogTrigger asChild`. */
  trigger: React.ReactNode;
}

export function LoginDialog({ trigger, ...card }: LoginDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="w-full max-w-sm overflow-hidden rounded-3xl p-0">
        <LoginCard {...card} />
      </DialogContent>
    </Dialog>
  );
}
