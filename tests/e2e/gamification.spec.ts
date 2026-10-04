import { test, expect } from "@playwright/test";
import {
  badgesFor,
  computeStreak,
  difficultyFor,
  endsInLabel,
  isChallengeOpen,
  levelFromXp,
  type StudentStats,
} from "../../src/lib/gamification";
import { dueLabel, HOMEWORK, quizOfTheDay, QUIZZES } from "../../src/lib/learn-content";

const NOW = new Date("2026-10-04T12:00:00Z"); // a Sunday
const day = (offset: number) => new Date(NOW.getTime() + offset * 86_400_000);

test.describe("Game rules", () => {
  test("levels step every 500 XP", () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, intoLevel: 0, toNext: 500 });
    expect(levelFromXp(499).level).toBe(1);
    expect(levelFromXp(500)).toMatchObject({ level: 2, intoLevel: 0 });
    expect(levelFromXp(2450)).toMatchObject({ level: 5, intoLevel: 450, toNext: 50 });
    expect(levelFromXp(-20).level).toBe(1);
  });

  test("streak counts consecutive days and survives until the day is over", () => {
    expect(computeStreak([], NOW)).toBe(0);
    expect(computeStreak([day(0), day(-1), day(-2)], NOW)).toBe(3);
    // Nothing yet today, but yesterday continues the streak.
    expect(computeStreak([day(-1), day(-2)], NOW)).toBe(2);
    // A gap breaks it.
    expect(computeStreak([day(0), day(-2), day(-3)], NOW)).toBe(1);
    expect(computeStreak([day(-2)], NOW)).toBe(0);
    // Several events on one day count once.
    expect(computeStreak([day(0), day(0), day(-1)], NOW)).toBe(2);
  });

  test("badges unlock at their thresholds", () => {
    const base: StudentStats = {
      xp: 0, streak: 0, publishedCount: 0, songsCount: 0, challengesCompleted: 0,
      bestPerformerCount: 0, guitarPerformances: 0, likesReceived: 0,
      quizzesCorrect: 0, practiceSessions: 0,
    };
    expect(badgesFor(base).every((b) => !b.earned)).toBe(true);
    const earned = (s: Partial<StudentStats>) =>
      badgesFor({ ...base, ...s }).filter((b) => b.earned).map((b) => b.id);
    expect(earned({ publishedCount: 1 })).toEqual(["first-song"]);
    expect(earned({ streak: 7 })).toEqual(["7-day-shredder"]);
    expect(earned({ streak: 6 })).toEqual([]);
    expect(earned({ xp: 2000 })).toEqual(["shred-sound-star"]);
    expect(earned({ bestPerformerCount: 1 })).toEqual(["challenge-champion"]);
  });

  test("challenge helpers", () => {
    expect(difficultyFor("BEGINNER")).toEqual({ stars: 1, label: "Easy" });
    expect(difficultyFor(null)).toEqual({ stars: 2, label: "Medium" });
    expect(difficultyFor("PRO").label).toBe("Hard");
    expect(endsInLabel(day(3), NOW)).toBe("Ends in 3 days");
    expect(endsInLabel(day(1), NOW)).toBe("Ends in 1 day");
    expect(endsInLabel(day(-1), NOW)).toBe("Closed");
    expect(isChallengeOpen({ status: "ACTIVE", deadline: day(1) }, NOW)).toBe(true);
    expect(isChallengeOpen({ status: "ACTIVE", deadline: day(-1) }, NOW)).toBe(false);
    expect(isChallengeOpen({ status: "CLOSED", deadline: day(1) }, NOW)).toBe(false);
  });

  test("homework due labels count forward to the next due day", () => {
    const monday = HOMEWORK.find((h) => h.dueWeekday === 0) ?? { ...HOMEWORK[0], dueWeekday: 0 };
    expect(dueLabel({ ...monday, dueWeekday: 6 }, NOW)).toMatchObject({ label: "Due: Today", tone: "urgent" });
    expect(dueLabel({ ...monday, dueWeekday: 0 }, NOW)).toMatchObject({ label: "Due: Tomorrow", tone: "urgent" });
    expect(dueLabel({ ...monday, dueWeekday: 2 }, NOW).label).toBe("Due: Wednesday");
    expect(dueLabel({ ...monday, dueWeekday: 5 }, NOW)).toMatchObject({ label: "Due: This week", tone: "ok" });
  });

  test("quiz of the day is stable within a day and every answer is an option", () => {
    expect(quizOfTheDay(NOW).id).toBe(quizOfTheDay(new Date("2026-10-04T23:59:00Z")).id);
    for (const q of QUIZZES) expect(q.options).toContain(q.answer);
  });
});
