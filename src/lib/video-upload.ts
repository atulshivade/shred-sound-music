"use client";

import { useEffect, useState } from "react";
import type { VideoProvider } from "@/db/schema";

/**
 * Browser-side video upload helpers shared by every upload surface.
 *
 * Cloudinary deploys POST the file straight to Cloudinary with a signature
 * minted by `/api/upload/sign`, so the bytes never pass through a serverless
 * function and its 4.5 MB body cap. Everything else streams through our own
 * `/api/upload/video` relay.
 */

export type UploadCapabilities = {
  uploadsEnabled: boolean;
  reason: string | null;
  storageProvider: string;
  videoProvider: string;
};

export type UploadedVideo = {
  provider: VideoProvider;
  videoUrl: string;
  videoExternalId: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
};

const LOCAL_FALLBACK: UploadCapabilities = {
  uploadsEnabled: true,
  reason: null,
  storageProvider: "local",
  videoProvider: "local",
};

/** `null` while the probe is in flight. */
export function useUploadCapabilities(): UploadCapabilities | null {
  const [caps, setCaps] = useState<UploadCapabilities | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/upload/capabilities")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: UploadCapabilities | null) => {
        if (!cancelled) setCaps(j ?? LOCAL_FALLBACK);
      })
      .catch(() => {
        // A failed probe means local dev; the upload call surfaces real errors.
        if (!cancelled) setCaps(LOCAL_FALLBACK);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return caps;
}

async function uploadDirectToCloudinary(
  file: File,
  title: string,
  durationHint: number | null,
): Promise<UploadedVideo> {
  const signRes = await fetch(
    `/api/upload/sign?title=${encodeURIComponent(title.trim())}`,
    { cache: "no-store" },
  );
  if (!signRes.ok) {
    const ct = signRes.headers.get("content-type") ?? "";
    const body = ct.includes("application/json")
      ? (await signRes.json().catch(() => ({}))).error
      : (await signRes.text()).slice(0, 200);
    throw new Error(
      `Could not get an upload URL from the server (${signRes.status}). ${body ?? ""}`.trim(),
    );
  }
  const signed = (await signRes.json()) as {
    uploadUrl: string;
    cloudName: string;
    folder: string;
    params: {
      api_key: string;
      timestamp: string;
      folder: string;
      context?: string;
      signature: string;
    };
  };

  const fd = new FormData();
  fd.append("file", file, file.name);
  for (const [k, v] of Object.entries(signed.params)) fd.append(k, v);

  const upRes = await fetch(signed.uploadUrl, { method: "POST", body: fd });
  if (!upRes.ok) {
    const txt = await upRes.text().catch(() => "");
    throw new Error(
      `Cloudinary rejected the upload (${upRes.status}). ${txt.slice(0, 200)}`,
    );
  }
  const j = (await upRes.json()) as {
    public_id: string;
    secure_url: string;
    bytes: number;
    duration?: number;
  };

  return {
    provider: "CLOUDINARY",
    videoUrl: `https://res.cloudinary.com/${signed.cloudName}/video/upload/q_auto,f_auto/${j.public_id}.mp4`,
    videoExternalId: j.public_id,
    thumbnailUrl: `https://res.cloudinary.com/${signed.cloudName}/video/upload/so_2,w_960,h_540,c_fill,q_auto,f_jpg/${j.public_id}.jpg`,
    durationSeconds:
      typeof j.duration === "number" ? Math.round(j.duration) : durationHint,
  };
}

async function uploadViaServerRelay(
  file: File,
  title: string,
  durationHint: number | null,
): Promise<UploadedVideo> {
  const fd = new FormData();
  fd.append("file", file);
  if (title.trim()) fd.append("title", title.trim());
  const res = await fetch("/api/upload/video", { method: "POST", body: fd });
  if (!res.ok) {
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? `Upload failed (${res.status})`);
    }
    const txt = (await res.text()).slice(0, 200);
    throw new Error(
      `Upload rejected by the server (${res.status}). The file may be too ` +
        `large for this deployment's request limit. Try pasting a YouTube or ` +
        `Vimeo link instead. Server said: ${txt}`,
    );
  }
  const j = (await res.json()) as {
    provider: VideoProvider;
    externalId: string | null;
    playbackUrl: string;
    thumbnailUrl: string | null;
    durationSeconds: number | null;
  };
  return {
    provider: j.provider,
    videoUrl: j.playbackUrl,
    videoExternalId: j.externalId,
    thumbnailUrl: j.thumbnailUrl,
    durationSeconds: j.durationSeconds ?? durationHint,
  };
}

export function uploadVideoFile(
  file: File,
  title: string,
  caps: UploadCapabilities | null,
  durationHint: number | null = null,
): Promise<UploadedVideo> {
  const direct = (caps?.videoProvider ?? "").toLowerCase() === "cloudinary";
  return direct
    ? uploadDirectToCloudinary(file, title, durationHint)
    : uploadViaServerRelay(file, title, durationHint);
}

/** Normalise a pasted YouTube / Vimeo link to its embeddable player URL. */
export function classifyEmbedUrl(raw: string): {
  provider: VideoProvider;
  videoUrl: string;
} {
  const url = raw.trim();
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return { provider: "VIMEO", videoUrl: `https://player.vimeo.com/video/${id}` };
    } else if (u.hostname.endsWith("youtube.com") || u.hostname === "youtu.be") {
      const id =
        u.hostname === "youtu.be"
          ? u.pathname.slice(1)
          : u.pathname.startsWith("/shorts/")
            ? u.pathname.split("/")[2] ?? ""
            : u.searchParams.get("v") ?? "";
      if (id) return { provider: "EMBED", videoUrl: `https://www.youtube.com/embed/${id}` };
    }
  } catch {
    /* leave as-is */
  }
  return { provider: "EMBED", videoUrl: url };
}
