"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { createPerformanceAction } from "@/lib/actions";
import {
  classifyEmbedUrl,
  uploadVideoFile,
  useUploadCapabilities,
} from "@/lib/video-upload";
import { cn } from "@/lib/utils";
import type { Instrument, SkillLevel, VideoProvider } from "@/db/schema";

const MAX_BYTES = 100 * 1024 * 1024;

const INSTRUMENT_PILLS: { value: Instrument; label: string }[] = [
  { value: "PIANO", label: "🎹 Piano" },
  { value: "ACOUSTIC_GUITAR", label: "🎸 Guitar" },
  { value: "KEYBOARD", label: "🎼 Keyboard" },
  { value: "DRUMS", label: "🥁 Drums" },
  { value: "VOCALS", label: "🎤 Vocals" },
  { value: "OTHER", label: "🎵 Other" },
];

export type UploadChallenge = { id: string; title: string };

type OpenOptions = {
  challengeId?: string;
  songName?: string;
  instrument?: Instrument;
};

const UploadSheetContext = createContext<{ open: (o?: OpenOptions) => void } | null>(null);

export function useUploadSheet() {
  const ctx = useContext(UploadSheetContext);
  if (!ctx) throw new Error("useUploadSheet must be used inside <UploadSheetProvider>");
  return ctx;
}

