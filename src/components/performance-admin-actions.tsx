"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Crown,
  CheckCircle2,
  XCircle,
  MessageSquarePlus,
  Loader2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  togglePerformanceFlagAction,
  setPerformanceStatusAction,
  createFeedbackAction,
} from "@/lib/actions";
import { formatSeconds } from "@/lib/utils";
import type { Performance } from "@/db/schema";

export function PerformanceAdminActions({
  performance,
  currentTimeRef,
}: {
  performance: Pick<
    Performance,
    "id" | "isVerified" | "isBestPerformer" | "status"
  >;
  /** A ref kept by the parent that points at the playing video so we can
   * read currentTime when the teacher opens the feedback dialog. */
  currentTimeRef?: React.MutableRefObject<number | null>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        toast.error(res.error ?? "Action failed");
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2 border-t bg-muted/30 px-4 py-3">
      <Button
        size="sm"
        variant={performance.isVerified ? "default" : "outline"}
        disabled={pending}
        onClick={() =>
          run(
            () =>
              togglePerformanceFlagAction({
                performanceId: performance.id,
                isVerified: !performance.isVerified,
              }),
            performance.isVerified ? "Removed verification" : "Verified",
          )
        }
      >
        <BadgeCheck className="h-3.5 w-3.5" />
        {performance.isVerified ? "Verified" : "Verify"}
      </Button>

      <Button
        size="sm"
        variant={performance.isBestPerformer ? "default" : "outline"}
        disabled={pending}
        onClick={() =>
          run(
            () =>
              togglePerformanceFlagAction({
                performanceId: performance.id,
                isBestPerformer: !performance.isBestPerformer,
              }),
            performance.isBestPerformer
              ? "Removed Best Performer"
              : "Crowned Best Performer",
          )
        }
      >
        <Crown className="h-3.5 w-3.5" />
        {performance.isBestPerformer ? "Best Performer" : "Crown best"}
      </Button>

      {performance.status !== "PUBLISHED" && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                setPerformanceStatusAction({
                  performanceId: performance.id,
                  status: "PUBLISHED",
                }),
              "Published",
            )
          }
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Publish
        </Button>
      )}
      {performance.status !== "REJECTED" && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                setPerformanceStatusAction({
                  performanceId: performance.id,
                  status: "REJECTED",
                }),
              "Rejected",
            )
          }
        >
          <XCircle className="h-3.5 w-3.5" /> Reject
        </Button>
      )}

      <FeedbackDialog
        performanceId={performance.id}
        currentTimeRef={currentTimeRef}
        disabled={pending}
      />

      {pending && (
        <span className="ml-auto inline-flex items-center text-xs text-muted-foreground">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Saving…
        </span>
      )}
    </div>
  );
}

function FeedbackDialog({
  performanceId,
  currentTimeRef,
  disabled,
}: {
  performanceId: string;
  currentTimeRef?: React.MutableRefObject<number | null>;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [timestampSec, setTimestampSec] = useState<string>("");
  const [rhythm, setRhythm] = useState<string>("");
  const [technique, setTechnique] = useState<string>("");
  const [musicality, setMusicality] = useState<string>("");
  const [pending, startTransition] = useTransition();

  function captureCurrentTime() {
    const t = currentTimeRef?.current;
    if (t != null && Number.isFinite(t)) {
      setTimestampSec(String(Math.floor(t)));
    } else {
      toast.message("Press play on the video first to capture a timestamp");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createFeedbackAction({
        performanceId,
        note,
        timestampSec: timestampSec ? Number(timestampSec) : undefined,
        rhythmScore: rhythm ? Number(rhythm) : undefined,
        techniqueScore: technique ? Number(technique) : undefined,
        musicalityScore: musicality ? Number(musicality) : undefined,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Could not save feedback");
        return;
      }
      toast.success("Feedback saved");
      setOpen(false);
      setNote("");
      setTimestampSec("");
      setRhythm("");
      setTechnique("");
      setMusicality("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <MessageSquarePlus className="h-3.5 w-3.5" /> Add feedback
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Teacher feedback</DialogTitle>
          <DialogDescription>
            Internal feedback the student will see on their performance.
            Optional timestamp pins your note to a moment in the video.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              rows={4}
              required
              minLength={2}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Beautiful tone in the chorus. Watch the timing on the bridge."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timestamp">Timestamp (seconds)</Label>
            <div className="flex gap-2">
              <Input
                id="timestamp"
                type="number"
                min={0}
                value={timestampSec}
                onChange={(e) => setTimestampSec(e.target.value)}
                placeholder="42"
              />
              {currentTimeRef && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={captureCurrentTime}
                >
                  <Clock className="h-3.5 w-3.5" /> Use playhead
                </Button>
              )}
            </div>
            {timestampSec && (
              <p className="text-xs text-muted-foreground">
                Pinned to {formatSeconds(Number(timestampSec))}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <ScoreField
              id="rhythm"
              label="Rhythm"
              value={rhythm}
              onChange={setRhythm}
            />
            <ScoreField
              id="technique"
              label="Technique"
              value={technique}
              onChange={setTechnique}
            />
            <ScoreField
              id="musicality"
              label="Musicality"
              value={musicality}
              onChange={setMusicality}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save feedback
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ScoreField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        max={10}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0–10"
      />
    </div>
  );
}
