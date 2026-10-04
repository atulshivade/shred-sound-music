import type { Instrument } from "@/db/schema";

export const GRADIENTS = [
  "grad-violet",
  "grad-sunset",
  "grad-ocean",
  "grad-lime",
  "grad-berry",
  "grad-gold",
] as const;

/** Stable gradient for an id, so a card keeps its colour across renders. */
export function gradientFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

const EMOJI: Record<Instrument, string> = {
  ACOUSTIC_GUITAR: "🎸",
  ELECTRIC_GUITAR: "🎸",
  BASS_GUITAR: "🎸",
  KEYBOARD: "🎹",
  PIANO: "🎹",
  SYNTHESIZER: "🎛️",
  DRUMS: "🥁",
  VOCALS: "🎤",
  VIOLIN: "🎻",
  FLUTE: "🪈",
  SAXOPHONE: "🎷",
  OTHER: "🎵",
};

export function instrumentEmoji(i: Instrument | null | undefined): string {
  return i ? EMOJI[i] : "🎵";
}

const SHORT: Partial<Record<Instrument, string>> = {
  ACOUSTIC_GUITAR: "Guitar",
  ELECTRIC_GUITAR: "Electric",
  BASS_GUITAR: "Bass",
  SYNTHESIZER: "Synth",
};

export function instrumentShort(i: Instrument): string {
  return SHORT[i] ?? i.charAt(0) + i.slice(1).toLowerCase();
}

export function firstName(name: string | null | undefined): string {
  return (name ?? "Shredder").trim().split(/\s+/)[0] || "Shredder";
}
