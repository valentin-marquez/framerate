import type { CategoryItem } from "@framerate/contracts";
import { useEffect, useReducer, useRef, useState } from "react";
import { Link } from "react-router";
import { useUser } from "~/features/auth/hooks/useAuth";
import { CreateQuoteDialog } from "~/features/quote/components/create-quote-dialog";
import { Logo } from "~/shared/components/layout/logo";
import { NavCategories, NavFps, NavSearch } from "~/shared/components/layout/nav-parts";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cn } from "~/shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip";
import { UserMenu } from "./user-menu";

interface NavbarProps {
  categories: CategoryItem[];
  blurred?: boolean;
}

type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

const GRADIENTS: Record<TimeOfDay, string> = {
  morning: "linear-gradient(rgba(255, 183, 77, 0.2) 0%, rgba(255, 213, 79, 0.1) 50%, rgba(249, 230, 203, 0) 100%)",
  afternoon: "linear-gradient(rgba(126, 60, 142, 0.2) 0%, rgba(227, 154, 101, 0.1) 50%, rgba(249, 230, 203, 0) 100%)",
  evening: "linear-gradient(rgba(255, 87, 34, 0.2) 0%, rgba(233, 30, 99, 0.1) 50%, rgba(249, 230, 203, 0) 100%)",
  night: "linear-gradient(rgba(63, 81, 181, 0.2) 0%, rgba(48, 63, 159, 0.1) 50%, rgba(26, 35, 126, 0) 100%)",
};

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 21) return "evening";
  return "night";
}

const GRADIENT_FADE_MS = 700;

// --- Reducer para colapsar el grupo de estados time-of-day / greeting / gradient.
// Antes había 5 useState que se actualizaban en cascada dentro de un mismo useEffect,
// generando renders redundantes. Ahora cada transición es un único dispatch atómico.

type NavState = {
  timeOfDay: TimeOfDay;
  greetingMessage: string;
  showGreeting: boolean;
  visibleGradient: string;
  gradientVisible: boolean;
};

type NavAction =
  | { type: "tick"; timeOfDay: TimeOfDay; greeting: string }
  | { type: "show-greeting" }
  | { type: "hide-greeting" }
  | { type: "gradient-replace"; target: string; visible: boolean }
  | { type: "gradient-fade-out" }
  | { type: "gradient-fade-in"; visible: boolean };

const initialNavState: NavState = {
  timeOfDay: "afternoon",
  greetingMessage: "",
  showGreeting: false,
  visibleGradient: "transparent",
  gradientVisible: false,
};

function navReducer(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case "tick":
      return { ...state, timeOfDay: action.timeOfDay, greetingMessage: action.greeting };
    case "show-greeting":
      return state.showGreeting ? state : { ...state, showGreeting: true };
    case "hide-greeting":
      return state.showGreeting ? { ...state, showGreeting: false } : state;
    case "gradient-replace":
      return { ...state, visibleGradient: action.target, gradientVisible: action.visible };
    case "gradient-fade-out":
      return state.gradientVisible ? { ...state, gradientVisible: false } : state;
    case "gradient-fade-in":
      return state.gradientVisible === action.visible ? state : { ...state, gradientVisible: action.visible };
    default:
      return state;
  }
}

