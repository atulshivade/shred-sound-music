"use client";

import { useState, useTransition, useOptimistic } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { togglePerformanceLikeAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

type Props = {
  performanceId: string;
  initialLikesCount: number;
  initialLikedByMe: boolean;
  /** When false, render a read-only icon (e.g. for unauthenticated users). */
  enabled?: boolean;
};

/**
 * Optimistic like toggle. Renders a heart + count; on click flips the
 * optimistic state immediately, then reconciles with the server response.
 * On error, snaps back and surfaces a toast.
 */
export function LikeButton({
  performanceId,
  initialLikesCount,
  initialLikedByMe,
  enabled = true,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Server-truth state (updated when the action returns).
  const [serverState, setServerState] = useState({
    liked: initialLikedByMe,
    count: initialLikesCount,
  });

  // Optimistic mirror — flips immediately on click.
  const [optimistic, applyOptimistic] = useOptimistic(
    serverState,
    (current, next: { liked: boolean; count: number }) => next,
  );

  function onClick() {
    if (!enabled || pending) {
      if (!enabled) toast.message("Sign in to like a performance");
      return;
    }
    const next = {
      liked: !optimistic.liked,
      count: optimistic.count + (optimistic.liked ? -1 : 1),
    };
    startTransition(async () => {
      applyOptimistic(next);
      const res = await togglePerformanceLikeAction(performanceId);
      if (!res.ok) {
        toast.error(res.error);
        // useOptimistic auto-resets to serverState when the transition ends,
        // so no explicit rollback needed.
        return;
      }
      setServerState({ liked: res.liked, count: res.likesCount });
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled || pending}
      aria-pressed={optimistic.liked}
      aria-label={optimistic.liked ? "Unlike" : "Like"}
      title={enabled ? (optimistic.liked ? "Unlike" : "Like") : "Sign in to like"}
      className={cn(
        "group inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors",
        "hover:bg-muted/60",
        !enabled && "cursor-not-allowed opacity-70",
      )}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      ) : (
        <Heart
          className={cn(
            "h-3.5 w-3.5 transition-transform group-hover:scale-110",
            optimistic.liked
              ? "fill-rose-500 text-rose-500"
              : "text-muted-foreground",
          )}
          strokeWidth={optimistic.liked ? 0 : 2}
        />
      )}
      <span
        className={cn(
          "tabular-nums",
          optimistic.liked ? "text-rose-500" : "text-muted-foreground",
        )}
      >
        {optimistic.count}
      </span>
    </button>
  );
}
