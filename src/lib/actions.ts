"use server";

import { revalidatePath, updateTag } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  performances,
  performanceLikes,
  feedback,
  topPerformers,
  challenges,
  users,
  performanceReactions,
  xpEvents,
  type ReactionKind,
} from "@/db/schema";
import { XP_REWARDS } from "@/lib/gamification";
import { findHomework, findQuiz } from "@/lib/learn-content";
import { auth, requireAdmin } from "@/lib/auth";
import {
  createPerformanceSchema,
  createFeedbackSchema,
  togglePerformanceFlagSchema,
  setPerformanceStatusSchema,
} from "@/lib/validators";
import { classifyActionFailure } from "@/lib/action-errors";
import { CACHE_TAGS } from "@/lib/queries";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Translate a raw DB / runtime exception into something safe and useful
 * for the client. The pure mapping lives in `action-errors.ts` (a regular
 * module — server-action files can only export async functions). Here we
 * just add the `console.error` side effect so the hosting platform's
 * runtime logs always capture the full stack.
 */
function describeActionError(
  err: unknown,
  context: string,
): { ok: false; error: string } {
  console.error(`[action:${context}] failed`, err);
  return classifyActionFailure(err);
}

/* --------------------------- Likes --------------------------- */

export async function togglePerformanceLikeAction(
  performanceId: string,
): Promise<
  | { ok: true; liked: boolean; likesCount: number }
  | { ok: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: "Sign in to like" };
    if (typeof performanceId !== "string" || performanceId.length < 8) {
      return { ok: false, error: "Invalid performance" };
    }

    // Confirm the performance exists before mutating the like table — also
    // gives us the challenge id we need for revalidation later.
    const [perf] = await db
      .select({
        id: performances.id,
        challengeId: performances.challengeId,
        status: performances.status,
      })
      .from(performances)
      .where(eq(performances.id, performanceId))
      .limit(1);
    if (!perf) return { ok: false, error: "Performance not found" };
    if (perf.status !== "PUBLISHED") {
      return { ok: false, error: "Only published performances can be liked" };
    }

    const [existing] = await db
      .select()
      .from(performanceLikes)
      .where(
        and(
          eq(performanceLikes.performanceId, performanceId),
          eq(performanceLikes.userId, session.user.id),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .delete(performanceLikes)
        .where(
          and(
            eq(performanceLikes.performanceId, performanceId),
            eq(performanceLikes.userId, session.user.id),
          ),
        );
      // Clamp to >= 0 in case the counter ever drifted out of sync.
      const [updated] = await db
        .update(performances)
        .set({
          likesCount: sql`GREATEST(${performances.likesCount} - 1, 0)`,
        })
        .where(eq(performances.id, performanceId))
        .returning({ likesCount: performances.likesCount });

      updateTag(CACHE_TAGS.performances);
      revalidatePath("/feed");
      revalidatePath(`/challenges/${perf.challengeId}`);
      return { ok: true, liked: false, likesCount: updated?.likesCount ?? 0 };
    }

    await db.insert(performanceLikes).values({
      performanceId,
      userId: session.user.id,
    });
    const [updated] = await db
      .update(performances)
      .set({ likesCount: sql`${performances.likesCount} + 1` })
      .where(eq(performances.id, performanceId))
      .returning({ likesCount: performances.likesCount });

    updateTag(CACHE_TAGS.performances);
    revalidatePath("/feed");
    revalidatePath(`/challenges/${perf.challengeId}`);
    return { ok: true, liked: true, likesCount: updated?.likesCount ?? 1 };
  } catch (err) {
    return describeActionError(err, "togglePerformanceLike");
  }
}

/* --------------------------- Reactions --------------------------- */

