"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { logPracticeAction } from "@/lib/actions";
import { cn } from "@/lib/utils";
import type { Instrument } from "@/db/schema";
import { OpenUploadButton } from "@/components/student/upload-sheet";

export function HomeworkCard({
  id,
  emoji,
  title,
  subtitle,
  due,
  progress,
  doneToday,
  songName,
  instrument,
  lessonUrl,
}: {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  due: { label: string; tone: "urgent" | "ok" | "muted" };
  progress: number;
  doneToday: boolean;
  songName: string;
  instrument: Instrument;
  lessonUrl?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(doneToday);
  const pct = Math.round(progress * 100);

  function markDone() {
    startTransition(async () => {
      const res = await logPracticeAction(id);
      if (!res.ok) {
        toast(res.error);
        return;
      }
      setDone(true);
      toast.success(`Practice logged! +${res.awarded} XP 🔥`);
      router.refresh();
    });
  }

  const btn = "flex-1 rounded-xl py-2.5 text-sm font-extrabold transition-opacity disabled:opacity-50";

  return (
    <article className="animate-pop-in rounded-3xl border border-white/5 bg-[#17171f] p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-2xl">
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-black leading-tight">{title}</h3>
          <p className="mt-0.5 text-sm text-zinc-400">{subtitle}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black",
            due.tone === "urgent" && "bg-rose-500/15 text-rose-300",
            due.tone === "ok" && "bg-lime-500/15 text-lime-300",
            due.tone === "muted" && "bg-white/10 text-zinc-300",
          )}
        >
          {due.label}
        </span>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-xs font-bold text-zinc-400">
          <span>Progress</span>
          <span>{pct}%</span>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${title} progress`}
        >
          <div className="grad-progress h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {lessonUrl ? (
          <a href={lessonUrl} target="_blank" rel="noopener noreferrer" className={cn(btn, "bg-white/10 text-center text-white")}>
            ▶ Watch
          </a>
        ) : (
          <button type="button" disabled className={cn(btn, "bg-white/10 text-white")} title="Your teacher will add a lesson video">
            ▶ Watch
          </button>
        )}
        <button
          type="button"
          onClick={markDone}
          disabled={done || pending}
          className={cn(btn, "bg-lime-500 text-[#0b0b10]")}
        >
          {done ? "✅ Done today" : "✅ Mark Done"}
        </button>
        <OpenUploadButton
          options={{ songName, instrument }}
          className={cn(btn, "grad-sunset text-white")}
        >
          🎬 Submit
        </OpenUploadButton>
      </div>
    </article>
  );
}
