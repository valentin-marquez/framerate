import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { AsyncImage } from "./primitives/async-image";

interface CategoryBannerProps {
  title: string;
  description?: string;
  imageUrl: string;
  href: string;
  className?: string;
  gradient: string;
}

export function CategoryBanner({ title, description, imageUrl, href, className, gradient }: CategoryBannerProps) {
  return (
    <Link
      to={href}
      className={cn(
        "group relative overflow-hidden rounded-(--radius) p-6 transition-all hover:shadow-xl block shrink-0",
        className,
      )}
    >
      {/* Background Gradient */}
      <div
        className={cn(
          "absolute inset-0 opacity-90 transition-opacity",
          gradient.replace("bg-gradient-to-", "bg-linear-to-"),
        )}
      />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="max-w-[70%]">
          <h3 className="font-display text-xl font-bold text-white md:text-2xl tracking-tight">{title}</h3>
          {description && (
            <p className="mt-2 text-sm font-medium text-white/90 line-clamp-2 font-sans">{description}</p>
          )}
        </div>

        <div className="mt-4">
          <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md transition-colors group-hover:bg-white/30 font-mono">
            Ver productos
            <svg
              className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>

      {/* Image */}
      <div className="absolute bottom-0 right-0 top-0 w-1/2 pointer-events-none">
        <div className="absolute inset-0 z-10 bg-linear-to-r from-black/10 to-transparent" />
        <AsyncImage
          src={imageUrl}
          alt={title}
          className="h-full w-full object-contain object-bottom-right opacity-90 transition-transform duration-500 group-hover:scale-110"
          fallback={<div className="h-full w-full" />}
          errorFallback={<div className="h-full w-full" />}
        />
        {/* Fade mask to blend with background on the left */}
        <div
          className="absolute inset-0 bg-linear-to-r from-current to-transparent"
          style={{ color: "var(--tw-gradient-from)" }}
        />
      </div>
    </Link>
  );
}
