import { IconAlertOctagon, IconAlertTriangle, IconCircleCheck, IconInfoCircle, IconLoader } from "@tabler/icons-react";
import { motion } from "motion/react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "~/lib/client";

const SuccessIcon = () => {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
      }}
    >
      <IconCircleCheck className="size-5" />
    </motion.div>
  );
};

const LoadingIcon = () => {
  return (
    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
      <IconLoader className="size-4" />
    </motion.div>
  );
};

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <SuccessIcon />,
        info: <IconInfoCircle className="size-4" />,
        warning: <IconAlertTriangle className="size-4" />,
        error: <IconAlertOctagon className="size-4" />,
        loading: <LoadingIcon />,
      }}
      style={
        {
          "--normal-bg": "var(--primary)",
          "--normal-text": "var(--primary-foreground)",
          "--normal-border": "var(--border-border)",
          "--border-radius": "var(--radius-xl)",
          "--success-bg-color": "var(--success)",
          "--min-width": "200px",
          "--animation-duration": "0.4s",
          "--animation-timing": "cubic-bezier(0.06, 0.71, 0.55, 1)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "group toast font-sans text-sm md:text-base group-[.toaster]:bg-primary group-[.toaster]:text-primary-foreground group-[.toaster]:border-border group-[.toaster]:shadow-md transition animate-[toast-in_0.4s_cubic-bezier(0.06,0.71,0.55,1)_forwards,toast-resize_0.3s_ease-out] min-w-[280px] md:min-w-[400px] p-4 md:p-5 select-none",
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
