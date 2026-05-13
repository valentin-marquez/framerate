"use client";
import { IconX } from "@tabler/icons-react";
import { AnimatePresence, motion, type Transition, type Variants } from "motion/react";
import React, { createContext, useContext, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { usePreventScroll } from "~/shared/hooks/use-prevent-scroll"; // Updated path
import { cn } from "~/shared/lib/utils";

const SheetContext = createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  sheetRef: React.RefObject<HTMLDivElement | null>; // Changed to Div because Dialog element has specific centering
  variants: Variants;
  transition?: Transition;
  ids: {
    sheet: string;
    title: string;
    description: string;
  };
  onAnimationComplete: (definition: string) => void;
  handleTrigger: () => void;
  side: "top" | "bottom" | "left" | "right";
} | null>(null);

const _defaultVariants: Variants = {
  initial: { x: "100%", opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: "100%", opacity: 0 },
};

const defaultTransition: Transition = {
  ease: "easeInOut",
  duration: 0.3,
};

export type SheetProps = {
  children: React.ReactNode;
  variants?: Variants;
  transition?: Transition;
  className?: string;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  side?: "top" | "bottom" | "left" | "right";
};

function Sheet({
  children,
  variants,
  transition = defaultTransition,
  defaultOpen,
  onOpenChange,
  open,
  side = "right",
}: SheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen || false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const isOpen = open !== undefined ? open : uncontrolledOpen;

  // Compute variants based on side if not provided
  const computedVariants = variants || {
    initial: {
      x: side === "right" ? "100%" : side === "left" ? "-100%" : 0,
      y: side === "bottom" ? "100%" : side === "top" ? "-100%" : 0,
      opacity: 0,
    },
    animate: { x: 0, y: 0, opacity: 1 },
    exit: {
      x: side === "right" ? "100%" : side === "left" ? "-100%" : 0,
      y: side === "bottom" ? "100%" : side === "top" ? "-100%" : 0,
      opacity: 0,
    },
  };

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

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
  }, [isOpen]);

  const handleTrigger = () => {
    setIsOpen(true);
  };

  const onAnimationComplete = (_definition: string) => {
    // any cleanup
  };

  const baseId = useId();
  const ids = {
    sheet: `motion-ui-sheet-${baseId}`,
    title: `motion-ui-sheet-title-${baseId}`,
    description: `motion-ui-sheet-description-${baseId}`,
  };

  return (
    <SheetContext.Provider
      value={{
        isOpen,
        setIsOpen,
        sheetRef,
        variants: computedVariants,
        transition,
        ids,
        onAnimationComplete,
        handleTrigger,
        side,
      }}
    >
      {children}
    </SheetContext.Provider>
  );
}

export type SheetTriggerProps = {
  children: React.ReactNode;
  className?: string;
};

function SheetTrigger({ children, className }: SheetTriggerProps) {
  const context = useContext(SheetContext);
  if (!context) throw new Error("SheetTrigger must be used within Sheet");

  return (
    <button type="button" onClick={context.handleTrigger} className={cn(className)}>
      {children}
    </button>
  );
}

export type SheetPortalProps = {
  children: React.ReactNode;
  container?: HTMLElement | null;
};

function SheetPortal({ children, container = typeof window !== "undefined" ? document.body : null }: SheetPortalProps) {
  const [mounted, setMounted] = React.useState(false);
  const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setPortalContainer(container || document.body);
    return () => setMounted(false);
  }, [container]);

  if (!mounted || !portalContainer) return null;
  return createPortal(children, portalContainer);
}

export type SheetContentProps = {
  children: React.ReactNode;
  className?: string;
  container?: HTMLElement;
};

function SheetContent({ children, className, container }: SheetContentProps) {
  const context = useContext(SheetContext);
  if (!context) throw new Error("SheetContent must be used within Sheet");
  const { isOpen, setIsOpen, sheetRef, variants, transition, ids, onAnimationComplete, side } = context;

  const content = (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            key={ids.sheet}
            ref={sheetRef}
            id={ids.sheet}
            role="dialog"
            aria-modal="true"
            initial="initial"
            animate="animate"
            exit="exit"
            variants={variants}
            transition={transition}
            onAnimationComplete={onAnimationComplete}
            className={cn(
              "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
              side === "right" && "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
              side === "left" && "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
              side === "top" && "inset-x-0 top-0 border-b",
              side === "bottom" && "inset-x-0 bottom-0 border-t",
              className,
            )}
          >
            {children}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary"
            >
              <IconX className="size-4" />
              <span className="sr-only">Close</span>
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return <SheetPortal container={container}>{content}</SheetPortal>;
}

export type SheetHeaderProps = {
  children: React.ReactNode;
  className?: string;
};

function SheetHeader({ children, className }: SheetHeaderProps) {
  return <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)}>{children}</div>;
}

export type SheetTitleProps = {
  children: React.ReactNode;
  className?: string;
};

function SheetTitle({ children, className }: SheetTitleProps) {
  const context = useContext(SheetContext);
  return (
    <h2 id={context?.ids.title} className={cn("text-lg font-semibold text-foreground", className)}>
      {children}
    </h2>
  );
}

export type SheetDescriptionProps = {
  children: React.ReactNode;
  className?: string;
};

function SheetDescription({ children, className }: SheetDescriptionProps) {
  const context = useContext(SheetContext);
  return (
    <p id={context?.ids.description} className={cn("text-sm text-muted-foreground", className)}>
      {children}
    </p>
  );
}

export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription };
