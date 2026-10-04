"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleReactionAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

/** "Celebrate" on an achievement card is a clap on the winning performance. */
export function CelebrateButton({
  performanceId,
  initialCount,
  initialActive,
  className,
}: {
  performanceId: string;
  initialCount: number;
  initialActive: boolean;
  className?: string;
}) {
  const [state, setState] = useState({ count: initialCount, active: initialActive });
  const [pending, startTransition] = useTransition();

  function celebrate() {
    const before = state;
    setState({ active: !state.active, count: Math.max(0, state.count + (state.active ? -1 : 1)) });
    startTransition(async () => {
      const res = await toggleReactionAction(performanceId, "CLAP");
      if (!res.ok) {
        setState(before);
        toast.error(res.error);
        return;
      }
      setState({ active: res.active, count: res.count });
      if (res.active) toast.success("🎉 Celebration sent!");
    });
  }

  return (
    <button
      type="button"
      onClick={celebrate}
      disabled={pending}
      aria-pressed={state.active}
      className={cn("glass-btn rounded-2xl px-4 py-2.5 text-sm font-black", className)}
    >
      👏 {state.active ? "Celebrated" : "Celebrate!"} {state.count > 0 && `· ${state.count}`}
    </button>
  );
}
