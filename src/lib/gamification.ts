/**
 * Game rules for the student app. Pure functions only, so they can be unit
 * tested and reused by both server pages and client components.
 *
 * Progress is always expressed as levels, streaks and collectibles — never
 * as grades or percentages-as-scores.
 */

export const XP_PER_LEVEL = 500;

export const XP_REWARDS = {
  quizCorrect: 50,
  practiceSession: 10,
} as const;

export function levelFromXp(xp: number) {
  const safe = Math.max(0, Math.floor(xp));
  const level = Math.floor(safe / XP_PER_LEVEL) + 1;
  const intoLevel = safe % XP_PER_LEVEL;
  return {
    level,
    intoLevel,
    toNext: XP_PER_LEVEL - intoLevel,
    progress: intoLevel / XP_PER_LEVEL,
  };
}

/** Calendar day in UTC, e.g. `2026-10-04`. */
export function dayKey(date: Date | string | number): string {
  return new Date(date).toISOString().slice(0, 10);
}

/**
 * Consecutive active days ending today, or ending yesterday so a streak does
 * not look broken before the student has had a chance to practise today.
 */
export function computeStreak(
  activity: Iterable<Date | string | number>,
  now: Date = new Date(),
): number {
  const days = new Set<string>();
  for (const at of activity) days.add(dayKey(at));
  if (days.size === 0) return 0;

  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (!days.has(dayKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!days.has(dayKey(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export type StudentStats = {
  xp: number;
  streak: number;
  publishedCount: number;
  songsCount: number;
  challengesCompleted: number;
  bestPerformerCount: number;
  guitarPerformances: number;
  likesReceived: number;
  quizzesCorrect: number;
  practiceSessions: number;
};

export type BadgeDefinition = {
  id: string;
  emoji: string;
  name: string;
  hint: string;
  earned: (s: StudentStats) => boolean;
};

export const BADGES: readonly BadgeDefinition[] = [
  { id: "first-song", emoji: "🎹", name: "First Song", hint: "Get your first performance approved", earned: (s) => s.publishedCount >= 1 },
  { id: "7-day-shredder", emoji: "🔥", name: "7 Day Shredder", hint: "Practise 7 days in a row", earned: (s) => s.streak >= 7 },
  { id: "speed-master", emoji: "⚡", name: "Speed Master", hint: "Complete 3 challenges", earned: (s) => s.challengesCompleted >= 3 },
  { id: "guitar-hero", emoji: "🎸", name: "Guitar Hero", hint: "Share 3 approved guitar performances", earned: (s) => s.guitarPerformances >= 3 },
  { id: "note-ninja", emoji: "🎼", name: "Note Ninja", hint: "Answer 5 music quizzes correctly", earned: (s) => s.quizzesCorrect >= 5 },
  { id: "challenge-champion", emoji: "🏆", name: "Challenge Champion", hint: "Be crowned Best Performer", earned: (s) => s.bestPerformerCount >= 1 },
  { id: "rising-star", emoji: "🚀", name: "Rising Star", hint: "Collect 10 hearts on your videos", earned: (s) => s.likesReceived >= 10 },
  { id: "practice-pro", emoji: "💯", name: "Practice Pro", hint: "Log 10 practice sessions", earned: (s) => s.practiceSessions >= 10 },
  { id: "shred-sound-star", emoji: "🌟", name: "Shred Sound Star", hint: "Reach 2,000 XP", earned: (s) => s.xp >= 2000 },
];

export function badgesFor(stats: StudentStats) {
  return BADGES.map((b) => ({
    id: b.id,
    emoji: b.emoji,
    name: b.name,
    hint: b.hint,
    earned: b.earned(stats),
  }));
}

/** Stars shown on a challenge card, from the teacher's target skill level. */
export function difficultyFor(skill: string | null | undefined) {
  switch (skill) {
    case "BEGINNER":
      return { stars: 1, label: "Easy" };
    case "ADVANCED":
    case "PRO":
      return { stars: 3, label: "Hard" };
    default:
      return { stars: 2, label: "Medium" };
  }
}

export function formatXp(xp: number): string {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Math.round(xp)));
}

/** Active and still before its deadline, i.e. accepting submissions. */
export function isChallengeOpen(
  c: { status: string; deadline: Date | string },
  now: Date = new Date(),
): boolean {
  return c.status === "ACTIVE" && new Date(c.deadline).getTime() > now.getTime();
}

/** "Ends in 3 days" style copy for challenge cards. */
export function endsInLabel(deadline: Date | string, now: Date = new Date()): string {
  const ms = new Date(deadline).getTime() - now.getTime();
  if (ms <= 0) return "Closed";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return hours <= 1 ? "Ends in 1 hour" : `Ends in ${hours} hours`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Ends in 1 day" : `Ends in ${days} days`;
}
