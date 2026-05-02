"use client";

import { useRef, useEffect } from "react";
import { PerformanceAdminActions } from "@/components/performance-admin-actions";
import type { Performance } from "@/db/schema";

/**
 * Wraps a PerformanceCard slot + admin action bar + feedback list slot,
 * threading a shared `currentTimeRef` so the "Use playhead" button on the
 * feedback dialog can capture the current playback time of the card's
 * <video> element. RSC-rendered children stay server-side; only this thin
 * shell is client.
 */
export function EvaluateRow({
  performance,
  cardSlot,
  feedbackSlot,
}: {
  performance: Pick<
    Performance,
    "id" | "isVerified" | "isBestPerformer" | "status"
  >;
  cardSlot: React.ReactNode;
  feedbackSlot: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentTimeRef = useRef<number | null>(null);

  // Find the inner <video> element rendered by PerformanceCard's player and
  // mirror its currentTime into the ref. <iframe> embeds (Vimeo / YouTube)
  // can't be sniffed from the parent — for those the user types the seconds
  // manually.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const video = root.querySelector("video");
    if (!video) return;
    const onTime = () => {
      currentTimeRef.current = video.currentTime;
    };
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("seeked", onTime);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("seeked", onTime);
    };
  }, []);

  return (
    <div ref={containerRef} className="flex flex-col">
      {cardSlot}
      <div className="-mt-px rounded-b-xl border border-t-0 bg-card">
        <PerformanceAdminActions
          performance={performance}
          currentTimeRef={currentTimeRef}
        />
        {feedbackSlot}
      </div>
    </div>
  );
}
