import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getHomeworkProgress, getQuizAttemptToday, getStudentDashboard } from "@/lib/student-data";
import { XP_REWARDS } from "@/lib/gamification";
import { HOMEWORK, LESSON_VIDEOS, SONGS, dueLabel, quizOfTheDay } from "@/lib/learn-content";
import { cn } from "@/lib/utils";
import { PageHeader, Pill } from "@/components/student/page-header";
import { HomeworkCard } from "@/components/student/homework-card";
import { QuizCard } from "@/components/student/quiz-card";
import { instrumentEmoji, instrumentShort } from "@/components/student/visuals";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "homework", label: "Homework" },
  { id: "songs", label: "My Songs" },
  { id: "videos", label: "Videos" },
  { id: "quizzes", label: "Quizzes" },
] as const;

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ user }, { tab: tabParam }] = await Promise.all([requireUser(), searchParams]);
  const tab = TABS.find((t) => t.id === tabParam)?.id ?? "homework";
  const quiz = quizOfTheDay();
  const [dashboard, homework, quizPlayed] = await Promise.all([
    getStudentDashboard(user.id),
    getHomeworkProgress(user.id),
    getQuizAttemptToday(user.id, quiz.id),
  ]);
  const instrument = dashboard.user?.primaryInstrument ?? null;

  return (
    <>
      <PageHeader
        title="📚 Learn"
        right={
          <Pill>
            {instrumentEmoji(instrument)} {instrument ? instrumentShort(instrument) : "Music"} · Level {dashboard.level.level}
          </Pill>
        }
      />
      <nav aria-label="Learn sections" className="no-scrollbar mx-4 mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-[#17171f] p-1">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "homework" ? "/learn" : `/learn?tab=${t.id}`}
            aria-current={t.id === tab ? "page" : undefined}
            className={cn(
              "flex-1 shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-center text-sm font-black transition-colors",
              t.id === tab ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-white",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="space-y-4 px-4">
        {tab === "homework" && (
          <>
            <h2 className="text-lg font-black">My Homework</h2>
            {HOMEWORK.map((hw) => {
              const p = homework.find((h) => h.id === hw.id);
              return (
                <HomeworkCard
                  key={hw.id}
                  id={hw.id}
                  emoji={hw.emoji}
                  title={hw.title}
                  subtitle={hw.subtitle}
                  due={dueLabel(hw)}
                  progress={p?.progress ?? 0}
                  doneToday={p?.doneToday ?? false}
                  songName={hw.songName}
                  instrument={hw.instrument}
                  lessonUrl={hw.lessonVideoUrl}
                />
              );
            })}
            <DailyQuizPromo />
          </>
        )}

        {tab === "songs" && (
          <>
            <h2 className="text-lg font-black">My Songs</h2>
            {SONGS.map((s) => (
              <article key={s.id} className="animate-pop-in rounded-3xl border border-white/5 bg-[#17171f] p-4">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="grid h-12 w-12 place-items-center rounded-2xl bg-pink-500/15 text-2xl">
                    {s.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black">{s.title}</h3>
                    <p className="text-sm text-zinc-400">
                      {s.artist} · {s.instrument}
                    </p>
                  </div>
                  <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-black text-violet-200">{s.level}</span>
                </div>
                <p className="mt-3 rounded-2xl bg-black/30 px-4 py-3 font-mono text-sm tracking-wide text-zinc-200">
                  {s.notes}
                </p>
              </article>
            ))}
          </>
        )}

        {tab === "videos" &&
          (LESSON_VIDEOS.length === 0 ? (
            <div className="grid place-items-center rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center">
              <span aria-hidden className="text-5xl">🎬</span>
              <p className="mt-3 font-black">Your content will appear here</p>
              <p className="mt-1 text-sm text-zinc-400">Lesson videos from your teacher show up in this tab.</p>
            </div>
          ) : (
            LESSON_VIDEOS.map((v) => (
              <a
                key={v.id}
                href={`https://www.youtube.com/watch?v=${v.youtubeId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-3xl bg-[#17171f] p-4"
              >
                <span aria-hidden className="text-2xl">{v.emoji}</span>
                <span className="flex-1 font-black">{v.title}</span>
                <span className="text-sm text-zinc-400">{v.minutes} min</span>
              </a>
            ))
          ))}

        {tab === "quizzes" && (
          <>
            <h2 className="text-lg font-black">Daily Music Quiz</h2>
            <QuizCard quiz={quiz} played={quizPlayed} reward={XP_REWARDS.quizCorrect} />
            <p className="text-center text-sm text-zinc-400">
              🎼 {dashboard.stats.quizzesCorrect} correct so far — 5 unlocks the Note Ninja badge!
            </p>
          </>
        )}
      </div>
    </>
  );
}

function DailyQuizPromo() {
  return (
    <section className="grad-quiz animate-pop-in rounded-3xl p-5 text-white shadow-xl shadow-rose-950/40">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-black">🎮 Daily Music Quiz</h3>
          <p className="mt-1 text-sm text-white/85">Guess the song from its first notes!</p>
        </div>
        <span className="rounded-full bg-black/25 px-2.5 py-1 text-xs font-black">+{XP_REWARDS.quizCorrect} XP</span>
      </div>
      <Link href="/learn?tab=quizzes" className="glass-btn mt-4 block rounded-2xl py-3 text-center text-sm font-black">
        🎮 Start Quiz
      </Link>
    </section>
  );
}
