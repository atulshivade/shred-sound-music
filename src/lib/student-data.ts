import { unstable_cache } from "next/cache";
import { and, desc, eq, inArray, like, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  challenges,
  performanceLikes,
  performanceReactions,
  performances,
  topPerformers,
  users,
  xpEvents,
  type ReactionKind,
} from "@/db/schema";
import { CACHE_TAGS } from "@/lib/queries";
import {
  badgesFor,
  computeStreak,
  dayKey,
  levelFromXp,
  type StudentStats,
} from "@/lib/gamification";
import { HOMEWORK } from "@/lib/learn-content";

/**
 * Viewer-specific read models for the student app. Kept apart from
 * `queries.ts` because most of these depend on who is asking.
 */

export type ReactionCounts = { CLAP: number; SHRED: number };
export type ViewerReactions = { liked: boolean; CLAP: boolean; SHRED: boolean };

const GUITARS = new Set(["ACOUSTIC_GUITAR", "ELECTRIC_GUITAR", "BASS_GUITAR"]);

/** Clap / shred totals for every published performance (shared by all viewers). */
export const getReactionCounts = unstable_cache(
  async (): Promise<Record<string, ReactionCounts>> => {
    const rows = await db
      .select({
        performanceId: performanceReactions.performanceId,
        kind: performanceReactions.kind,
        count: sql<number>`count(*)::int`,
      })
      .from(performanceReactions)
      .groupBy(performanceReactions.performanceId, performanceReactions.kind);
    const out: Record<string, ReactionCounts> = {};
    for (const r of rows) {
      const entry = (out[r.performanceId] ??= { CLAP: 0, SHRED: 0 });
      entry[r.kind] = Number(r.count);
    }
    return out;
  },
  ["reaction-counts"],
  { tags: [CACHE_TAGS.performances], revalidate: 60 },
);

/** Latest crowned performance, shown as "Student of the Week". */
export const getStudentOfTheWeek = unstable_cache(
  async () => {
    const [row] = await db
      .select({
        performanceId: performances.id,
        challengeId: performances.challengeId,
        instrument: performances.instrument,
        thumbnailUrl: performances.thumbnailUrl,
        studentId: users.id,
        name: users.name,
        image: users.image,
        points: users.points,
        selectedAt: topPerformers.selectedAt,
      })
      .from(topPerformers)
      .innerJoin(performances, eq(topPerformers.performanceId, performances.id))
      .innerJoin(users, eq(performances.studentId, users.id))
      .where(eq(performances.status, "PUBLISHED"))
      .orderBy(desc(topPerformers.selectedAt))
      .limit(1);
    return row ?? null;
  },
  ["student-of-the-week"],
  { tags: [CACHE_TAGS.performances], revalidate: 60 },
);

export async function getViewerReactions(
  userId: string,
  performanceIds: string[],
): Promise<Record<string, ViewerReactions>> {
  const out: Record<string, ViewerReactions> = {};
  if (performanceIds.length === 0) return out;
  const [likes, reactions] = await Promise.all([
    db
      .select({ performanceId: performanceLikes.performanceId })
      .from(performanceLikes)
      .where(
        and(
          eq(performanceLikes.userId, userId),
          inArray(performanceLikes.performanceId, performanceIds),
        ),
      ),
    db
      .select({
        performanceId: performanceReactions.performanceId,
        kind: performanceReactions.kind,
      })
      .from(performanceReactions)
      .where(
        and(
          eq(performanceReactions.userId, userId),
          inArray(performanceReactions.performanceId, performanceIds),
        ),
      ),
  ]);
  const get = (id: string) => (out[id] ??= { liked: false, CLAP: false, SHRED: false });
  for (const l of likes) get(l.performanceId).liked = true;
  for (const r of reactions) get(r.performanceId)[r.kind as ReactionKind] = true;
  return out;
}

export type ChallengeProgress = "NOT_STARTED" | "SUBMITTED" | "APPROVED";

