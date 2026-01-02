import { IconLoader2, IconPhoto, IconSearch, IconTag } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AsyncImage } from "~/components/primitives/async-image";
import { Button } from "~/components/primitives/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "~/components/primitives/command";
import { useCategories } from "~/hooks/useCategories";
import { useQuickSearch } from "~/hooks/useProducts";
import { cn } from "~/lib/utils";
import type { Category } from "~/services/categories";
import { formatCLP } from "~/utils/format";

interface SearchDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Hook personalizado para debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const navigate = useNavigate();
  const [internalOpen, setInternalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const isOpen = open !== undefined ? open : internalOpen;
  const handleSetIsOpen = useCallback(
    (value: boolean) => {
      if (onOpenChange) {
        onOpenChange(value);
      } else {
        setInternalOpen(value);
      }
    },
    [onOpenChange],
  );

  // Debounce para evitar búsquedas excesivas mientras el usuario escribe
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Detectar cuando el usuario está escribiendo
  useEffect(() => {
    if (searchQuery !== debouncedSearchQuery) {
      setIsTyping(true);
    } else {
      setIsTyping(false);
    }
  }, [searchQuery, debouncedSearchQuery]);

  // Usar el hook de búsqueda rápida optimizada
  const { data: products = [], isLoading: isLoadingProducts } = useQuickSearch(
    debouncedSearchQuery,
    8, // Límite de resultados para el autocomplete
  );

  const { data: categories = [] } = useCategories();

  // Keyboard shortcut (Ctrl+K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSetIsOpen(!isOpen);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [isOpen, handleSetIsOpen]);

  const handleSelectProduct = useCallback(
    (productSlug: string) => {
      handleSetIsOpen(false);
      navigate(`/producto/${productSlug}`);
      setSearchQuery("");
    },
    [navigate, handleSetIsOpen],
  );

  const handleSelectCategory = useCallback(
    (categorySlug: string) => {
      handleSetIsOpen(false);
      navigate(`/categoria/${categorySlug}`);
      setSearchQuery("");
    },
    [navigate, handleSetIsOpen],
  );

  // Filter categories based on search
  const filteredCategories = searchQuery
    ? categories.filter((cat: Category) => cat.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : categories.slice(0, 5);

  // Determinar si mostrar el estado de carga
  const showLoading = (isLoadingProducts || isTyping) && debouncedSearchQuery.trim().length >= 2;
  const hasSearchQuery = searchQuery.trim().length >= 2;
  const showProducts = hasSearchQuery && !showLoading && products.length > 0;
  const showCategories = !hasSearchQuery && filteredCategories.length > 0;

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={handleSetIsOpen}
      title="Buscar productos"
      description="Busca productos, categorías y más"
      className="backdrop-blur-md bg-card/85 transition-all duration-300 ease-out"
    >
      <Command
        shouldFilter={false}
        className={cn("w-full transition-all duration-300 ease-out", "md:w-180", showProducts && "md:w-200")}
      >
        <div className="relative">
          <CommandInput
            placeholder="Buscar productos, categorías..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="pr-10"
          />
          {/* Indicador de carga inline */}
          <div
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 transition-all duration-200",
              showLoading ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none",
            )}
          >
            <IconLoader2 className="size-4 text-muted-foreground animate-spin" />
          </div>
        </div>

        <CommandList
          className={cn(
            "transition-all duration-300 ease-out",
            showProducts ? "max-h-128" : showCategories ? "max-h-96" : "max-h-60",
          )}
        >
          <CommandEmpty>
            <div
              className={cn(
                "flex flex-col items-center justify-center py-8 text-center transition-all duration-300",
                showLoading && "py-12",
              )}
            >
              <IconSearch
                className={cn(
                  "size-12 text-muted-foreground/50 mb-3 transition-all duration-300",
                  showLoading && "opacity-50 scale-95",
                )}
              />
              <p className="text-sm text-muted-foreground transition-opacity duration-200">
                {showLoading
                  ? "Buscando..."
                  : hasSearchQuery
                    ? "No se encontraron resultados"
                    : "Escribe para buscar productos"}
              </p>
              {hasSearchQuery && !showLoading && (
                <p className="text-xs text-muted-foreground/70 mt-1 animate-in fade-in duration-300">
                  Intenta con otros términos de búsqueda
                </p>
              )}
            </div>
          </CommandEmpty>

          {showCategories && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <CommandGroup heading="Categorías">
                {filteredCategories.map((category: Category) => (
                  <CommandItem
                    key={category.id}
                    onSelect={() => handleSelectCategory(category.slug)}
                    className="cursor-pointer transition-colors duration-150"
                  >
                    <IconTag className="text-muted-foreground shrink-0" />
                    <span className="line-clamp-1 flex-1">{category.name}</span>
                    {"product_count" in category && category.product_count !== undefined && (
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums shrink-0">
                        {category.product_count} productos
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator className="transition-opacity duration-200" />
            </div>
          )}

          {showProducts && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <CommandGroup heading="Productos">
                {products.map((product, index) => (
                  <CommandItem
                    key={product.id}
                    onSelect={() => handleSelectProduct(product.slug)}
                    className="cursor-pointer transition-all duration-150 hover:scale-[1.01] hover:bg-accent/50 py-3 px-3 gap-3"
                    style={{
                      animationDelay: `${index * 30}ms`,
                      animation: "fadeInUp 200ms ease-out forwards",
                      opacity: 0,
                    }}
                  >
                    {/* Imagen del producto */}
                    <div className="relative size-16 shrink-0 rounded-lg overflow-hidden bg-muted/30 ring-1 ring-border/40 transition-all duration-200 group-hover:ring-primary/40">
                      {product.image_url ? (
                        <AsyncImage
                          src={product.image_url}
                          alt={product.name}
                          className="size-full object-contain p-1.5 transition-transform duration-200 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex items-center justify-center size-full">
                          <IconPhoto className="size-8 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>

                    {/* Información del producto */}
                    <div className="flex flex-col gap-1 flex-1 min-w-0 overflow-hidden">
                      <span className="text-sm font-medium line-clamp-2 leading-snug transition-colors duration-150">
                        {product.name}
                      </span>
                      <span className="text-xs text-muted-foreground line-clamp-1">{product.brand_name}</span>
                    </div>

                    {/* Precio */}
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className="text-base font-semibold tabular-nums transition-colors duration-150">
                        {formatCLP(product.current_price)}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Precio</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          )}
        </CommandList>

        <div className="border-t border-border/50 px-4 py-3 transition-all duration-200">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded-md bg-secondary/30 px-1.5 font-mono text-[10px] font-medium transition-colors duration-150">
                  <span className="text-xs">↑↓</span>
                </kbd>
                <span className="transition-colors duration-150">Navegar</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded-md bg-secondary/30 px-1.5 font-mono text-[10px] font-medium transition-colors duration-150">
                  <span className="text-xs">↵</span>
                </kbd>
                <span className="transition-colors duration-150">Seleccionar</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded-md bg-secondary/30 px-1.5 font-mono text-[10px] font-medium transition-colors duration-150">
                ESC
              </kbd>
              <span className="transition-colors duration-150">Cerrar</span>
            </div>
          </div>
        </div>
      </Command>
    </CommandDialog>
  );
}

export function SearchTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        aria-label="Buscar"
        size="icon"
        className="rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
        onClick={() => setOpen(true)}
      >
        <IconSearch className="size-4 text-muted-foreground transition-colors duration-200" />
      </Button>
      <SearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