export function Navbar({ categories, blurred }: NavbarProps) {
  const user = useUser();
  const { t } = useTranslation();
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const [state, dispatch] = useReducer(navReducer, initialNavState);
  const { timeOfDay, greetingMessage, showGreeting, visibleGradient, gradientVisible } = state;

  // mantenemos en ref el `t` actual para que el setInterval no se recree en cada
  // cambio de idioma sin perder el último traductor disponible.
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    const tick = () => {
      const newTimeOfDay = getTimeOfDay();
      const randomIndex = Math.floor(Math.random() * 5) + 1;
      dispatch({
        type: "tick",
        timeOfDay: newTimeOfDay,
        greeting: tRef.current(`greeting_${newTimeOfDay}_${randomIndex}`),
      });
    };

    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const target = GRADIENTS[timeOfDay] ?? "transparent";
    let fadeOutTimer: number | undefined;
    let fadeInTimer: number | undefined;

    if (visibleGradient === "transparent" && !gradientVisible) {
      dispatch({ type: "gradient-replace", target, visible: false });
      fadeInTimer = window.setTimeout(() => dispatch({ type: "gradient-fade-in", visible: true }), 50);
      return () => {
        if (fadeInTimer) clearTimeout(fadeInTimer);
      };
    }

    if (visibleGradient === target) {
      dispatch({ type: "gradient-fade-in", visible: true });
      return;
    }

    dispatch({ type: "gradient-fade-out" });
    fadeOutTimer = window.setTimeout(() => {
      dispatch({ type: "gradient-replace", target, visible: false });
      fadeInTimer = window.setTimeout(() => dispatch({ type: "gradient-fade-in", visible: true }), 50);
    }, GRADIENT_FADE_MS);

    return () => {
      if (fadeOutTimer) clearTimeout(fadeOutTimer);
      if (fadeInTimer) clearTimeout(fadeInTimer);
    };
  }, [timeOfDay, gradientVisible, visibleGradient]);

  // mostrar mensaje despues de que la pagina haya cargado completamente
  useEffect(() => {
    const SHOW_DELAY = 500;
    const VISIBLE_MS = 12000;

    const showSequence = () => {
      const showTimer = setTimeout(() => dispatch({ type: "show-greeting" }), SHOW_DELAY);
      const hideTimer = setTimeout(() => dispatch({ type: "hide-greeting" }), SHOW_DELAY + VISIBLE_MS);

      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    };

    if (document.readyState === "complete") {
      const cleanup = showSequence();
      return cleanup;
    } else {
      let cleanupFn: (() => void) | undefined;
      const handleLoad = () => {
        cleanupFn = showSequence();
      };

      window.addEventListener("load", handleLoad);
      return () => {
        window.removeEventListener("load", handleLoad);
        if (cleanupFn) cleanupFn();
      };
    }
  }, []);

  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          "fixed left-0 right-0 top-0 pointer-events-none -z-10 h-50 transition-opacity duration-700 ease-in-out",
          gradientVisible ? "opacity-100" : "opacity-0",
        )}
        style={{
          background: visibleGradient,
        }}
      />

      <nav
        className={cn(
          "w-full border-b transition-colors duration-300",
          // Al hacer scroll deja de ser transparente y pasa a una superficie sólida.
          blurred ? "bg-background/90 backdrop-blur-md border-border" : "border-transparent",
        )}
      >
        <div className="flex h-13 items-center gap-3 px-4 md:gap-6">
          <Tooltip open={showGreeting}>
            <TooltipTrigger
              render={
                <Link
                  to="/"
                  className="flex shrink-0 items-center group focus:outline-none"
                  onMouseEnter={() => setIsLogoHovered(true)}
                  onMouseLeave={() => setIsLogoHovered(false)}
                  prefetch="intent"
                />
              }
            >
              <Logo
                className="size-5 md:size-6 text-muted-foreground group-hover:text-foreground group-focus:text-foreground transition-colors duration-300 group-hover:duration-200 ease-in-out delay-200 group-hover:delay-75"
                isHovered={isLogoHovered}
              />
              <span className="sr-only">Framerate</span>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8} className="max-w-70 md:max-w-none text-center">
              {greetingMessage}
            </TooltipContent>
          </Tooltip>

          <NavSearch className="mx-auto max-w-2xl flex-1" />

          <div className="flex shrink-0 items-center gap-4">
            <NavFps className="hidden lg:inline-block" />
            {user ? (
              <CreateQuoteDialog
                trigger={
                  <button
                    type="button"
                    className="hidden cursor-pointer font-medium text-foreground/60 text-sm transition-colors hover:text-foreground sm:block"
                  >
                    {t("create_quote")}
                  </button>
                }
              />
            ) : null}

            <UserMenu />
          </div>
        </div>

        <NavCategories categories={categories} />
      </nav>
    </>
  );
}
