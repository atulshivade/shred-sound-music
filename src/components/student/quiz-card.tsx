"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { answerQuizAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

type QuizView = { id: string; prompt: string; clue: string; options: readonly string[] };

export function QuizCard({
  quiz,
  played,
  reward,
}: {
  quiz: QuizView;
  /** Today's earlier result, if the student already played. */
  played: { correct: boolean } | null;
  reward: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<{ correct: boolean; answer: string } | null>(null);
  const done = played != null || result != null;

  function choose(option: string) {
    if (done || pending) return;
    setPicked(option);
    startTransition(async () => {
      const res = await answerQuizAction(quiz.id, option);
      if (!res.ok) {
        toast.error(res.error);
        setPicked(null);
        return;
      }
      setResult({ correct: res.correct, answer: res.answer });
      if (res.correct) toast.success(`Correct! +${res.awarded} XP ⭐`);
      else toast(`So close! It was “${res.answer}” 🎵`);
      router.refresh();
    });
  }

  return (
    <section className="animate-pop-in rounded-3xl border border-white/5 bg-[#17171f] p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-black">{quiz.prompt}</h3>
        <span className="shrink-0 rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-black text-amber-300">
          +{reward} XP if correct
        </span>
      </div>
      <p className="mt-2 text-sm text-zinc-400">Which song starts with these notes?</p>
      <p className="mt-3 rounded-2xl bg-violet-500/10 px-4 py-3 text-center font-mono text-lg font-bold tracking-wider text-violet-200">
        {quiz.clue}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {quiz.options.map((option) => {
          const isAnswer = result?.answer === option;
          const isWrongPick = result && picked === option && !result.correct;
          return (
            <button
              key={option}
              type="button"
              disabled={done || pending}
              onClick={() => choose(option)}
              className={cn(
                "rounded-2xl border px-3 py-3 text-sm font-extrabold transition-colors",
                isAnswer
                  ? "border-lime-400 bg-lime-500/20 text-lime-200"
                  : isWrongPick
                    ? "border-rose-400 bg-rose-500/20 text-rose-200"
                    : picked === option
                      ? "border-violet-400 bg-violet-500/20"
                      : "border-white/10 bg-[#23232f] hover:border-violet-400/60 disabled:opacity-60",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
      {played && !result && (
        <p className="mt-3 text-center text-sm font-bold text-zinc-400">
          {played.correct ? "✅ You nailed today's quiz!" : "You played today's quiz"} — a new one
          arrives tomorrow.
        </p>
      )}
    </section>
  );
}
