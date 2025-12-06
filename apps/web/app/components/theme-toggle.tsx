import { Laptop, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { Theme, useTheme } from "remix-themes";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const [theme, setTheme, { definedBy }] = useTheme();

  // System mode is when definedBy is "SYSTEM"
  const isSystemMode = definedBy === "SYSTEM";

  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-background p-1">
      <button
        type="button"
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer",
          !isSystemMode && theme === Theme.LIGHT && "text-foreground",
        )}
        onClick={() => setTheme(Theme.LIGHT)}
        aria-label="Light mode"
      >
        {!isSystemMode && theme === Theme.LIGHT && (
          <motion.div
            layoutId="theme-toggle"
            className="absolute inset-0 rounded-full bg-accent"
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
          />
        )}
        <Sun
          className={cn([
            "relative z-10 h-4 w-4",
            !isSystemMode && theme === Theme.LIGHT ? "text-yellow-400" : "text-muted-foreground",
          ])}
        />
      </button>

      <button
        type="button"
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer",
          isSystemMode && "text-foreground",
        )}
        onClick={() => setTheme(null)}
        aria-label="System mode"
      >
        {isSystemMode && (
          <motion.div
            layoutId="theme-toggle"
            className="absolute inset-0 rounded-full bg-accent"
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
          />
        )}
        <Laptop
          className={cn([
            "relative z-10 h-4 w-4",
            isSystemMode ? "text-blue-500" : "text-muted-foreground",
          ])}
        />
      </button>

      <button
        type="button"
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer",
          !isSystemMode && theme === Theme.DARK && "text-foreground",
        )}
        onClick={() => setTheme(Theme.DARK)}
        aria-label="Dark mode"
      >
        {!isSystemMode && theme === Theme.DARK && (
          <motion.div
            layoutId="theme-toggle"
            className="absolute inset-0 rounded-full bg-accent"
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
          />
        )}
        <Moon
          className={cn([
            "relative z-10 h-4 w-4",
            !isSystemMode && theme === Theme.DARK ? "text-purple-400" : "text-muted-foreground",
          ])}
        />
      </button>
    </div>
  );
}
