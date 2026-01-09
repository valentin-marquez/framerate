import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { getImageUrl, isValidImageUrl } from "@/utils/images";

interface AsyncImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /**
   * Custom fallback element to show while loading
   */
  fallback?: React.ReactNode;
  /**
   * Custom error element to show if image fails to load
   */
  errorFallback?: React.ReactNode;
  /**
   * Whether to use the API proxy for CDN caching
   * @default true
   */
  useProxy?: boolean;
  /**
   * Whether this image is high priority (LCP candidate)
   * Sets loading="eager" and fetchPriority="high"
   * @default false
   */
  priority?: boolean;
}

export function AsyncImage({
  src,
  alt,
  className,
  fallback,
  errorFallback,
  useProxy = true,
  priority = false,
  loading,
  decoding = "async",
  ...props
}: AsyncImageProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const imgRef = useRef<HTMLImageElement>(null);

  // Transform URL through API proxy for CDN caching
  const imageSrc = useProxy && src ? getImageUrl(src) : src;

  // Determine loading strategy based on priority
  const loadingStrategy = priority ? "eager" : (loading ?? "lazy");

  // biome-ignore lint/correctness/useExhaustiveDependencies: We want to reset on imageSrc change
  useEffect(() => {
    // Reset status when src changes
    setStatus("loading");
  }, [imageSrc]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Check cached state on imageSrc change
  useEffect(() => {
    // Check if image is already loaded (e.g. from cache)
    if (imgRef.current?.complete) {
      if (imgRef.current.naturalWidth === 0) {
        setStatus("error");
      } else {
        setStatus("loaded");
      }
    }
  }, [imageSrc]);

  const handleLoad = () => setStatus("loaded");
  const handleError = () => setStatus("error");

  if (!isValidImageUrl(src)) {
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
          src={imageSrc}
          alt={alt}
          loading={loadingStrategy}
          decoding={decoding}
          fetchPriority={priority ? "high" : "auto"}
          className={cn(
            className,
            "transition-opacity duration-300",
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