export async function toggleReactionAction(
  performanceId: string,
  kind: ReactionKind,
): Promise<
  | { ok: true; active: boolean; count: number }
  | { ok: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: "Sign in to react" };
    if (kind !== "CLAP" && kind !== "SHRED") {
      return { ok: false, error: "Unknown reaction" };
    }
    if (typeof performanceId !== "string" || performanceId.length < 8) {
      return { ok: false, error: "Invalid performance" };
    }
    const [perf] = await db
      .select({ status: performances.status })
      .from(performances)
      .where(eq(performances.id, performanceId))
      .limit(1);
    if (!perf) return { ok: false, error: "Performance not found" };
    if (perf.status !== "PUBLISHED") {
      return { ok: false, error: "Only approved videos can get reactions" };
    }

    const match = and(
      eq(performanceReactions.performanceId, performanceId),
      eq(performanceReactions.userId, session.user.id),
      eq(performanceReactions.kind, kind),
    );
    const removed = await db
      .delete(performanceReactions)
      .where(match)
      .returning({ kind: performanceReactions.kind });
    if (removed.length === 0) {
      await db
        .insert(performanceReactions)
        .values({ performanceId, userId: session.user.id, kind })
        .onConflictDoNothing();
    }
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(performanceReactions)
      .where(
        and(
          eq(performanceReactions.performanceId, performanceId),
          eq(performanceReactions.kind, kind),
        ),
      );

    updateTag(CACHE_TAGS.performances);
    return { ok: true, active: removed.length === 0, count: Number(count) };
  } catch (err) {
    return describeActionError(err, "toggleReaction");
  }
}

/* --------------------------- XP: practice & quizzes --------------------------- */

/**
 * Record an XP event once per `sourceKey`. Returns false when the event was
 * already recorded, so repeated clicks can never award XP twice.
 */
async function awardXp(userId: string, sourceKey: string, amount: number) {
  const inserted = await db
    .insert(xpEvents)
    .values({ userId, sourceKey, amount })
    .onConflictDoNothing()
    .returning({ id: xpEvents.id });
  if (inserted.length === 0) return false;
  if (amount > 0) {
    await db
      .update(users)
      .set({ points: sql`${users.points} + ${amount}` })
      .where(eq(users.id, userId));
  }
  return true;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function logPracticeAction(
  homeworkId: string,
): Promise<{ ok: true; awarded: number } | { ok: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: "Sign in to log practice" };
    if (!findHomework(homeworkId)) return { ok: false, error: "Unknown homework" };

    const awarded = await awardXp(
      session.user.id,
      `homework:${homeworkId}:${todayKey()}`,
      XP_REWARDS.practiceSession,
    );
    if (!awarded) {
      return { ok: false, error: "Already logged today — come back tomorrow!" };
    }
    revalidatePath("/learn");
    revalidatePath("/profile");
    return { ok: true, awarded: XP_REWARDS.practiceSession };
  } catch (err) {
    return describeActionError(err, "logPractice");
  }
}

export async function answerQuizAction(
  quizId: string,
  choice: string,
): Promise<
  | { ok: true; correct: boolean; answer: string; awarded: number }
  | { ok: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: "Sign in to play" };
    const quiz = findQuiz(quizId);
    if (!quiz || !quiz.options.includes(choice)) {
      return { ok: false, error: "Unknown quiz answer" };
    }
    const correct = choice === quiz.answer;
    const amount = correct ? XP_REWARDS.quizCorrect : 0;
    const recorded = await awardXp(
      session.user.id,
      `quiz:${quizId}:${todayKey()}`,
      amount,
    );
    if (!recorded) {
      return { ok: false, error: "You already played today's quiz" };
    }
    revalidatePath("/profile");
    return { ok: true, correct, answer: quiz.answer, awarded: amount };
  } catch (err) {
    return describeActionError(err, "answerQuiz");
  }
}

/* --------------------------- Performances --------------------------- */

export async function createPerformanceAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: "Sign in to submit" };

    const parsed = createPerformanceSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((i) => i.message).join("; "),
      };
    }

    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, parsed.data.challengeId))
      .limit(1);

    if (!challenge) return { ok: false, error: "Challenge not found" };
    if (challenge.status !== "ACTIVE") {
      return { ok: false, error: "Challenge is not accepting submissions" };
    }
    if (new Date(challenge.deadline).getTime() <= Date.now()) {
      return { ok: false, error: "Deadline has passed" };
    }

    await db.insert(performances).values({
      challengeId: parsed.data.challengeId,
      studentId: session.user.id,
      title: parsed.data.title || null,
      caption: parsed.data.caption || null,
      instrument: parsed.data.instrument,
      skillLevel: parsed.data.skillLevel,
      videoProvider: parsed.data.videoProvider,
      videoUrl: parsed.data.videoUrl,
      videoExternalId: parsed.data.videoExternalId || null,
      videoDurationSeconds: parsed.data.videoDurationSeconds ?? null,
      thumbnailUrl: parsed.data.thumbnailUrl || null,
      // Child-safety baseline: every student upload must be reviewed by a
      // teacher before it can appear in community feeds or galleries.
      status: "PENDING",
    });

    updateTag(CACHE_TAGS.performances);
    revalidatePath(`/challenges/${parsed.data.challengeId}`);
    revalidatePath("/feed");
    // Teachers expect the dashboard + evaluation studio to update the moment
    // a student posts a video — without a hard refresh.
    revalidatePath("/admin");
    revalidatePath("/admin/evaluate");
    return { ok: true };
  } catch (err) {
    return describeActionError(err, "createPerformance");
  }
}

