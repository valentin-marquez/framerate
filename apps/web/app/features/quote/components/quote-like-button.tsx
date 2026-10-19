import { IconHeart, IconHeartFilled } from "@tabler/icons-react";
import { useTranslation } from "~/shared/hooks/use-translation";
import { cn } from "~/shared/lib/utils";

interface QuoteLikeButtonProps {
  liked: boolean;
  count: number;
  /** Sin sesión o en la propia cotización sólo se ve la cifra. */
  disabled?: boolean;
  /** Por qué no se puede, al pasar el cursor. */
  hint?: string;
  onToggle: () => void;
}

/** El aviso de un me gusta que no se puede dar; sin aviso cuando sí se puede. */
export function useLikeHint(isSignedIn: boolean, isOwner: boolean) {
  const { t } = useTranslation();
  if (isOwner) return t("quote_like_own");
  return isSignedIn ? undefined : t("quote_like_login");
}

export function QuoteLikeButton({ liked, count, disabled, hint, onToggle }: QuoteLikeButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={liked}
      title={disabled ? hint : undefined}
      aria-label={t(liked ? "quote_unlike" : "quote_like")}
      className={cn(
        "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-border/50 px-3 text-sm tabular-nums transition-colors enabled:hover:text-rose-600 disabled:cursor-default dark:enabled:hover:text-rose-400",
        liked ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
      )}
    >
      {liked ? <IconHeartFilled className="size-4" /> : <IconHeart className="size-4" />}
      {count}
    </button>
  );
}
