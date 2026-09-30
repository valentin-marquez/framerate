import { forwardRef } from "react";
import { recordOutboundClick } from "~/shared/services/clicks";
import { buildOutboundUrl, type OutboundSource } from "~/shared/utils/outbound";

export interface OutboundLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  /** URL externa cruda (la guardada en DB). Se decora con utm_* al render. */
  href: string;
  /** Contexto de UI desde donde se origina el click. Usado para utm_campaign + tracking. */
  source: OutboundSource;
  listingId?: string | null;
  storeId?: string | null;
  productId?: string | null;
  /** Si false, sólo se aplica UTM y se omite el registro. Default true. */
  track?: boolean;
}

/**
 * `<a target="_blank">` para outbound a tiendas. Aplica UTM al href y dispara
 * un registro en `outbound_clicks` (best-effort, no bloquea).
 *
 * Drop-in replacement para los `<a target="_blank" rel="noopener noreferrer">`
 * que apuntan a una tienda externa.
 */
export const OutboundLink = forwardRef<HTMLAnchorElement, OutboundLinkProps>(
  ({ href, source, listingId, storeId, productId, track = true, onClick, children, ...rest }, ref) => {
    const decoratedHref = buildOutboundUrl(href, source);

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e);
      if (e.defaultPrevented || !track) return;

      const referrerPath =
        typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined;

      recordOutboundClick({
        source,
        target_url: decoratedHref,
        referrer_path: referrerPath,
        listing_id: listingId ?? null,
        store_id: storeId ?? null,
        product_id: productId ?? null,
      });
    };

    return (
      <a ref={ref} href={decoratedHref} target="_blank" rel="noopener noreferrer" {...rest} onClick={handleClick}>
        {children}
      </a>
    );
  },
);

OutboundLink.displayName = "OutboundLink";