/** Any element that should open the upload sheet. */
export function OpenUploadButton({
  options,
  className,
  children,
  ...rest
}: {
  options?: OpenOptions;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type">) {
  const { open } = useUploadSheet();
  return (
    <button type="button" className={className} onClick={() => open(options)} {...rest}>
      {children}
    </button>
  );
}

export function UploadSheetProvider({
  challenges,
  defaultInstrument,
  skillLevel,
  children,
}: {
  challenges: UploadChallenge[];
  defaultInstrument: Instrument | null;
  skillLevel: SkillLevel | null;
  children: React.ReactNode;
}) {
  const [openWith, setOpenWith] = useState<OpenOptions | null>(null);
  const open = useCallback((o?: OpenOptions) => setOpenWith(o ?? {}), []);

  return (
    <UploadSheetContext.Provider value={{ open }}>
      {children}
      <button
        type="button"
        onClick={() => open()}
        aria-label="Upload your shred"
        className="grad-fab fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full text-2xl text-white shadow-[0_8px_24px_-4px_rgba(255,77,90,0.6)] ring-4 ring-[#0b0b10] transition-transform hover:scale-105 active:scale-95"
      >
        <span aria-hidden>＋</span>
      </button>
      {openWith && (
        <UploadSheet
          key={JSON.stringify(openWith)}
          initial={openWith}
          challenges={challenges}
          defaultInstrument={defaultInstrument}
          skillLevel={skillLevel}
          onClose={() => setOpenWith(null)}
        />
      )}
    </UploadSheetContext.Provider>
  );
}

function UploadSheet({
  initial,
  challenges,
  defaultInstrument,
  skillLevel,
  onClose,
}: {
  initial: OpenOptions;
  challenges: UploadChallenge[];
  defaultInstrument: Instrument | null;
  skillLevel: SkillLevel | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const caps = useUploadCapabilities();
  const uploadsEnabled = caps?.uploadsEnabled ?? true;
  const fileInput = useRef<HTMLInputElement | null>(null);
  const preview = useRef<HTMLVideoElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);

  const [useLink, setUseLink] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [challengeId, setChallengeId] = useState(
    initial.challengeId ?? challenges[0]?.id ?? "",
  );
  const [songName, setSongName] = useState(initial.songName ?? "");
  const [instrument, setInstrument] = useState<Instrument>(
    initial.instrument ?? defaultInstrument ?? "PIANO",
  );
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = uploading || pending;
  const linkMode = useLink || !uploadsEnabled;

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [busy, onClose]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function pick(f: File | null) {
    if (f && f.size > MAX_BYTES) {
      toast.error("That video is bigger than 100MB — try a shorter clip");
      return;
    }
    setFile(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeId) {
      toast.error("There is no open challenge to submit to right now");
      return;
    }
    if (!songName.trim()) {
      toast.error("Add the song name");
      return;
    }

    let video: {
      videoProvider: VideoProvider;
      videoUrl: string;
      videoExternalId?: string | null;
      videoDurationSeconds?: number | null;
      thumbnailUrl?: string | null;
    };
    try {
      if (linkMode) {
        if (!link.trim()) {
          toast.error("Paste a YouTube or Vimeo link");
          return;
        }
        const embed = classifyEmbedUrl(link);
        video = { videoProvider: embed.provider, videoUrl: embed.videoUrl };
      } else {
        if (!file) {
          toast.error("Pick a video first");
          return;
        }
        setUploading(true);
        try {
          const d = preview.current?.duration;
          const uploaded = await uploadVideoFile(
            file,
            songName,
            caps,
            d != null && Number.isFinite(d) ? Math.round(d) : null,
          );
          video = {
            videoProvider: uploaded.provider,
            videoUrl: uploaded.videoUrl,
            videoExternalId: uploaded.videoExternalId,
            videoDurationSeconds: uploaded.durationSeconds,
            thumbnailUrl: uploaded.thumbnailUrl,
          };
        } finally {
          setUploading(false);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      return;
    }

    startTransition(async () => {
      const res = await createPerformanceAction({
        challengeId,
        title: songName.trim(),
        caption: caption.trim() || undefined,
        instrument,
        skillLevel: skillLevel ?? "BEGINNER",
        ...video,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Performance submitted for teacher approval");
      onClose();
      router.refresh();
    });
  }

  const label = "mb-1.5 block text-sm font-extrabold text-zinc-200";
  const field =
    "w-full rounded-xl border border-white/10 bg-[#23232f] px-3.5 py-3 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-violet-500";

  return (
    <div className="student-app fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default"
        onClick={() => !busy && onClose()}
      />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="animate-sheet-up relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[#15151d] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 outline-none"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/15" />
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-xl font-black">
            🎬 Upload Your Shred
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close upload"
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-zinc-300 hover:bg-white/15"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {linkMode ? (
            <div>
              <label htmlFor="shred-link" className={label}>
                YouTube or Vimeo link *
              </label>
              <input
                id="shred-link"
                type="url"
                inputMode="url"
                placeholder="https://youtu.be/…"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className={field}
              />
              {uploadsEnabled && (
                <button
                  type="button"
                  onClick={() => setUseLink(false)}
                  className="mt-2 text-xs font-bold text-violet-400"
                >
                  Upload a video file instead
                </button>
              )}
            </div>
          ) : (
            <div>
              <input
                ref={fileInput}
                id="shred-file"
                type="file"
                accept="video/mp4,video/quicktime,video/*"
                className="sr-only"
                onChange={(e) => pick(e.target.files?.[0] ?? null)}
              />
              {previewUrl ? (
                <div className="overflow-hidden rounded-2xl bg-black">
                  <video
                    ref={preview}
                    src={previewUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="aspect-video w-full"
                  />
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="w-full bg-white/5 py-2 text-xs font-bold text-violet-300"
                  >
                    Choose a different video
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="shred-file"
                  className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-violet-500/50 bg-violet-500/5 px-4 py-8 text-center transition-colors hover:bg-violet-500/10"
                >
                  <span aria-hidden className="text-4xl">📹</span>
                  <span className="font-extrabold">Tap to select video</span>
                  <span className="text-xs text-zinc-400">MP4, MOV up to 100MB</span>
                </label>
              )}
              <button
                type="button"
                onClick={() => setUseLink(true)}
                className="mt-2 text-xs font-bold text-violet-400"
              >
                Or paste a YouTube link
              </button>
            </div>
          )}

          <div>
            <label htmlFor="shred-challenge" className={label}>
              Challenge *
            </label>
            {challenges.length === 0 ? (
              <p className="rounded-xl bg-white/5 px-3.5 py-3 text-sm text-zinc-400">
                No open challenges right now — check back soon!
              </p>
            ) : (
              <select
                id="shred-challenge"
                value={challengeId}
                onChange={(e) => setChallengeId(e.target.value)}
                className={field}
              >
                {challenges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label htmlFor="shred-song" className={label}>
              Song Name *
            </label>
            <input
              id="shred-song"
              value={songName}
              onChange={(e) => setSongName(e.target.value)}
              placeholder="e.g. Twinkle Twinkle Little Star"
              maxLength={120}
              className={field}
            />
          </div>

          <fieldset>
            <legend className={label}>Instrument *</legend>
            <div className="flex flex-wrap gap-2">
              {INSTRUMENT_PILLS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={instrument === p.value}
                  onClick={() => setInstrument(p.value)}
                  className={cn(
                    "rounded-full border px-3.5 py-2 text-sm font-bold transition-colors",
                    instrument === p.value
                      ? "border-violet-500 bg-violet-600 text-white"
                      : "border-white/10 bg-[#23232f] text-zinc-300 hover:border-white/20",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="shred-caption" className={label}>
              Caption <span className="font-semibold text-zinc-500">(optional)</span>
            </label>
            <textarea
              id="shred-caption"
              rows={2}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Tell everyone about your performance! 🎵"
              maxLength={300}
              className={field}
            />
          </div>

          <p className="flex items-start gap-2 rounded-xl border border-lime-500/30 bg-lime-500/10 px-3.5 py-3 text-sm font-semibold text-lime-300">
            <span aria-hidden>✅</span>
            Your video will be reviewed by your teacher before going live
          </p>

          <button
            type="submit"
            disabled={busy || challenges.length === 0}
            className="grad-violet flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-black text-white shadow-lg shadow-violet-900/40 transition-opacity disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {uploading ? "Uploading…" : pending ? "Sending…" : "Submit for Approval"}
          </button>
        </form>
      </div>
    </div>
  );
}
