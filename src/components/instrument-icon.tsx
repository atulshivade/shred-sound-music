import {
  Guitar,
  Piano,
  Drum,
  Mic2,
  Music2,
  Music,
  AudioLines,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Instrument } from "@/db/schema";

const ICON_MAP: Record<Instrument, LucideIcon> = {
  ACOUSTIC_GUITAR: Guitar,
  ELECTRIC_GUITAR: Guitar,
  BASS_GUITAR: Guitar,
  KEYBOARD: Piano,
  PIANO: Piano,
  SYNTHESIZER: AudioLines,
  DRUMS: Drum,
  VOCALS: Mic2,
  VIOLIN: Music2,
  FLUTE: Music,
  SAXOPHONE: Music,
  OTHER: Music,
};

export function InstrumentIcon({
  instrument,
  className,
}: {
  instrument: Instrument | null | undefined;
  className?: string;
}) {
  const Icon = instrument ? ICON_MAP[instrument] : Music;
  return <Icon className={className} aria-hidden="true" />;
}
