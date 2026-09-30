"use client";

import { forwardRef, useState } from "react";
import { Play } from "lucide-react";
import type { VideoProvider } from "@/db/schema";

const YOUTUBE_EMBED_ID = /youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/;

function withAutoplay(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}autoplay=1`;
}

/**
 * A third-party player costs roughly a megabyte of script per instance, so
 * feeds show a thumbnail and only mount the iframe once the viewer asks.
 */
function EmbedFacade({
  url,
  poster,
  className,
}: {
  url: string;
  poster?: string | null;
  className?: string;
}) {
  const [active, setActive] = useState(false);
  const frameClass = className ?? "aspect-video w-full bg-black";

  if (active) {
    return (
      <iframe
        src={withAutoplay(url)}
        className={frameClass}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        title="Performance video"
      />
    );
  }

  const youtubeId = url.match(YOUTUBE_EMBED_ID)?.[1];
  const thumbnail =
    poster ?? (youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : null);

  return (
    <button
      type="button"
      onClick={() => setActive(true)}
      aria-label="Play video"
      className={`group relative grid place-items-center overflow-hidden ${frameClass}`}
    >
      {thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote thumbnail hosts vary per provider
        <img
          src={thumbnail}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-black" />
      )}
      <span className="relative grid h-14 w-14 place-items-center rounded-full bg-black/60 text-white shadow-lg transition-transform group-hover:scale-110">
        <Play className="ml-1 h-7 w-7 fill-current" />
      </span>
    </button>
  );
}

type Props = {
  provider: VideoProvider;
  url: string;
  poster?: string | null;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
};

/**
 * Unified player. Direct <video> for LOCAL/BUNNY (HLS-via-native on Safari,
 * MP4 elsewhere); <iframe> for embed providers (Vimeo, YouTube). The forward
 * ref intentionally targets the <video> element so admin pages can read
 * currentTime to attach timestamped feedback.
 */
export const VideoPlayer = forwardRef<HTMLVideoElement, Props>(
  function VideoPlayer(
    {
      provider,
      url,
      poster,
      className,
      controls = true,
      autoPlay = false,
      loop = false,
      muted = false,
      playsInline = true,
    },
    ref,
  ) {
    if (provider === "VIMEO" || provider === "EMBED") {
      return <EmbedFacade url={url} poster={poster} className={className} />;
    }

    return (
      <video
        ref={ref}
        src={url}
        poster={poster ?? undefined}
        controls={controls}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline={playsInline}
        // With a poster there is nothing to show before play, so fetch nothing.
        preload={poster ? "none" : "metadata"}
        className={className ?? "aspect-video w-full bg-black"}
      />
    );
  },
);
