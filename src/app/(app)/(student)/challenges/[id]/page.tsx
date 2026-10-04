import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { challenges, performances, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getReactionCounts, getViewerReactions } from "@/lib/student-data";
import { difficultyFor, endsInLabel, isChallengeOpen } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/student/page-header";
import { FeedVideoCard } from "@/components/student/feed-video-card";
import { OpenUploadButton } from "@/components/student/upload-sheet";
import { gradientFor, instrumentEmoji, instrumentShort } from "@/components/student/visuals";

export const dynamic = "force-dynamic";

const STATUS_BADGE = { PENDING: "⏳ Waiting for teacher", REJECTED: "💬 Needs another take" } as const;

export default async function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, { user }] = await Promise.all([params, requireUser()]);

  const [challenge] = await db.select().from(challenges).where(eq(challenges.id, id)).limit(1);
  if (!challenge) notFound();

  // Students see approved videos plus their own; teachers see everything.
  const visibility =
    user.role === "ADMIN"
      ? eq(performances.challengeId, id)
      : and(
          eq(performances.challengeId, id),
          or(eq(performances.status, "PUBLISHED"), eq(performances.studentId, user.id)),
        );

  const [subs, counts] = await Promise.all([
    db
      .select({
        performance: performances,
        student: { id: users.id, name: users.name },
      })
      .from(performances)
      .innerJoin(users, eq(performances.studentId, users.id))
      .where(visibility)
      .orderBy(desc(performances.isBestPerformer), desc(performances.submittedAt)),
    getReactionCounts(),
  ]);
  const mine = await getViewerReactions(user.id, subs.map((s) => s.performance.id));

  const closed = !isChallengeOpen(challenge);
  const diff = difficultyFor(challenge.skillLevelTarget);
  const own = subs.filter((s) => s.performance.studentId === user.id);
  const others = subs.filter((s) => s.performance.studentId !== user.id);

  return (
    <>
      <PageHeader
        title={<span className="line-clamp-1">🏆 Challenge</span>}
        right={
          <Link href="/challenges" className="rounded-full bg-white/[0.07] px-3 py-1.5 text-sm font-black text-zinc-300">
            ← All
          </Link>
        }
      />
      <div className="space-y-6 px-4 pt-2">
        <section className={cn("animate-pop-in overflow-hidden rounded-3xl text-white shadow-xl shadow-black/40", gradientFor(challenge.id))}>
          {challenge.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- teacher-provided cover image
            <img src={challenge.coverImageUrl} alt="" className="aspect-[16/9] w-full object-cover" />
          )}
          <div className="p-5">
            <h1 className="text-2xl font-black leading-tight">{challenge.title}</h1>
            <p className="mt-2 text-sm font-bold">
              <span aria-label={`${diff.stars} of 3 stars`}>{"⭐".repeat(diff.stars)}</span> {diff.label}
              {challenge.instrumentFocus && (
                <span className="text-white/85">
                  {" "}· {instrumentEmoji(challenge.instrumentFocus)} {instrumentShort(challenge.instrumentFocus)}
                </span>
              )}
            </p>
            <p className="mt-1 text-sm font-semibold text-white/85">
              ⏰ {closed ? "Closed" : endsInLabel(challenge.deadline)} · 🏆 +{challenge.points} XP for the Best Performer
            </p>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-white/90">{challenge.description}</p>
            {user.role !== "ADMIN" &&
              (closed ? (
                <p className="mt-5 rounded-2xl bg-black/25 py-3 text-center text-sm font-black">
                  This challenge has closed
                </p>
              ) : (
                <OpenUploadButton
                  options={{ challengeId: challenge.id, instrument: challenge.instrumentFocus ?? undefined }}
                  className="glass-btn mt-5 w-full rounded-2xl py-3.5 text-base font-black"
                >
                  {own.length > 0 ? "🎬 Submit Another Take" : "🎬 Accept Challenge"}
                </OpenUploadButton>
              ))}
          </div>
        </section>

        {own.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-black">My Submissions</h2>
            {own.map((s) => (
              <FeedVideoCard
                key={s.performance.id}
                performance={s.performance}
                student={s.student}
                challengeTitle={challenge.title}
                counts={counts[s.performance.id]}
                mine={mine[s.performance.id]}
                statusBadge={
                  s.performance.status === "PENDING" || s.performance.status === "REJECTED"
                    ? STATUS_BADGE[s.performance.status]
                    : undefined
                }
              />
            ))}
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-lg font-black">
            Performances <span className="text-zinc-500">· {others.length}</span>
          </h2>
          {others.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-white/10 px-6 py-8 text-center text-sm text-zinc-400">
              No approved videos yet — be the first to shred! 🎸
            </p>
          ) : (
            others.map((s) => (
              <FeedVideoCard
                key={s.performance.id}
                performance={s.performance}
                student={s.student}
                challengeTitle={challenge.title}
                counts={counts[s.performance.id]}
                mine={mine[s.performance.id]}
              />
            ))
          )}
        </section>
      </div>
    </>
  );
}