/* --------------------------- Feedback --------------------------- */

export async function createFeedbackAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    const parsed = createFeedbackSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((i) => i.message).join("; "),
      };
    }

    await db.insert(feedback).values({
      performanceId: parsed.data.performanceId,
      teacherId: session.user.id,
      note: parsed.data.note,
      timestampSec: parsed.data.timestampSec ?? null,
      rhythmScore: parsed.data.rhythmScore ?? null,
      techniqueScore: parsed.data.techniqueScore ?? null,
      musicalityScore: parsed.data.musicalityScore ?? null,
      isPrivate: parsed.data.isPrivate ?? true,
    });

    revalidatePath("/admin/evaluate");
    return { ok: true };
  } catch (err) {
    return describeActionError(err, "createFeedback");
  }
}

/* --------------------------- Verify / Crown --------------------------- */

export async function togglePerformanceFlagAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    const parsed = togglePerformanceFlagSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request" };

    const [current] = await db
      .select()
      .from(performances)
      .where(eq(performances.id, parsed.data.performanceId))
      .limit(1);
    if (!current) return { ok: false, error: "Performance not found" };

    const nextVerified =
      parsed.data.isVerified !== undefined
        ? parsed.data.isVerified
        : current.isVerified;
    const nextBest =
      parsed.data.isBestPerformer !== undefined
        ? parsed.data.isBestPerformer
        : current.isBestPerformer;
    if (nextBest && current.status !== "PUBLISHED") {
      return {
        ok: false,
        error: "Publish the performance before selecting it as Best Performer",
      };
    }

    await db
      .update(performances)
      .set({ isVerified: nextVerified, isBestPerformer: nextBest })
      .where(eq(performances.id, parsed.data.performanceId));

    // Best Performer was just turned on → record an explicit top_performer pick
    // (audit trail), and award the challenge points to the student.
    if (nextBest && !current.isBestPerformer) {
      const [challenge] = await db
        .select({ id: challenges.id, points: challenges.points })
        .from(challenges)
        .where(eq(challenges.id, current.challengeId))
        .limit(1);
      if (challenge) {
        await db
          .insert(topPerformers)
          .values({
            performanceId: current.id,
            challengeId: challenge.id,
            selectedById: session.user.id,
            period: "CHALLENGE",
          })
          .onConflictDoNothing();

        const [student] = await db
          .select({ points: users.points })
          .from(users)
          .where(eq(users.id, current.studentId))
          .limit(1);
        if (student) {
          await db
            .update(users)
            .set({ points: student.points + challenge.points })
            .where(eq(users.id, current.studentId));
        }
      }
    } else if (!nextBest && current.isBestPerformer) {
      await db
        .delete(topPerformers)
        .where(eq(topPerformers.performanceId, current.id));
    }

    updateTag(CACHE_TAGS.performances);
    revalidatePath("/admin/evaluate");
    revalidatePath(`/challenges/${current.challengeId}`);
    revalidatePath("/feed");
    return { ok: true };
  } catch (err) {
    return describeActionError(err, "togglePerformanceFlag");
  }
}

export async function setPerformanceStatusAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = setPerformanceStatusSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request" };

    const [current] = await db
      .select({ challengeId: performances.challengeId })
      .from(performances)
      .where(eq(performances.id, parsed.data.performanceId))
      .limit(1);
    if (!current) return { ok: false, error: "Performance not found" };

    await db
      .update(performances)
      .set({ status: parsed.data.status })
      .where(eq(performances.id, parsed.data.performanceId));

    updateTag(CACHE_TAGS.performances);
    revalidatePath("/admin/evaluate");
    revalidatePath(`/challenges/${current.challengeId}`);
    revalidatePath("/feed");
    return { ok: true };
  } catch (err) {
    return describeActionError(err, "setPerformanceStatus");
  }
}
