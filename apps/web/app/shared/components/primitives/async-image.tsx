import { useEffect, useRef, useState } from "react";
import { cn } from "~/shared/lib/utils";
import { getImageUrl, isValidImageUrl } from "~/shared/utils/images";

interface AsyncImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Qué mostrar mientras carga (con `reveal="fade"`). */
  fallback?: React.ReactNode;
  /** Qué mostrar si la imagen no existe o falla. */
  errorFallback?: React.ReactNode;
  /** Candidata a LCP: carga inmediata y con prioridad alta. */
  priority?: boolean;
  /** `fade`: aparece con un fundido. `none`: la animación la hace quien la contiene (ver `onReady`). */
  reveal?: "fade" | "none";
  /** Se llama una vez cuando la imagen está lista; `fromCache` = ya estaba cargada (conviene no animar). */
  onReady?: (fromCache: boolean) => void;
}

type Status = "loading" | "loaded" | "cached" | "error";

/**
 * `<img>` con estados de carga y error. Una imagen que ya estaba en caché (o que cargó antes de hidratar) se muestra
 * sin animación, así volver a una página no repite el efecto en cada tarjeta.
 */
export function AsyncImage({
  src,
  alt,
  className,
  fallback,
  errorFallback,
  priority = false,
  reveal = "fade",
  onReady,
  loading,
  decoding = "async",
  ...props
}: AsyncImageProps) {
  const imageSrc = src ? getImageUrl(src) : src;
  const [status, setStatus] = useState<Status>("loading");
  const prevSrcRef = useRef(imageSrc);
  const imgRef = useRef<HTMLImageElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  if (prevSrcRef.current !== imageSrc) {
    prevSrcRef.current = imageSrc;
    setStatus("loading");
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: se revisa cada vez que cambia la imagen
  useEffect(() => {
    const img = imgRef.current;
    if (!img?.complete) return;
    if (img.naturalWidth === 0) return setStatus("error");
    setStatus("cached");
    onReadyRef.current?.(true);
  }, [imageSrc]);

  if (!isValidImageUrl(src) || status === "error") {
    return (
      <div className={cn("flex size-full items-center justify-center text-muted-foreground", className)}>
        {errorFallback ?? <span className="text-xs">Sin imagen</span>}
      </div>
    );
  }

  const fade = reveal === "fade";
  return (
    <>
      {fade && status === "loading" && fallback && <div className="absolute inset-0">{fallback}</div>}
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        loading={priority ? "eager" : (loading ?? "lazy")}
        decoding={decoding}
        fetchPriority={priority ? "high" : "auto"}
        className={cn(
          className,
          fade && status === "loading" && "opacity-0",
          fade && status === "loaded" && "transition-opacity duration-300",
        )}
        onLoad={(e) => {
          if (status !== "loading") return;
          setStatus("loaded");
          // `load` llega antes de decodificar: sin esperar, la animación arranca y la foto se pinta un cuadro tarde.
          e.currentTarget
            .decode()
            .catch(() => {})
            .then(() => onReadyRef.current?.(false));
        }}
        onError={() => setStatus("error")}
        {...props}
      />
    </>
  );
}
