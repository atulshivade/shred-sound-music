"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { togglePerformanceLikeAction, toggleReactionAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

type Kind = "HEART" | "CLAP" | "SHRED";

const EMOJI: Record<Kind, string> = { HEART: "❤️", CLAP: "👏", SHRED: "🔥" };
const LABEL: Record<Kind, string> = { HEART: "Love it", CLAP: "Clap", SHRED: "Shred" };

export type ReactionState = {
  likes: number;
  liked: boolean;
  clap: number;
  clapped: boolean;
  shred: number;
  shredded: boolean;
};

export function useReactions(performanceId: string, initial: ReactionState) {
  const [state, setState] = useState(initial);
  const [bounce, setBounce] = useState<Kind | null>(null);
  const [, startTransition] = useTransition();

  function toggle(kind: Kind) {
    const before = state;
    const next = { ...state };
    if (kind === "HEART") {
      next.liked = !state.liked;
      next.likes = Math.max(0, state.likes + (next.liked ? 1 : -1));
    } else if (kind === "CLAP") {
      next.clapped = !state.clapped;
      next.clap = Math.max(0, state.clap + (next.clapped ? 1 : -1));
    } else {
      next.shredded = !state.shredded;
      next.shred = Math.max(0, state.shred + (next.shredded ? 1 : -1));
    }
    setState(next);
    setBounce(kind);
    startTransition(async () => {
      if (kind === "HEART") {
        const res = await togglePerformanceLikeAction(performanceId);
        if (!res.ok) {
          setState(before);
          toast.error(res.error);
        } else {
          setState((s) => ({ ...s, liked: res.liked, likes: res.likesCount }));
        }
        return;
      }
      const res = await toggleReactionAction(performanceId, kind);
      if (!res.ok) {
        setState(before);
        toast.error(res.error);
      } else if (kind === "CLAP") {
        setState((s) => ({ ...s, clapped: res.active, clap: res.count }));
      } else {
        setState((s) => ({ ...s, shredded: res.active, shred: res.count }));
      }
    });
  }

  return { state, toggle, bounce, clearBounce: () => setBounce(null) };
}

function entries(s: ReactionState): { kind: Kind; count: number; active: boolean }[] {
  return [
    { kind: "HEART", count: s.likes, active: s.liked },
    { kind: "CLAP", count: s.clap, active: s.clapped },
    { kind: "SHRED", count: s.shred, active: s.shredded },
  ];
}

/** Horizontal pills under a feed card. */
export function ReactionPills({
  performanceId,
  initial,
  shareUrl,
  shareText,
}: {
  performanceId: string;
  initial: ReactionState;
  shareUrl: string;
  shareText: string;
}) {
  const { state, toggle, bounce, clearBounce } = useReactions(performanceId, initial);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {entries(state).map((e) => (
        <button
          key={e.kind}
          type="button"
          aria-pressed={e.active}
          aria-label={`${LABEL[e.kind]} (${e.count})`}
          onClick={() => toggle(e.kind)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-extrabold transition-colors",
            e.active
              ? "bg-violet-600/30 text-white ring-1 ring-violet-400/60"
              : "bg-white/[0.07] text-zinc-200 hover:bg-white/[0.12]",
          )}
        >
          <span
            aria-hidden
            onAnimationEnd={clearBounce}
            className={cn(bounce === e.kind && "animate-reaction")}
          >
            {EMOJI[e.kind]}
          </span>
          {e.count}
        </button>
      ))}
      <ShareButton
        url={shareUrl}
        text={shareText}
        className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 text-sm font-extrabold text-zinc-200 hover:bg-white/[0.12]"
      >
        <span aria-hidden>↗</span> Share
      </ShareButton>
    </div>
  );
}

/** Vertical rail on the right of a Short. */
export function ReactionRail({
  performanceId,
  initial,
  shareUrl,
  shareText,
}: {
  performanceId: string;
  initial: ReactionState;
  shareUrl: string;
  shareText: string;
}) {
  const { state, toggle, bounce, clearBounce } = useReactions(performanceId, initial);
  return (
    <div className="flex flex-col items-center gap-4">
      {entries(state).map((e) => (
        <button
          key={e.kind}
          type="button"
          aria-pressed={e.active}
          aria-label={`${LABEL[e.kind]} (${e.count})`}
          onClick={() => toggle(e.kind)}
          className="flex flex-col items-center gap-1 text-xs font-extrabold text-white drop-shadow"
        >
          <span
            aria-hidden
            onAnimationEnd={clearBounce}
            className={cn(
              "grid h-11 w-11 place-items-center rounded-full text-xl backdrop-blur",
              e.active ? "bg-violet-600/70" : "bg-black/35",
              bounce === e.kind && "animate-reaction",
            )}
          >
            {EMOJI[e.kind]}
          </span>
          {e.count}
        </button>
      ))}
      <ShareButton
        url={shareUrl}
        text={shareText}
        className="flex flex-col items-center gap-1 text-xs font-extrabold text-white drop-shadow"
      >
        <span aria-hidden className="grid h-11 w-11 place-items-center rounded-full bg-black/35 text-xl backdrop-blur">
          ↗
        </span>
        Share
      </ShareButton>
    </div>
  );
}

/** Native share sheet on phones, copy-link everywhere else. */
export function ShareButton({
  url,
  text,
  className,
  children,
}: {
  url: string;
  text: string;
  className?: string;
  children: React.ReactNode;
}) {
  async function share() {
    const absolute = new URL(url, window.location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({ title: "Shred Sound Music", text, url: absolute });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(absolute);
      toast.success("Link copied — share it with family & friends!");
    } catch {
      toast.error("Could not copy the link");
    }
  }
  return (
    <button type="button" onClick={share} className={className}>
      {children}
    </button>
  );
}
