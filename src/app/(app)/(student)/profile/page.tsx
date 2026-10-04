import Link from "next/link";
import { requireUser, signOut } from "@/lib/auth";
import { getStudentDashboard } from "@/lib/student-data";
import { formatXp } from "@/lib/gamification";
import { cn, formatDate } from "@/lib/utils";
import { StudentAvatar } from "@/components/student/avatar";
import { ShareButton } from "@/components/student/reactions";
import { firstName, gradientFor, instrumentEmoji, instrumentShort } from "@/components/student/visuals";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { user } = await requireUser();
  const { user: profile, own, stats, level, badges } = await getStudentDashboard(user.id);
  const name = firstName(profile?.name ?? user.name);
  const earned = badges.filter((b) => b.earned).length;
  const instrument = profile?.primaryInstrument ?? null;

  const achievements = own
    .filter((p) => p.status === "PUBLISHED")
    .slice(0, 6)
    .map((p) =>
      p.isBestPerformer
        ? { id: p.id, gold: true, title: `Best Performer · ${p.challengeTitle}`, sub: `${formatDate(p.submittedAt)} · +${p.challengePoints} XP earned` }
        : { id: p.id, gold: false, title: `Completed ${p.challengeTitle}`, sub: `Approved by your teacher · ${formatDate(p.submittedAt)}` },
    )
    .sort((a, b) => Number(b.gold) - Number(a.gold))
    .slice(0, 4);

  const tiles = [
    { emoji: "🏆", value: earned, label: "Badges" },
    { emoji: "🎵", value: stats.songsCount, label: "Songs" },
    { emoji: "🔥", value: stats.challengesCompleted, label: "Challenges" },
    { emoji: "⭐", value: formatXp(stats.xp), label: "XP" },
  ];

  return (
    <div className="space-y-6 pb-4">
      <section className="grad-violet relative rounded-b-[2rem] px-5 pb-6 pt-5 text-white">
        <div className="flex justify-end gap-2">
          {user.role === "ADMIN" && (
            <Link href="/admin" className="glass-btn rounded-full px-3 py-1.5 text-xs font-black">
              🎓 Teacher Studio
            </Link>
          )}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button type="submit" className="glass-btn rounded-full px-3 py-1.5 text-xs font-black">
              Sign out
            </button>
          </form>
        </div>
        <div className="mt-2 flex flex-col items-center text-center">
          <StudentAvatar id={user.id} name={profile?.name ?? user.name ?? null} size="xl" ring />
          <h1 className="mt-3 text-3xl font-black">{name}</h1>
          <p className="mt-1 text-sm font-bold text-white/85">
            {instrumentEmoji(instrument)} {instrument ? instrumentShort(instrument) : "Musician"} · Level {level.level}
            {stats.streak > 0 && ` · 🔥 ${stats.streak} day streak`}
          </p>
          <div className="mt-4 w-full max-w-xs">
            <div className="h-2.5 overflow-hidden rounded-full bg-black/25">
              <div className="h-full rounded-full bg-white" style={{ width: `${Math.round(level.progress * 100)}%` }} />
            </div>
            <p className="mt-1.5 text-xs font-bold text-white/80">
              {level.toNext} XP to Level {level.level + 1}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 px-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-3xl border border-white/5 bg-[#17171f] p-4 text-center">
            <span aria-hidden className="text-2xl">{t.emoji}</span>
            <p className="mt-1 text-2xl font-black">{t.value}</p>
            <p className="text-xs font-bold text-zinc-400">{t.label}</p>
          </div>
        ))}
      </section>

      <section className="px-4">
        <h2 className="mb-3 text-lg font-black">My Badges 🏆</h2>
        <ul className="grid grid-cols-3 gap-3">
          {badges.map((b) => (
            <li key={b.id} className="flex flex-col items-center text-center" title={b.hint}>
              <span
                className={cn(
                  "grid h-16 w-16 place-items-center rounded-full text-3xl",
                  b.earned ? `${gradientFor(b.id)} shadow-lg shadow-black/40` : "bg-white/[0.05] grayscale",
                )}
              >
                {b.earned ? b.emoji : "🔒"}
              </span>
              <span className={cn("mt-1.5 text-xs font-black", !b.earned && "text-zinc-500")}>{b.name}</span>
              <span className={cn("text-[10px] font-bold", b.earned ? "text-lime-400" : "text-zinc-600")}>
                {b.earned ? "Earned" : "Locked"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="px-4">
        <h2 className="mb-3 text-lg font-black">Recent Achievements</h2>
        {achievements.length === 0 ? (
          <p className="text-sm text-zinc-400">Get a video approved to earn your first achievement! 🌟</p>
        ) : (
          <ul className="space-y-2.5">
            {achievements.map((a) => (
              <li
                key={a.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3.5",
                  a.gold ? "grad-gold text-[#1a1204]" : "grad-violet text-white",
                )}
              >
                <span aria-hidden className="text-2xl">{a.gold ? "🏆" : "🎖️"}</span>
                <div className="min-w-0">
                  <p className="truncate font-black">{a.title}</p>
                  <p className="text-xs font-bold opacity-75">{a.sub}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="px-4">
        <ShareButton
          url="/"
          text={`I'm Level ${level.level} on Shred Sound Music with ${formatXp(stats.xp)} XP and ${earned} badges! 🎸`}
          className="grad-berry w-full rounded-3xl px-5 py-4 text-left text-white shadow-xl shadow-pink-950/40"
        >
          <span className="block text-lg font-black">🎉 Share My Achievement</span>
          <span className="block text-sm font-semibold text-white/85">Share with family & friends!</span>
        </ShareButton>
      </section>

      <section className="px-4">
        <h2 className="mb-3 text-lg font-black">My Performances 🎬</h2>
        {own.length === 0 ? (
          <p className="text-sm text-zinc-400">Tap ＋ to upload your first shred!</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {own.map((p) => {
              const tile = (
                <>
                  {p.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- thumbnail hosts vary per provider
                    <img src={p.thumbnailUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <span aria-hidden className="absolute inset-0 grid place-items-center text-3xl">
                      {instrumentEmoji(p.instrument)}
                    </span>
                  )}
                  {p.status !== "PUBLISHED" && (
                    <span className="absolute inset-x-1 bottom-1 rounded-full bg-black/60 py-0.5 text-center text-[10px] font-black">
                      {p.status === "PENDING" ? "⏳ In review" : "💬 See notes"}
                    </span>
                  )}
                  <span className="sr-only">{p.title ?? p.challengeTitle}</span>
                </>
              );
              const cls = cn("relative block aspect-[3/4] overflow-hidden rounded-2xl", gradientFor(p.id));
              return (
                <li key={p.id}>
                  {p.status === "PUBLISHED" ? (
                    <Link href={`/shorts?v=${p.id}`} className={cls}>
                      {tile}
                    </Link>
                  ) : (
                    <Link href={`/challenges/${p.challengeId}`} className={cls}>
                      {tile}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
