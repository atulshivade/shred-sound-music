"use client";

import { useState } from "react";
import { VideoPlayer } from "@/components/video-player";
import type { VideoProvider } from "@/db/schema";
import { cn } from "@/lib/utils";

const YOUTUBE_EMBED_ID = /youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/;

/**
 * Thumbnail first, player on tap: nothing heavy loads until the student asks
 * for it, which keeps a long feed fast on a phone.
 */
export function VideoTile({
  provider,
  url,
  poster,
  gradient,
  emoji,
  className,
  overlay,
}: {
  provider: VideoProvider;
  url: string;
  poster: string | null;
  gradient: string;
  emoji: string;
  className?: string;
  /** Chips / labels drawn on top of the thumbnail. */
  overlay?: React.ReactNode;
}) {
  const [playing, setPlaying] = useState(false);
  const frame = cn("relative w-full overflow-hidden", className ?? "aspect-video");

  if (playing) {
    return (
      <div className={cn(frame, "bg-black")}>
        <VideoPlayer
          provider={provider}
          url={url}
          poster={poster}
          autoPlay
          className="absolute inset-0 h-full w-full bg-black object-contain"
        />
      </div>
    );
  }

  const youtubeId = url.match(YOUTUBE_EMBED_ID)?.[1];
  const thumbnail = poster ?? (youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : null);

  return (
    <div className={cn(frame, !thumbnail && gradient)}>
      {thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element -- thumbnail hosts vary per provider
        <img
          src={thumbnail}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden className="absolute inset-0 grid place-items-center text-7xl opacity-30">
          {emoji}
        </span>
      )}
      <button
        type="button"
        onClick={() => setPlaying(true)}
        aria-label="Play video"
        className="group absolute inset-0 grid place-items-center"
      >
        <span className="grid h-16 w-16 place-items-center rounded-full bg-white/25 shadow-xl ring-2 ring-white/40 backdrop-blur transition-transform group-hover:scale-110">
          <span className="ml-1 h-0 w-0 border-y-[12px] border-l-[20px] border-y-transparent border-l-white" />
        </span>
      </button>
      {overlay && <div className="pointer-events-none absolute inset-0">{overlay}</div>}
    </div>
  );
}
