import { Discord, GitHubDark, GitHubLight, Google } from "@ridemountainpig/svgl-react";
import type { Provider, SupabaseClient } from "@supabase/supabase-js";
import { LogIn, X } from "lucide-react";
import type { Transition } from "motion/react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useRef, useState } from "react";
import useMeasure from "react-use-measure";
import { Button } from "./primitives/button";
import useClickOutside from "@/hooks/useClickOutside";
import { cn } from "@/lib/utils";

const transition: Transition = {
  type: "spring",
  bounce: 0.1,
  duration: 0.25,
};

type LoginOption = {
  id: Provider;
  label: string;
  icon: React.ReactNode;
};

const LOGIN_OPTIONS: LoginOption[] = [
  {
    id: "google",
    label: "Entrar con Google",
    icon: <Google className="h-4 w-4" />,
  },
  {
    id: "github",
    label: "Entrar con GitHub",
    icon: (
      <>
        <GitHubLight className="h-4 w-4 dark:hidden" />
        <GitHubDark className="hidden h-4 w-4 dark:block" />
      </>
    ),
  },
  {
    id: "discord",
    label: "Entrar con Discord",
    icon: <Discord className="h-4 w-4" />,
  },
];

interface LoginDropdownProps {
  supabase: SupabaseClient;
}

export function LoginDropdown({ supabase }: LoginDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [contentRef, { height: heightContent }] = useMeasure();
  const [ghostRef, { width: ghostWidth }] = useMeasure();
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => setIsOpen(false));

  const handleLogin = async (provider: Provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) {
      console.error("Error logging in:", error.message);
    }
  };

  return (
    <MotionConfig transition={transition}>
      <div className="relative z-50" ref={ref}>
        <div className="invisible p-1" aria-hidden="true">
          <Button
            ref={ghostRef}
            type="button"
            variant={"outline"}
            className="flex h-9 items-center justify-center gap-2 px-4 text-sm font-medium"
          >
            <LogIn className="h-4 w-4" />
            <span>Entrar</span>
          </Button>
        </div>

        <motion.div
          layout
          initial={false}
          animate={{
            width: isOpen ? 240 : ghostWidth || "auto",
          }}
          className="absolute right-0 top-0 rounded-lg border border-border bg-card shadow-sm overflow-hidden"
          style={{
            borderRadius: 12,
          }}
        >
          {/* Trigger Button - Always at top */}
          <div className="flex justify-end p-1">
            <AnimatePresence mode="popLayout" initial={false}>
              {!isOpen ? (
                <motion.button
                  layoutId="auth-trigger"
                  key="auth-trigger"
                  className={cn(
                    "flex h-9 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors",
                    "hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] cursor-pointer",
                  )}
                  onClick={() => setIsOpen(true)}
                >
                  <motion.span
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>Entrar</span>
                  </motion.span>
                </motion.button>
              ) : (
                <div className="w-full flex items-center justify-between gap-2">
                  <motion.span
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.1, delay: 0.1 }}
                    className="flex h-9 items-center px-2 text-sm font-medium"
                  >
                    Entrar
                  </motion.span>
                  <motion.button
                    layoutId="auth-trigger"
                    key="auth-close"
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors",
                      "hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] cursor-pointer",
                    )}
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </motion.button>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Expandable Content - Expands below the button */}
          <div className="overflow-hidden">
            <AnimatePresence initial={false} mode="sync">
              {isOpen ? (
                <motion.div
                  key="content"
                  initial={{ height: 0 }}
                  animate={{ height: heightContent || 0 }}
                  exit={{ height: 0 }}
                  style={{ width: 240 }}
                >
                  <div ref={contentRef} className="p-3 pt-1">
                    <div className="text-xs font-medium text-muted-foreground mb-3">
                      Elija su proveedor para crear su cuenta o iniciar sesión.
                    </div>
                    <div className="flex flex-col gap-2">
                      {LOGIN_OPTIONS.map((option) => (
                        <Button
                          variant={"outline"}
                          key={option.id}
                          type="button"
                          className="relative flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-accent/70 px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] cursor-pointer"
                          onClick={() => handleLogin(option.id)}
                        >
                          <span>{option.label}</span>
                          {option.icon}
                        </Button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </MotionConfig>
  );
}
