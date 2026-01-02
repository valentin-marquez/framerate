import { IconDeviceLaptop, IconMoon, IconSun } from "@tabler/icons-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options = [
    { id: "light", icon: IconSun, color: "text-yellow-400", label: "Light" },
    { id: "system", icon: IconDeviceLaptop, color: "text-blue-500", label: "System" },
    { id: "dark", icon: IconMoon, color: "text-purple-400", label: "Dark" },
  ] as const;

  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-background p-1">
      {options.map(({ id, icon: Icon, color, label }) => (
        <button
          key={id}
          type="button"
          className={cn(
            "relative flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground cursor-pointer focus-visible:outline-none",
            theme === id && "text-foreground",
          )}
          onClick={() => setTheme(id)}
          aria-label={label}
        >
          {theme === id && (
            <motion.div
              layoutId="theme-active"
              className="absolute inset-0 rounded-full bg-accent"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <Icon className={cn("relative z-10 h-4 w-4", theme === id ? color : "text-muted-foreground")} />
        </button>
      ))}
    </div>
  );
}
