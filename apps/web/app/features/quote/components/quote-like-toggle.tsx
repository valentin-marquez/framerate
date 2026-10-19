import type { PublicQuote } from "@framerate/contracts";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useUser } from "~/features/auth/hooks/useAuth";
import { quotesService } from "~/features/quote/services/quotes";
import { useTranslation } from "~/shared/hooks/use-translation";
import { QuoteLikeButton, useLikeHint } from "./quote-like-button";

/** El me gusta de una cotización dentro de una lista: se ve al instante y vuelve atrás si el servidor falla. */
export function QuoteLikeToggle({ quote }: { quote: Pick<PublicQuote, "id" | "author" | "likeCount" | "likedByMe"> }) {
  const { t } = useTranslation();
  const user = useUser();
  const [state, setState] = useState({ liked: quote.likedByMe, count: quote.likeCount });
  useEffect(() => setState({ liked: quote.likedByMe, count: quote.likeCount }), [quote.likedByMe, quote.likeCount]);
  const isOwner = !!user && user.username === quote.author.username;
  const hint = useLikeHint(!!user, isOwner);

  const toggle = () => {
    const before = state;
    setState({ liked: !before.liked, count: Math.max(0, before.count + (before.liked ? -1 : 1)) });
    (before.liked ? quotesService.unlike(quote.id) : quotesService.like(quote.id)).then(
      (result) => setState({ liked: result.likedByMe, count: result.likeCount }),
      () => {
        setState(before);
        toast.error(t("quote_like_error"));
      },
    );
  };

  return (
    <QuoteLikeButton
      liked={state.liked}
      count={state.count}
      disabled={!user || isOwner}
      hint={hint}
      onToggle={toggle}
    />
  );
}
