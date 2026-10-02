import { IconAlertOctagon, IconAlertTriangle, IconCircleCheck, IconInfoCircle, IconLoader } from "@tabler/icons-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "~/shared/lib/client";

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <IconCircleCheck className="size-5 animate-in fade-in-0 zoom-in-95 duration-base ease-out" />,
        info: <IconInfoCircle className="size-4" />,
        warning: <IconAlertTriangle className="size-4" />,
        error: <IconAlertOctagon className="size-4" />,
        loading: <IconLoader className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--primary)",
          "--normal-text": "var(--primary-foreground)",
          "--normal-border": "var(--border-border)",
          "--border-radius": "var(--radius-xl)",
          "--success-bg-color": "var(--success)",
          "--min-width": "200px",
        } as React.CSSProperties
      }
      toastOptions={{
        // Sonner fija sus duraciones; sólo se le cambia la curva. En línea porque su CSS no va en capa y gana a Tailwind.
        style: { transitionTimingFunction: "var(--ease-out)" },
        classNames: {
          toast:
            "group toast font-sans text-sm md:text-base group-[.toaster]:bg-primary group-[.toaster]:text-primary-foreground group-[.toaster]:border-border group-[.toaster]:shadow-md min-w-[280px] md:min-w-[400px] p-4 md:p-5 select-none",
          title: "font-semibold text-sm md:text-base text-primary-foreground",
          description: "group-[.toast]:text-muted-foreground text-xs md:text-sm font-normal",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground font-medium text-sm md:text-base px-3 md:px-4",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground font-medium text-sm md:text-base px-3 md:px-4",
          success: "!bg-success !text-success-foreground !border-success",
          error: "!bg-destructive !text-destructive-foreground !border-destructive",
          warning: "!bg-warning !text-warning-foreground !border-warning",
          info: "!bg-info !text-info-foreground !border-info",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
