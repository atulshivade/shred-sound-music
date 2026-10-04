import { unstable_cache } from "next/cache";
import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  challenges,
  performances,
  serviceNotices,
  users,
  type UserRole,
} from "@/db/schema";

/**
 * Shared read models for the pages that render the same rows for every
 * viewer.
 *
 * Each page here is `force-dynamic` because the app shell needs the session
 * cookie, but the *data* below does not depend on who is asking. Without a
 * cache every visitor pays a fresh set of database round trips, and on a
 * serverless host those round trips dominate the response. Wrapping the
 * queries in the data cache means one visitor warms the rows for everyone,
 * while the tags keep writes authoritative: any mutation that changes these
 * rows calls `updateTag` (server actions) or `revalidateTag` (route
 * handlers) and the next read goes back to the database.
 *
 * Anything viewer-specific (likes, profile, admin evaluation queues) stays
 * uncached and is queried directly by the page.
 */

export const CACHE_TAGS = {
  challenges: "challenges",
  performances: "performances",
  serviceNotices: "service-notices",
} as const;

/** Seconds before a cached read model is refreshed even without a write. */
const STALE_SECONDS = 60;

export const getActiveChallenges = unstable_cache(
  async () =>
    db
      .select()
      .from(challenges)
      .where(eq(challenges.status, "ACTIVE"))
      .orderBy(desc(challenges.createdAt)),
  ["active-challenges"],
  { tags: [CACHE_TAGS.challenges], revalidate: STALE_SECONDS },
);

export const getPublishedPerformances = unstable_cache(
  async () =>
    db
      .select({
        performance: performances,
        student: {
          id: users.id,
          name: users.name,
          image: users.image,
          points: users.points,
        },
        challenge: { id: challenges.id, title: challenges.title },
      })
      .from(performances)
      .innerJoin(users, eq(performances.studentId, users.id))
      .innerJoin(challenges, eq(performances.challengeId, challenges.id))
      .where(eq(performances.status, "PUBLISHED"))
      .orderBy(desc(performances.submittedAt)),
  ["published-performances"],
  {
    tags: [CACHE_TAGS.performances, CACHE_TAGS.challenges],
    revalidate: STALE_SECONDS,
  },
);

/**
 * Active notices are read on every authenticated page load, so this query is
 * cached hard. Notices are written by the Test Agent, which revalidates the
 * tag as soon as a run finishes.
 */
export const getActiveServiceNotice = unstable_cache(
  async (role: UserRole) => {
    const audiences =
      role === "ADMIN"
        ? (["ALL", "ADMIN"] as const)
        : (["ALL", "STUDENT"] as const);
    const [notice] = await db
      .select({
        id: serviceNotices.id,
        publicMessage: serviceNotices.publicMessage,
      })
      .from(serviceNotices)
      .where(
        and(
          eq(serviceNotices.isActive, true),
          inArray(serviceNotices.audience, audiences),
          or(
            isNull(serviceNotices.endsAt),
            gt(serviceNotices.endsAt, new Date()),
          ),
        ),
      )
      .orderBy(desc(serviceNotices.createdAt))
      .limit(1);
    return notice ?? null;
  },
  ["active-service-notice"],
  { tags: [CACHE_TAGS.serviceNotices], revalidate: STALE_SECONDS },
);
