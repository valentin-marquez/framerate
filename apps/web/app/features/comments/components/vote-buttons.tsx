import { IconArrowDown, IconArrowUp } from "@tabler/icons-react";
import { useAuthStore } from "~/features/auth/store/auth";
import { cn } from "~/shared/lib/utils";

interface VoteButtonsProps {
  score: number;
  myVote: -1 | 0 | 1;
  pending?: boolean;
  onVote: (value: -1 | 0 | 1) => void;
  className?: string;
}

/**
 * Reddit-style up/down vote control. `myVote=0` means no vote.
 * Clicking the active button clears the vote (sends 0).
 */
export function VoteButtons({ score, myVote, pending, onVote, className }: VoteButtonsProps) {
  const user = useAuthStore((s) => s.user);
  const isAuthed = !!user;

  const handleUp = () => {
    if (!isAuthed || pending) return;
    onVote(myVote === 1 ? 0 : 1);
  };

  const handleDown = () => {
    if (!isAuthed || pending) return;
    onVote(myVote === -1 ? 0 : -1);
  };

  return (
    <div className={cn("flex flex-col items-center gap-0.5 select-none", className)}>
      <button
        type="button"
        onClick={handleUp}
        disabled={!isAuthed || pending}
        aria-pressed={myVote === 1}
        aria-label="Upvote"
        className={cn(
          "size-7 inline-flex items-center justify-center rounded-md transition-colors",
          myVote === 1
            ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
            : "text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10",
          (!isAuthed || pending) && "opacity-40 cursor-not-allowed hover:bg-transparent",
        )}
      >
        <IconArrowUp className="size-4" />
      </button>
      <span
        className={cn(
          "text-xs font-medium tabular-nums min-w-[1.5rem] text-center",
          myVote === 1 && "text-emerald-600 dark:text-emerald-400",
          myVote === -1 && "text-rose-600 dark:text-rose-400",
          myVote === 0 && "text-foreground",
        )}
      >
        {score}
      </span>
      <button
        type="button"
        onClick={handleDown}
        disabled={!isAuthed || pending}
        aria-pressed={myVote === -1}
        aria-label="Downvote"
        className={cn(
          "size-7 inline-flex items-center justify-center rounded-md transition-colors",
          myVote === -1
            ? "text-rose-600 dark:text-rose-400 bg-rose-500/10"
            : "text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10",
          (!isAuthed || pending) && "opacity-40 cursor-not-allowed hover:bg-transparent",
        )}
      >
        <IconArrowDown className="size-4" />
      </button>
    </div>
  );
}
