import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AsyncImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /**
   * Custom fallback element to show while loading
   */
  fallback?: React.ReactNode;
  /**
   * Custom error element to show if image fails to load
   */
  errorFallback?: React.ReactNode;
}

export function AsyncImage({ src, alt, className, fallback, errorFallback, ...props }: AsyncImageProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Check if image is already loaded (e.g. from cache)
    if (imgRef.current?.complete) {
      if (imgRef.current.naturalWidth === 0) {
        setStatus("error");
      } else {
        setStatus("loaded");
      }
    }
  }, []);

  const handleLoad = () => setStatus("loaded");
  const handleError = () => setStatus("error");

  if (!src) {
    return (
      <div
        className={cn("flex h-full w-full items-center justify-center bg-muted/30 text-muted-foreground", className)}
      >
        {errorFallback || <span className="text-xs">Sin imagen</span>}
      </div>
    );
  }

  return (
    <>
      {status === "loading" && (
        <div className={cn("absolute inset-0 z-10", className)}>
          {fallback || <div className="h-full w-full bg-muted/30 skeleton-scanner" />}
        </div>
      )}

      {status === "error" ? (
        <div
          className={cn("flex h-full w-full items-center justify-center bg-muted/30 text-muted-foreground", className)}
        >
          {errorFallback || <span className="text-xs">Sin imagen</span>}
        </div>
      ) : (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className={cn(
            className,
            "transition-opacity duration-500",
            status === "loaded" ? "opacity-100" : "opacity-0",
          )}
          onLoad={handleLoad}
          onError={handleError}
          {...props}
        />
      )}
    </>
  );
}
