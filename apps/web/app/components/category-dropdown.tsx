import { ChevronDown, LayoutGrid } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { Link } from "react-router";
import useClickOutside from "../hooks/useClickOutside";
import { getCategoryConfig } from "../utils/categories";
import type { Category } from "../utils/db-types";
import { Button } from "./primitives/button";

interface CategoryDropdownProps {
  categories: Category[];
}

export function CategoryDropdown({ categories }: CategoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => setIsOpen(false));

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-muted-foreground hover:text-foreground"
        onClick={() => setIsOpen(!isOpen)}
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="hidden sm:inline font-medium">Categorías</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full left-0 mt-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-lg shadow-black/5 z-50"
          >
            <div className="flex flex-col gap-0.5">
              {categories?.map((category) => {
                const config = getCategoryConfig(category.slug);
                return (
                  <Link
                    key={category.id}
                    to={`/categorias/${config.urlSlug}`}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    {config.label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
