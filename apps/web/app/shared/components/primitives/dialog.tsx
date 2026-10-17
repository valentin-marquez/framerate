"use client";
import { IconX } from "@tabler/icons-react";
import React, { createContext, use, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePreventScroll } from "~/shared/hooks/use-prevent-scroll";
import { cn } from "~/shared/lib/utils";

const DialogContext = createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  ids: {
    dialog: string;
    title: string;
    description: string;
  };
  handleTrigger: () => void;
} | null>(null);

export type DialogProps = {
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
};

function Dialog({ children, defaultOpen, onOpenChange, open }: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen || false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isOpen = open !== undefined ? open : uncontrolledOpen;

  // prevent scroll when dialog is open on iOS
  usePreventScroll({
    isDisabled: !isOpen,
  });

  const setIsOpen = React.useCallback(
    (value: boolean) => {
      setUncontrolledOpen(value);
      onOpenChange?.(value);
    },
    [onOpenChange],
  );

  // react-doctor-disable-next-line prefer-use-effect-event -- useEffectEvent is types-only in React 19.1 stable; effect re-runs on isOpen change for body-class management anyway
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }

    // Listener inline: el effect ya re-corre en cada cambio de isOpen para gestionar
    // la clase del body, así que re-suscribir no agrega trabajo y nos evita el hook
    // experimental useEffectEvent.
    const handleCancel = (e: Event) => {
      e.preventDefault();
      if (isOpen) {
        setIsOpen(false);
      }
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      document.body.classList.remove("overflow-hidden");
    };
  }, [isOpen, setIsOpen]);

  useEffect(() => {
    // Si se reabre mientras sale, el <dialog> sigue abierto y showModal() lanzaría un error.
    if (isOpen && dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }, [isOpen]);

  const handleTrigger = () => {
    setIsOpen(true);
  };

  const baseId = useId();
  const ids = {
    dialog: `motion-ui-dialog-${baseId}`,
    title: `motion-ui-dialog-title-${baseId}`,
    description: `motion-ui-dialog-description-${baseId}`,
  };

  return (
    <DialogContext.Provider
      value={{
        isOpen,
        setIsOpen,
        dialogRef,
        ids,
        handleTrigger,
      }}
    >
      {children}
    </DialogContext.Provider>
  );
}

export type DialogTriggerProps = {
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
};

function DialogTrigger({ children, className, asChild }: DialogTriggerProps) {
  const context = use(DialogContext);
  if (!context) throw new Error("DialogTrigger must be used within Dialog");

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{
      onClick?: (e: React.MouseEvent) => void;
      className?: string;
    }>;
    const childOnClick = child.props.onClick;
    return React.cloneElement(child, {
      onClick: (e: React.MouseEvent) => {
        childOnClick?.(e);
        if (!e.defaultPrevented) context.handleTrigger();
      },
      className: cn(child.props.className, className),
    });
  }

  return (
    <button
      type="button"
      onClick={context.handleTrigger}
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium",
        "transition-colors focus-visible:ring-2 focus-visible:outline-hidden",
        "focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export type DialogPortalProps = {
  children: React.ReactNode;
  container?: HTMLElement | null;
};

// useSyncExternalStore: detecta cliente sin un useEffect+useState que provoque
// re-renders extra — sirve para diferir el portal hasta la hidratación.
const portalSubscribeNoop = () => () => {};
const portalGetSnapshot = () => true;
const portalGetServerSnapshot = () => false;

function DialogPortal({
  children,
  container = typeof window !== "undefined" ? document.body : null,
}: DialogPortalProps) {
  const mounted = useSyncExternalStore(portalSubscribeNoop, portalGetSnapshot, portalGetServerSnapshot);

  if (!mounted) {
    return null;
  }

  const portalContainer = container || (typeof document !== "undefined" ? document.body : null);
  if (!portalContainer) {
    return null;
  }

  return createPortal(children, portalContainer);
}
export type DialogContentProps = {
  children: React.ReactNode;
  className?: string;
  container?: HTMLElement;
};

