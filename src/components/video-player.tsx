"use client";

import { forwardRef } from "react";
import type { VideoProvider } from "@/db/schema";

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
      return (
        <iframe
          src={url}
          className={
            className ?? "aspect-video w-full bg-black"
          }
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          loading="lazy"
          title="Performance video"
        />
      );
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
        preload="metadata"
        className={className ?? "aspect-video w-full bg-black"}
      />
    );
  },
);
