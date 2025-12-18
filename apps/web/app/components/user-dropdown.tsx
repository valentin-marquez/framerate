import * as AvatarPrimitive from "@radix-ui/react-avatar";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { FileText, Laptop, LogOut, Moon, Plus, Sun, User as UserIcon, X } from "lucide-react";
import type { Transition } from "motion/react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useRef, useState } from "react";
import useMeasure from "react-use-measure";
import { Theme, useTheme } from "remix-themes";
import useClickOutside from "@/hooks/useClickOutside";
import { cn } from "@/lib/utils";
import { Button } from "./primitives/button";

const transition: Transition = {
  type: "spring",
  bounce: 0.1,
  duration: 0.25,
};

interface UserDropdownProps {
  supabase: SupabaseClient;
  user: User;
}

export function UserDropdown({ supabase, user }: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [contentRef, { height: heightContent }] = useMeasure();
  const [ghostRef, { width: ghostWidth }] = useMeasure();
  const ref = useRef<HTMLDivElement>(null);
  const [theme, setTheme, { definedBy }] = useTheme();

  const isSystemMode = definedBy === "SYSTEM";

  useClickOutside(ref, () => setIsOpen(false));

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <MotionConfig transition={transition}>
      <div className="relative z-50" ref={ref}>
        <div className="invisible p-1" aria-hidden="true">
          <div ref={ghostRef} className="h-9 w-9" />
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
          <div className="flex justify-end p-1">
            <AnimatePresence mode="popLayout" initial={false}>
              {!isOpen ? (
                <motion.button
                  layoutId="user-trigger"
                  key="user-trigger"
                  className={cn(
                    "flex items-center justify-center transition-colors cursor-pointer h-9 w-9 rounded-full hover:opacity-80",
                  )}
                  onClick={() => setIsOpen(true)}
                >
                  <AvatarPrimitive.Root className="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full">
                    <AvatarPrimitive.Image
                      className="aspect-square h-full w-full"
                      src={user.user_metadata.avatar_url}
                      alt={user.email}
                    />
                    <AvatarPrimitive.Fallback className="flex h-full w-full items-center justify-center rounded-full bg-muted">
                      <UserIcon className="h-4 w-4" />
                    </AvatarPrimitive.Fallback>
                  </AvatarPrimitive.Root>
                </motion.button>
              ) : (
                <div className="w-full flex items-center justify-between gap-2">
                  <motion.span
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.1, delay: 0.1 }}
                    className="flex h-9 items-center px-2 text-sm font-medium truncate"
                  >
                    {user.email}
                  </motion.span>
                  <motion.button
                    layoutId="user-trigger"
                    key="user-close"
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
                    <div className="flex flex-col gap-4">
                      {/* Cotizaciones Section */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between px-1">
                          <div className="text-xs font-medium text-muted-foreground">Cotizaciones</div>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button variant={"ghost"} className="justify-start h-8 px-2 text-sm font-normal w-full">
                            <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                            Mi PC Gamer
                          </Button>
                          <Button variant={"ghost"} className="justify-start h-8 px-2 text-sm font-normal w-full">
                            <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                            Workstation
                          </Button>
                        </div>
                      </div>

                      {/* Theme Section */}
                      <div className="flex flex-col gap-2">
                        <div className="text-xs font-medium text-muted-foreground px-1">Tema</div>
                        <div className="flex items-center gap-1 rounded-full border border-border bg-background p-1">
                          <button
                            type="button"
                            className={cn(
                              "relative flex h-8 flex-1 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer",
                              !isSystemMode && theme === Theme.LIGHT && "text-foreground",
                            )}
                            onClick={() => setTheme(Theme.LIGHT)}
                            aria-label="Light mode"
                          >
                            {!isSystemMode && theme === Theme.LIGHT && (
                              <motion.div
                                layoutId="theme-toggle-dropdown"
                                className="absolute inset-0 rounded-full bg-accent"
                                transition={{
                                  type: "spring",
                                  bounce: 0.2,
                                  duration: 0.6,
                                }}
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
                              "relative flex h-8 flex-1 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer",
                              isSystemMode && "text-foreground",
                            )}
                            onClick={() => setTheme(null)}
                            aria-label="System mode"
                          >
                            {isSystemMode && (
                              <motion.div
                                layoutId="theme-toggle-dropdown"
                                className="absolute inset-0 rounded-full bg-accent"
                                transition={{
                                  type: "spring",
                                  bounce: 0.2,
                                  duration: 0.6,
                                }}
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
                              "relative flex h-8 flex-1 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer",
                              !isSystemMode && theme === Theme.DARK && "text-foreground",
                            )}
                            onClick={() => setTheme(Theme.DARK)}
                            aria-label="Dark mode"
                          >
                            {!isSystemMode && theme === Theme.DARK && (
                              <motion.div
                                layoutId="theme-toggle-dropdown"
                                className="absolute inset-0 rounded-full bg-accent"
                                transition={{
                                  type: "spring",
                                  bounce: 0.2,
                                  duration: 0.6,
                                }}
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
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="text-xs font-medium text-muted-foreground px-1">Cuenta</div>
                        <Button
                          variant={"outline"}
                          type="button"
                          className="relative flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-accent/70 px-3 text-sm font-medium text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] cursor-pointer"
                          onClick={handleLogout}
                        >
                          <span>Cerrar sesión</span>
                          <LogOut className="h-4 w-4" />
                        </Button>
                      </div>
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
