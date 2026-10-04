import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getActiveChallenges, getPublishedPerformances } from "@/lib/queries";
import { challengeProgressMap, getStudentDashboard, type ChallengeProgress } from "@/lib/student-data";
import { difficultyFor, endsInLabel, formatXp, isChallengeOpen } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import { PageHeader, Pill } from "@/components/student/page-header";
import { OpenUploadButton } from "@/components/student/upload-sheet";
import { GRADIENTS } from "@/components/student/visuals";

export const dynamic = "force-dynamic";

const STATUS: Record<ChallengeProgress, { label: string; cta: string }> = {
  NOT_STARTED: { label: "Not Started", cta: "🎬 Start Challenge" },
  SUBMITTED: { label: "⏳ Submitted", cta: "👀 View Submission" },
  APPROVED: { label: "✅ Approved", cta: "👀 View Submission" },
};

export default async function ChallengesPage() {
  const { user } = await requireUser();
  const [challenges, published, dashboard] = await Promise.all([
    getActiveChallenges(),
    getPublishedPerformances(),
    getStudentDashboard(user.id),
  ]);
  const open = challenges.filter((c) => isChallengeOpen(c));
  const progress = challengeProgressMap(dashboard.own);
  const joined = new Map<string, number>();
  for (const p of published) joined.set(p.challenge.id, (joined.get(p.challenge.id) ?? 0) + 1);

  const completed = new Map<string, { title: string; points: number; crowned: boolean }>();
  for (const p of dashboard.own) {
    if (p.status !== "PUBLISHED") continue;
    const prev = completed.get(p.challengeId);
    completed.set(p.challengeId, {
      title: p.challengeTitle,
      points: p.challengePoints,
      crowned: (prev?.crowned ?? false) || p.isBestPerformer,
    });
  }

  const streakDay = Math.min(dashboard.stats.streak, 7);
  const streakPct = Math.round((streakDay / 7) * 100);

  return (
    <>
      <PageHeader title="🏆 Challenges" right={<Pill>⭐ {formatXp(dashboard.stats.xp)} XP</Pill>} />
      <div className="space-y-6 px-4 pt-2">
        <section>
          <h2 className="mb-3 text-lg font-black">Active Challenges</h2>
          {open.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-white/10 px-6 py-8 text-center text-sm text-zinc-400">
              No open challenges right now — your teacher will post one soon! 🎶
            </p>
          ) : (
            <div className="space-y-4">
              {open.map((c, i) => {
                const status = progress[c.id] ?? "NOT_STARTED";
                const diff = difficultyFor(c.skillLevelTarget);
                const count = joined.get(c.id) ?? 0;
                return (
                  <article
                    key={c.id}
                    className={cn("animate-pop-in rounded-3xl p-5 text-white shadow-xl shadow-black/40", GRADIENTS[i % GRADIENTS.length])}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/challenges/${c.id}`} className="text-xl font-black leading-tight hover:underline">
                        {c.title}
                      </Link>
                      <span className="shrink-0 rounded-full bg-black/25 px-2.5 py-1 text-xs font-black">
                        {STATUS[status].label}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-white/85">{c.description}</p>
                    <p className="mt-3 text-sm font-bold">
                      <span aria-label={`${diff.stars} of 3 stars`}>{"⭐".repeat(diff.stars)}</span>{" "}
                      {diff.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white/85">
                      ⏰ {endsInLabel(c.deadline)} · 👥 {count} {count === 1 ? "student" : "students"} · +{c.points} XP for the winner
                    </p>
                    <div className="mt-4">
                      {status === "NOT_STARTED" ? (
                        <OpenUploadButton
                          options={{ challengeId: c.id }}
                          className="glass-btn w-full rounded-2xl py-3 text-sm font-black"
                        >
                          {STATUS[status].cta}
                        </OpenUploadButton>
                      ) : (
                        <Link
                          href={`/challenges/${c.id}`}
                          className="glass-btn block w-full rounded-2xl py-3 text-center text-sm font-black"
                        >
                          {STATUS[status].cta}
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-orange-500/25 bg-[#1f140e] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">🔥 7-Day Practice Challenge</h2>
            <span className="shrink-0 whitespace-nowrap text-sm font-black text-orange-300">Day {streakDay} of 7</span>
          </div>
          <div
            className="mt-3 h-3 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuenow={streakPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="7-day practice progress"
          >
            <div className="grad-sunset h-full rounded-full" style={{ width: `${streakPct}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {Array.from({ length: 7 }, (_, d) => (
              <span
                key={d}
                className={cn(
                  "grid aspect-square place-items-center rounded-xl text-xs font-black",
                  d < streakDay ? "bg-orange-500 text-white" : "bg-white/[0.06] text-zinc-500",
                )}
              >
                {d < streakDay ? "🔥" : d + 1}
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm font-bold text-orange-200">
            {streakDay >= 7
              ? "🎉 You did it — 7 days in a row!"
              : streakDay === 0
                ? "Practise today to start — log homework on the Learn tab."
                : `Day ${streakDay} — Keep Going!`}
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-black">Completed Challenges</h2>
          {completed.size === 0 ? (
            <p className="text-sm text-zinc-400">Finish your first challenge to see it here. 💪</p>
          ) : (
            <ul className="space-y-2.5">
              {[...completed.entries()].map(([id, c]) => (
                <li key={id}>
                  <Link
                    href={`/challenges/${id}`}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3.5 font-black",
                      c.crowned ? "grad-gold text-[#1a1204]" : "bg-[#17171f] text-white",
                    )}
                  >
                    <span aria-hidden className="text-xl">{c.crowned ? "🏆" : "✅"}</span>
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    <span className="shrink-0 text-sm">{c.crowned ? `+${c.points} XP` : "Completed"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