function DialogContent({ children, className, container }: DialogContentProps) {
  const context = use(DialogContext);
  if (!context) throw new Error("DialogContent must be used within Dialog");
  const { isOpen, setIsOpen, dialogRef, ids } = context;
  // Al cerrar sigue montado hasta que termina la salida.
  const [rendered, setRendered] = useState(isOpen);
  if (isOpen && !rendered) setRendered(true);
  if (!rendered) return null;

  return (
    <DialogPortal container={container}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: el clic es en el velo; con teclado se cierra con Esc */}
      <dialog
        ref={dialogRef}
        id={ids.dialog}
        aria-labelledby={ids.title}
        aria-describedby={ids.description}
        aria-modal="true"
        onClick={(e) => {
          if (e.target === dialogRef.current) {
            setIsOpen(false);
          }
        }}
        onAnimationEnd={(e) => {
          // También llega la del ::backdrop (mismo target, misma duración): la que llegue primero cierra.
          if (e.target !== e.currentTarget || isOpen) return;
          dialogRef.current?.close();
        }}
        // El navegador puede cerrarlo por su cuenta (Esc repetido sin interacción): el estado lo sigue.
        onClose={() => {
          setRendered(false);
          if (isOpen) setIsOpen(false);
        }}
        className={cn(
          "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform rounded-xl border border-border bg-background p-6 shadow-lg",
          "backdrop:bg-black/50 backdrop:opacity-50",
          "open:flex open:flex-col",
          "ease-out fill-mode-forwards backdrop:ease-out backdrop:fill-mode-forwards",
          isOpen
            ? "animate-in fade-in-0 zoom-in-95 duration-base backdrop:animate-in backdrop:fade-in-0 backdrop:duration-base"
            : "animate-out fade-out-0 zoom-out-95 duration-fast backdrop:animate-out backdrop:fade-out-0 backdrop:duration-fast",
          className,
        )}
      >
        <div className="w-full">{children}</div>
      </dialog>
    </DialogPortal>
  );
}

export type DialogHeaderProps = {
  children: React.ReactNode;
  className?: string;
};

function DialogHeader({ children, className }: DialogHeaderProps) {
  return <div className={cn("flex flex-col space-y-1.5", className)}>{children}</div>;
}

export type DialogTitleProps = {
  children: React.ReactNode;
  className?: string;
};

function DialogTitle({ children, className }: DialogTitleProps) {
  const context = use(DialogContext);
  if (!context) throw new Error("DialogTitle must be used within Dialog");

  return (
    <h2 id={context.ids.title} className={cn("text-label-lg text-card-foreground", className)}>
      {children}
    </h2>
  );
}

export type DialogDescriptionProps = {
  children: React.ReactNode;
  className?: string;
};

function DialogDescription({ children, className }: DialogDescriptionProps) {
  const context = use(DialogContext);
  if (!context) throw new Error("DialogDescription must be used within Dialog");

  return (
    <p id={context.ids.description} className={cn("text-sm text-muted-foreground", className)}>
      {children}
    </p>
  );
}

export type DialogFooterProps = {
  className?: string;
  children: React.ReactNode;
};

function DialogFooter({ className, children }: DialogFooterProps) {
  return (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}>{children}</div>
  );
}

export type DialogCloseProps = {
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
};

function DialogClose({ className, children, disabled }: DialogCloseProps) {
  const context = use(DialogContext);
  if (!context) throw new Error("DialogClose must be used within Dialog");

  return (
    <button
      onClick={() => context.setIsOpen(false)}
      type="button"
      aria-label="Cerrar"
      className={cn(
        "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
        className,
      )}
      disabled={disabled}
    >
      {children || <IconX className="size-4" />}
    </button>
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
};
