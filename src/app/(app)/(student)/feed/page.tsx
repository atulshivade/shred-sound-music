import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getActiveChallenges, getPublishedPerformances } from "@/lib/queries";
import {
  getQuizAttemptToday,
  getReactionCounts,
  getStudentDashboard,
  getStudentOfTheWeek,
  getViewerReactions,
} from "@/lib/student-data";
import { difficultyFor, endsInLabel, isChallengeOpen, levelFromXp, XP_REWARDS } from "@/lib/gamification";
import { quizOfTheDay } from "@/lib/learn-content";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/student/page-header";
import { NotificationsBell, type StudentNotification } from "@/components/student/notifications-bell";
import { FeedVideoCard } from "@/components/student/feed-video-card";
import { QuizCard } from "@/components/student/quiz-card";
import { CelebrateButton } from "@/components/student/celebrate-button";
import { OpenUploadButton } from "@/components/student/upload-sheet";
import { StudentAvatar } from "@/components/student/avatar";
import { firstName, instrumentEmoji, instrumentShort } from "@/components/student/visuals";

export const dynamic = "force-dynamic";

const FEED_LIMIT = 20;

export default async function FeedPage() {
  const { user } = await requireUser();
  const quiz = quizOfTheDay();
  const [published, counts, sotw, challenges, dashboard, quizPlayed] = await Promise.all([
    getPublishedPerformances(),
    getReactionCounts(),
    getStudentOfTheWeek(),
    getActiveChallenges(),
    getStudentDashboard(user.id),
    getQuizAttemptToday(user.id, quiz.id),
  ]);

  const videos = published.slice(0, FEED_LIMIT);
  const mine = await getViewerReactions(
    user.id,
    [...videos.map((v) => v.performance.id), ...(sotw ? [sotw.performanceId] : [])],
  );

  const challenge = challenges.find((c) => isChallengeOpen(c));
  const joined = challenge ? published.filter((p) => p.challenge.id === challenge.id).length : 0;
  const achievement = published.find(
    (p) => p.performance.isBestPerformer && p.performance.id !== sotw?.performanceId,
  );

  const notifications: StudentNotification[] = dashboard.own.slice(0, 8).map((p) => ({
    id: p.id,
    at: new Date(p.submittedAt).toISOString(),
    emoji: p.status === "PUBLISHED" ? "✅" : p.status === "REJECTED" ? "💬" : "⏳",
    text:
      p.status === "PUBLISHED"
        ? `“${p.title ?? p.challengeTitle}” was approved and is live!`
        : p.status === "REJECTED"
          ? `Your teacher left notes on “${p.title ?? p.challengeTitle}” — try again!`
          : `“${p.title ?? p.challengeTitle}” is waiting for teacher review`,
  }));

  const name = firstName(dashboard.user?.name ?? user.name);
  const streak = dashboard.stats.streak;

  const specials: React.ReactNode[] = [];
  if (challenge) {
    const diff = difficultyFor(challenge.skillLevelTarget);
    specials.push(
      <section key="challenge" className="grad-sunset animate-pop-in rounded-3xl p-5 text-white shadow-xl shadow-rose-950/40">
        <p className="text-xs font-black uppercase tracking-widest text-white/80">🎯 Teacher Challenge</p>
        <h2 className="mt-2 text-2xl font-black leading-tight">{challenge.title}</h2>
        <p className="mt-1 line-clamp-2 text-sm text-white/85">{challenge.description}</p>
        <p className="mt-3 text-sm font-bold">
          <span aria-label={`${diff.stars} of 3 stars`}>{"⭐".repeat(diff.stars)}</span>
          <span className="text-white/80"> · {diff.label} · {endsInLabel(challenge.deadline)} · {joined} {joined === 1 ? "student" : "students"}</span>
        </p>
        <div className="mt-4 flex gap-2">
          <OpenUploadButton options={{ challengeId: challenge.id }} className="glass-btn flex-1 rounded-2xl py-3 text-sm font-black">
            🎬 Accept Challenge
          </OpenUploadButton>
          <Link href={`/challenges/${challenge.id}`} className="glass-btn rounded-2xl px-4 py-3 text-sm font-black">
            Details
          </Link>
        </div>
      </section>,
    );
  }
  if (achievement) {
    const c = counts[achievement.performance.id];
    specials.push(
      <section key="achievement" className="grad-violet animate-pop-in flex items-center gap-4 rounded-3xl p-5 text-white shadow-xl shadow-violet-950/40">
        <StudentAvatar id={achievement.student.id} name={achievement.student.name} size="lg" ring />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-widest text-white/75">🏅 Achievement</p>
          <p className="mt-1 font-black leading-tight">
            {firstName(achievement.student.name)} — Best Performer in {achievement.challenge.title}!
          </p>
          <CelebrateButton
            className="mt-3"
            performanceId={achievement.performance.id}
            initialCount={c?.CLAP ?? 0}
            initialActive={mine[achievement.performance.id]?.CLAP ?? false}
          />
        </div>
      </section>,
    );
  }
  specials.push(
    <QuizCard key="quiz" quiz={quiz} played={quizPlayed} reward={XP_REWARDS.quizCorrect} />,
  );
  if (sotw) {
    const lvl = levelFromXp(sotw.points).level;
    specials.push(
      <section key="sotw" className="grad-gold animate-pop-in rounded-3xl p-5 text-[#1a1204] shadow-xl shadow-amber-950/40">
        <p className="text-xs font-black uppercase tracking-widest text-[#1a1204]/70">⭐ Student of the Week</p>
        <div className="mt-3 flex items-center gap-4">
          <StudentAvatar id={sotw.studentId} name={sotw.name} size="xl" ring />
          <div>
            <p className="text-2xl font-black">{firstName(sotw.name)}</p>
            <p className="text-sm font-bold text-[#1a1204]/75">
              {instrumentEmoji(sotw.instrument)} {instrumentShort(sotw.instrument)} · Level {lvl}
            </p>
            <p className="text-xs font-bold text-[#1a1204]/60">Crowned {formatDate(sotw.selectedAt)}</p>
          </div>
        </div>
        <Link
          href={`/shorts?v=${sotw.performanceId}`}
          className="mt-4 block rounded-2xl bg-[#1a1204]/85 py-3 text-center text-sm font-black text-amber-200"
        >
          ▶ Watch the Performance
        </Link>
      </section>,
    );
  }

  const items: React.ReactNode[] = [];
  videos.forEach((v, i) => {
    items.push(
      <FeedVideoCard
        key={v.performance.id}
        performance={v.performance}
        student={v.student}
        challengeTitle={v.challenge.title}
        counts={counts[v.performance.id]}
        mine={mine[v.performance.id]}
      />,
    );
    if (i < specials.length) items.push(specials[i]);
  });
  items.push(...specials.slice(videos.length));

  return (
    <>
      <PageHeader showLogo title="🎵 Your Feed" right={<NotificationsBell items={notifications} />} />
      <div className="space-y-4 px-4 pt-2">
        <p className="rounded-2xl border border-lime-500/25 bg-[#13240f] px-4 py-3 text-center text-sm font-black text-lime-300">
          {streak > 0
            ? `🔥 ${streak} Day Streak! Keep it up, ${name}!`
            : `🎵 Practise today to start your streak, ${name}!`}
        </p>
        {videos.length === 0 && (
          <p className="rounded-3xl border border-dashed border-white/10 px-6 py-8 text-center text-sm text-zinc-400">
            No videos yet — tap ＋ and be the first to shred! 🎸
          </p>
        )}
        {items}
      </div>
    </>
  );
}
