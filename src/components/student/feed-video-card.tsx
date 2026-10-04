import type { Performance } from "@/db/schema";
import { VideoTile } from "@/components/student/video-tile";
import { ReactionPills } from "@/components/student/reactions";
import { StudentAvatar } from "@/components/student/avatar";
import { firstName, gradientFor, instrumentEmoji, instrumentShort } from "@/components/student/visuals";

export function FeedVideoCard({
  performance: p,
  student,
  challengeTitle,
  counts,
  mine,
  statusBadge,
}: {
  performance: Performance;
  student: { id: string; name: string | null };
  challengeTitle: string;
  counts?: { CLAP: number; SHRED: number };
  mine?: { liked: boolean; CLAP: boolean; SHRED: boolean };
  /** Shown to the uploader on their own unpublished video. */
  statusBadge?: string;
}) {
  const who = firstName(student.name);
  const emoji = instrumentEmoji(p.instrument);
  const published = p.status === "PUBLISHED";
  return (
    <article className="animate-pop-in overflow-hidden rounded-3xl border border-white/5 bg-[#17171f]">
      <VideoTile
        provider={p.videoProvider}
        url={p.videoUrl}
        poster={p.thumbnailUrl}
        gradient={gradientFor(p.id)}
        emoji={emoji}
        overlay={
          <div className="flex items-start justify-between gap-2 p-3">
            <span className="rounded-full bg-black/45 px-2.5 py-1 text-xs font-black text-white backdrop-blur">
              {emoji} {instrumentShort(p.instrument)}
            </span>
            {statusBadge ? (
              <span className="rounded-full bg-black/60 px-2.5 py-1 text-xs font-black text-white">{statusBadge}</span>
            ) : p.isBestPerformer ? (
              <span className="rounded-full bg-amber-400 px-2.5 py-1 text-xs font-black text-[#1a1204]">🏆 Best</span>
            ) : null}
          </div>
        }
      />
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <StudentAvatar id={student.id} name={student.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-black">{p.title ?? `Watch ${who} play ${challengeTitle} ${emoji}`}</p>
            <p className="truncate text-xs font-semibold text-zinc-400">
              by {who} · {challengeTitle}
            </p>
          </div>
        </div>
        {p.caption && <p className="line-clamp-2 text-sm text-zinc-300">{p.caption}</p>}
        {published && (
          <ReactionPills
            performanceId={p.id}
            initial={{
              likes: p.likesCount,
              liked: mine?.liked ?? false,
              clap: counts?.CLAP ?? 0,
              clapped: mine?.CLAP ?? false,
              shred: counts?.SHRED ?? 0,
              shredded: mine?.SHRED ?? false,
            }}
            shareUrl={`/shorts?v=${p.id}`}
            shareText={`Watch ${who} shred on Shred Sound Music! ${emoji}`}
          />
        )}
      </div>
    </article>
  );
}
