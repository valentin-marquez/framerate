import React from "react";
import { cn } from "~/shared/lib/utils";

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  viewportClassName?: string;
  orientation?: "vertical" | "horizontal" | "both";
}

export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, orientation = "vertical", viewportClassName, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden",
          orientation === "vertical" && "overflow-y-auto",
          orientation === "horizontal" && "overflow-x-auto",
          orientation === "both" && "overflow-auto",
          className,
        )}
        {...props}
      >
        <div className={cn("size-full rounded-[inherit]", viewportClassName)}>{children}</div>
      </div>
    );
  },
);

ScrollArea.displayName = "ScrollArea";