/** The viewer's own submissions, newest first. */
export async function getOwnPerformances(userId: string) {
  return db
    .select({
      id: performances.id,
      challengeId: performances.challengeId,
      challengeTitle: challenges.title,
      challengePoints: challenges.points,
      title: performances.title,
      instrument: performances.instrument,
      status: performances.status,
      thumbnailUrl: performances.thumbnailUrl,
      videoUrl: performances.videoUrl,
      videoProvider: performances.videoProvider,
      likesCount: performances.likesCount,
      isBestPerformer: performances.isBestPerformer,
      submittedAt: performances.submittedAt,
    })
    .from(performances)
    .innerJoin(challenges, eq(performances.challengeId, challenges.id))
    .where(eq(performances.studentId, userId))
    .orderBy(desc(performances.submittedAt));
}

export type OwnPerformance = Awaited<ReturnType<typeof getOwnPerformances>>[number];

export function challengeProgressMap(own: OwnPerformance[]) {
  const map: Record<string, ChallengeProgress> = {};
  for (const p of own) {
    const current = map[p.challengeId];
    if (p.status === "PUBLISHED") map[p.challengeId] = "APPROVED";
    else if (!current && p.status !== "REJECTED") map[p.challengeId] = "SUBMITTED";
  }
  return map;
}

/**
 * Everything the student's game state is derived from, in one round of
 * parallel queries.
 */
export async function getStudentDashboard(userId: string) {
  const [userRows, own, events] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        image: users.image,
        points: users.points,
        primaryInstrument: users.primaryInstrument,
        skillLevel: users.skillLevel,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    getOwnPerformances(userId),
    db
      .select({
        sourceKey: xpEvents.sourceKey,
        amount: xpEvents.amount,
        createdAt: xpEvents.createdAt,
      })
      .from(xpEvents)
      .where(eq(xpEvents.userId, userId))
      .orderBy(desc(xpEvents.createdAt)),
  ]);

  const user = userRows[0] ?? null;
  const published = own.filter((p) => p.status === "PUBLISHED");
  const xp = user?.points ?? 0;

  const activity = [
    ...own.map((p) => p.submittedAt),
    ...events.map((e) => e.createdAt),
  ];
  const streak = computeStreak(activity);

  const stats: StudentStats = {
    xp,
    streak,
    publishedCount: published.length,
    songsCount: own.filter((p) => p.status !== "REJECTED").length,
    challengesCompleted: new Set(published.map((p) => p.challengeId)).size,
    bestPerformerCount: own.filter((p) => p.isBestPerformer).length,
    guitarPerformances: published.filter((p) => GUITARS.has(p.instrument)).length,
    likesReceived: published.reduce((sum, p) => sum + p.likesCount, 0),
    quizzesCorrect: events.filter((e) => e.sourceKey.startsWith("quiz:") && e.amount > 0).length,
    practiceSessions: events.filter((e) => e.sourceKey.startsWith("homework:")).length,
  };

  return {
    user,
    own,
    events,
    stats,
    level: levelFromXp(xp),
    badges: badgesFor(stats),
  };
}

export type StudentDashboard = Awaited<ReturnType<typeof getStudentDashboard>>;

/** Practice sessions logged per homework item, plus whether today is done. */
export async function getHomeworkProgress(userId: string) {
  const rows = await db
    .select({ sourceKey: xpEvents.sourceKey })
    .from(xpEvents)
    .where(and(eq(xpEvents.userId, userId), like(xpEvents.sourceKey, "homework:%")));
  const today = dayKey(new Date());
  return HOMEWORK.map((hw) => {
    const keys = rows.filter((r) => r.sourceKey.startsWith(`homework:${hw.id}:`));
    const sessions = keys.length;
    return {
      id: hw.id,
      sessions,
      progress: Math.min(1, sessions / hw.targetSessions),
      doneToday: keys.some((r) => r.sourceKey === `homework:${hw.id}:${today}`),
    };
  });
}

/** Whether the viewer already answered today's quiz (and the stored answer key). */
export async function getQuizAttemptToday(userId: string, quizId: string) {
  const [row] = await db
    .select({ sourceKey: xpEvents.sourceKey, amount: xpEvents.amount })
    .from(xpEvents)
    .where(
      and(
        eq(xpEvents.userId, userId),
        eq(xpEvents.sourceKey, `quiz:${quizId}:${dayKey(new Date())}`),
      ),
    )
    .limit(1);
  return row ? { correct: row.amount > 0 } : null;
}
