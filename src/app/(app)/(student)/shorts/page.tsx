import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getPublishedPerformances } from "@/lib/queries";
import { getReactionCounts, getViewerReactions } from "@/lib/student-data";
import type { Instrument } from "@/db/schema";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/student/page-header";
import { VideoTile } from "@/components/student/video-tile";
import { ReactionRail } from "@/components/student/reactions";
import { StudentAvatar } from "@/components/student/avatar";
import { firstName, gradientFor, instrumentEmoji, instrumentShort } from "@/components/student/visuals";

export const dynamic = "force-dynamic";

const CATEGORIES: { id: string; label: string; match: (i: Instrument, best: boolean) => boolean }[] = [
  { id: "all", label: "✨ All", match: () => true },
  { id: "piano", label: "🎹 Piano", match: (i) => i === "PIANO" || i === "KEYBOARD" || i === "SYNTHESIZER" },
  { id: "guitar", label: "🎸 Guitar", match: (i) => i.endsWith("GUITAR") },
  { id: "drums", label: "🥁 Drums", match: (i) => i === "DRUMS" },
  { id: "vocals", label: "🎤 Vocals", match: (i) => i === "VOCALS" },
  { id: "top", label: "🏆 Top Picks", match: (_, best) => best },
];

export default async function ShortsPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; v?: string }>;
}) {
  const [{ user }, { c, v }] = await Promise.all([requireUser(), searchParams]);
  const category = CATEGORIES.find((x) => x.id === c) ?? CATEGORIES[0];
  const [published, counts] = await Promise.all([getPublishedPerformances(), getReactionCounts()]);

  let clips = published.filter((r) => category.match(r.performance.instrument, r.performance.isBestPerformer));
  // A shared link opens on that clip first.
  if (v) {
    const target = published.find((r) => r.performance.id === v);
    if (target) clips = [target, ...clips.filter((r) => r.performance.id !== v)];
  }
  const mine = await getViewerReactions(user.id, clips.map((r) => r.performance.id));

  return (
    <>
      <PageHeader title="🎬 Shorts" />
      <nav aria-label="Categories" className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.id}
            href={cat.id === "all" ? "/shorts" : `/shorts?c=${cat.id}`}
            aria-current={cat.id === category.id ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-black transition-colors",
              cat.id === category.id ? "bg-violet-600 text-white" : "bg-white/[0.07] text-zinc-300 hover:bg-white/[0.12]",
            )}
          >
            {cat.label}
          </Link>
        ))}
      </nav>

      {clips.length === 0 ? (
        <div className="mx-4 grid min-h-[50dvh] place-items-center rounded-3xl border border-dashed border-white/10 px-6 text-center text-sm text-zinc-400">
          No approved videos here yet — tap ＋ to share yours! 🎶
        </div>
      ) : (
        <div className="no-scrollbar h-[calc(100dvh-14rem)] snap-y snap-mandatory space-y-4 overflow-y-auto px-4">
          {clips.map((clip) => {
            const p = clip.performance;
            const who = firstName(clip.student.name);
            const emoji = instrumentEmoji(p.instrument);
            return (
              <article key={p.id} id={p.id} className="relative h-full snap-start overflow-hidden rounded-3xl">
                <VideoTile
                  provider={p.videoProvider}
                  url={p.videoUrl}
                  poster={p.thumbnailUrl}
                  gradient={gradientFor(p.id)}
                  emoji={emoji}
                  className="h-full"
                  overlay={
                    <>
                      <span className="absolute left-3 top-3 rounded-full bg-lime-500/90 px-2.5 py-1 text-xs font-black text-[#0b0b10]">
                        ✅ Approved by Teacher
                      </span>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 pr-20 pt-16 text-white">
                        <div className="flex items-center gap-2">
                          <StudentAvatar id={clip.student.id} name={clip.student.name} size="sm" />
                          <span className="font-black">{who}</span>
                          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-black">
                            {emoji} {instrumentShort(p.instrument)}
                          </span>
                        </div>
                        <p className="mt-2 truncate text-sm font-bold">🎵 {p.title ?? clip.challenge.title}</p>
                      </div>
                    </>
                  }
                />
                <div className="absolute bottom-20 right-3">
                  <ReactionRail
                    performanceId={p.id}
                    initial={{
                      likes: p.likesCount,
                      liked: mine[p.id]?.liked ?? false,
                      clap: counts[p.id]?.CLAP ?? 0,
                      clapped: mine[p.id]?.CLAP ?? false,
                      shred: counts[p.id]?.SHRED ?? 0,
                      shredded: mine[p.id]?.SHRED ?? false,
                    }}
                    shareUrl={`/shorts?v=${p.id}`}
                    shareText={`Watch ${who} shred on Shred Sound Music! ${emoji}`}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
