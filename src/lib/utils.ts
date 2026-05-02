import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | number) {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function formatRelativeDeadline(deadline: Date | string): string {
  const target = new Date(deadline);
  const now = new Date();
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "Closed";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  if (days >= 1) return `${days}d ${hours}h left`;
  if (hours >= 1) return `${hours}h left`;
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  return `${minutes}m left`;
}

export function getInitials(nameOrEmail?: string | null): string {
  if (!nameOrEmail) return "?";
  const trimmed = nameOrEmail.trim();
  if (trimmed.includes("@")) return trimmed[0]!.toUpperCase();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function formatSeconds(s?: number | null): string {
  if (s == null || !Number.isFinite(s)) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const INSTRUMENT_LABELS: Record<string, string> = {
  ACOUSTIC_GUITAR: "Acoustic Guitar",
  ELECTRIC_GUITAR: "Electric Guitar",
  BASS_GUITAR: "Bass Guitar",
  KEYBOARD: "Keyboard",
  PIANO: "Piano",
  SYNTHESIZER: "Synthesizer",
  DRUMS: "Drums",
  VOCALS: "Vocals",
  VIOLIN: "Violin",
  FLUTE: "Flute",
  SAXOPHONE: "Saxophone",
  OTHER: "Other",
};

export function formatInstrument(value?: string | null): string {
  if (!value) return "—";
  return INSTRUMENT_LABELS[value] ?? value;
}

const SKILL_LABELS: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  PRO: "Pro",
};

export function formatSkillLevel(value?: string | null): string {
  if (!value) return "—";
  return SKILL_LABELS[value] ?? value;
}
