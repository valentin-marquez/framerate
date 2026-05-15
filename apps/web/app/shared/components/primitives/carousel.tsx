"use client";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { domAnimation, LazyMotion, m, type Transition, useMotionValue } from "motion/react";
import { Children, createContext, type ReactNode, use, useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "~/shared/lib/utils";

export type CarouselContextType = {
  index: number;
  // Acepta valor o updater para evitar `setX(prev + 1)` stale-cierre.
  setIndex: (newIndex: number | ((prev: number) => number)) => void;
  itemsCount: number;
  setItemsCount: (newItemsCount: number) => void;
  visibleItemsCount: number;
  setVisibleItemsCount: (newVisibleItemsCount: number) => void;
  disableDrag: boolean;
  // Stable slide ids used to avoid using array index as React keys
  slides: string[];
  registerSlide: (id: string) => void;
  unregisterSlide: (id: string) => void;
};

const CarouselContext = createContext<CarouselContextType | undefined>(undefined);

function useCarousel() {
  const context = use(CarouselContext);
  if (!context) {
    throw new Error("useCarousel must be used within an CarouselProvider");
  }
  return context;
}

export type CarouselProps = {
  children: ReactNode;
  className?: string;
  index?: number;
  onIndexChange?: (newIndex: number) => void;
  disableDrag?: boolean;
};

function Carousel({ children, className, index: externalIndex, onIndexChange, disableDrag = false }: CarouselProps) {
  // Estado inicial uncontrolled — siempre arranca en 0. Si se necesita controlar el
  // índice, pasarlo vía la prop `index` (modo controlado).
  const [internalIndex, setInternalIndex] = useState<number>(0);
  const [itemsCount, setItemsCount] = useState<number>(0);
  const [visibleItemsCount, setVisibleItemsCount] = useState<number>(1);
  const [slides, setSlides] = useState<string[]>([]);

  const isControlled = externalIndex !== undefined;
  const index = isControlled ? externalIndex : internalIndex;

  const setIndex = useCallback(
    (newIndex: number | ((prev: number) => number)) => {
      if (!isControlled) {
        setInternalIndex((prev) => {
          const next = typeof newIndex === "function" ? newIndex(prev) : newIndex;
          onIndexChange?.(next);
          return next;
        });
        return;
      }
      // En modo controlado no tenemos prev local — el dueño del externalIndex lo sabe.
      const next = typeof newIndex === "function" ? newIndex(externalIndex as number) : newIndex;
      onIndexChange?.(next);
    },
    [isControlled, onIndexChange, externalIndex],
  );

  const registerSlide = useCallback((id: string) => {
    setSlides((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const unregisterSlide = useCallback((id: string) => {
    setSlides((prev) => prev.filter((s) => s !== id));
  }, []);

  return (
    <CarouselContext.Provider
      value={{
        index,
        setIndex,
        itemsCount,
        setItemsCount,
        visibleItemsCount,
        setVisibleItemsCount,
        disableDrag,
        slides,
        registerSlide,
        unregisterSlide,
      }}
    >
      <div className={cn("group/hover relative", className)}>
        <div className="overflow-hidden">{children}</div>
      </div>
    </CarouselContext.Provider>
  );
}

export type CarouselNavigationProps = {
  className?: string;
  classNameButton?: string;
  alwaysShow?: boolean;
};

function CarouselNavigation({ className, classNameButton, alwaysShow }: CarouselNavigationProps) {
  const { index, setIndex, itemsCount, visibleItemsCount } = useCarousel();

  return (
    <div
      className={cn(
        "pointer-events-none absolute left-[-12.5%] top-1/2 flex w-[125%] -translate-y-1/2 justify-between px-2",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Previous slide"
        className={cn(
          "pointer-events-auto size-fit rounded-full bg-background border border-border p-2 transition-opacity duration-300 hover:bg-accent hover:text-accent-foreground cursor-pointer",
          alwaysShow ? "opacity-100" : "opacity-0 group-hover/hover:opacity-100",
          alwaysShow ? "disabled:opacity-40" : "group-hover/hover:disabled:opacity-40",
          classNameButton,
        )}
        disabled={index === 0}
        onClick={() => {
          if (index > 0) {
            setIndex((prev) => prev - 1);
          }
        }}
      >
        <IconChevronLeft className="stroke-foreground" size={16} />
      </button>
      <button
        type="button"
        className={cn(
          "pointer-events-auto size-fit rounded-full bg-background border border-border p-2 transition-opacity duration-300 hover:bg-accent hover:text-accent-foreground cursor-pointer",
          alwaysShow ? "opacity-100" : "opacity-0 group-hover/hover:opacity-100",
          alwaysShow ? "disabled:opacity-40" : "group-hover/hover:disabled:opacity-40",
          classNameButton,
        )}
        aria-label="Next slide"
        disabled={index + visibleItemsCount >= itemsCount}
        onClick={() => {
          if (index + visibleItemsCount < itemsCount) {
            setIndex((prev) => prev + 1);
          }
        }}
      >
        <IconChevronRight className="stroke-foreground" size={16} />
      </button>
    </div>
  );
}

export type CarouselIndicatorProps = {
  className?: string;
  classNameButton?: string;
};

function CarouselIndicator({ className, classNameButton }: CarouselIndicatorProps) {
  const { index, slides, setIndex } = useCarousel();
  return (
    <div className={cn("absolute bottom-0 z-10 flex w-full items-center justify-center", className)}>
      <div className="flex gap-x-2">
        {slides.map((id, i) => (
          <button
            key={id}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className={cn(
              "size-2 rounded-full transition-opacity duration-300",
              index === i ? "bg-primary" : "bg-primary/50",
              classNameButton,
            )}
          />
        ))}
      </div>
    </div>
  );
}

export type CarouselContentProps = {
  children: ReactNode;
  className?: string;
  transition?: Transition;
};

function CarouselContent({ children, className, transition }: CarouselContentProps) {
  const { index, setIndex, setItemsCount, disableDrag, setVisibleItemsCount, visibleItemsCount } = useCarousel();
  const dragX = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsLength = Children.count(children);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const updateVisibleCount = () => {
      const container = containerRef.current;
      if (!container) return;
      const parent = container.parentElement;
      if (!parent) return;

      const item = container.firstElementChild as HTMLElement;
      if (!item) return;

      const parentWidth = parent.offsetWidth;
      const itemWidth = item.offsetWidth;

      if (itemWidth > 0) {
        const count = Math.round(parentWidth / itemWidth);
        setVisibleItemsCount(count);
      }
    };

    updateVisibleCount();
    window.addEventListener("resize", updateVisibleCount);
    return () => window.removeEventListener("resize", updateVisibleCount);
  }, [setVisibleItemsCount]);

  useEffect(() => {
    if (!itemsLength) {
      return;
    }

    setItemsCount(itemsLength);
  }, [itemsLength, setItemsCount]);

  const onDragEnd = () => {
    const x = dragX.get();

    if (x <= -10 && index < itemsLength - 1) {
      setIndex((prev) => prev + 1);
    } else if (x >= 10 && index > 0) {
      setIndex((prev) => prev - 1);
    }
  };

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        drag={disableDrag ? false : "x"}
        dragConstraints={
          disableDrag
            ? undefined
            : {
                left: 0,
                right: 0,
              }
        }
        dragMomentum={disableDrag ? undefined : false}
        style={{
          x: disableDrag ? undefined : dragX,
        }}
        animate={{
          translateX: `-${index * (100 / visibleItemsCount)}%`,
        }}
        onDragEnd={disableDrag ? undefined : onDragEnd}
        transition={
          transition || {
            damping: 18,
            stiffness: 90,
            type: "spring",
            duration: 0.2,
          }
        }
        className={cn("flex items-center", !disableDrag && "cursor-grab active:cursor-grabbing", className)}
        ref={containerRef}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}

export type CarouselItemProps = {
  children: ReactNode;
  className?: string;
};

function CarouselItem({ children, className }: CarouselItemProps) {
  const { registerSlide, unregisterSlide } = useCarousel();
  const id = useId();

  useEffect(() => {
    registerSlide(id);
    return () => unregisterSlide(id);
  }, [id, registerSlide, unregisterSlide]);

  return (
    <LazyMotion features={domAnimation}>
      <m.div data-carousel-id={id} className={cn("w-full min-w-0 shrink-0 grow-0 overflow-hidden", className)}>
        {children}
      </m.div>
    </LazyMotion>
  );
}

export { Carousel, CarouselContent, CarouselNavigation, CarouselIndicator, CarouselItem, useCarousel };
