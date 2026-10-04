"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

export type StudentNotification = {
  id: string;
  text: string;
  emoji: string;
  at: string;
};

const SEEN_KEY = "ssm:notifications-seen";
const SEEN_EVENT = "ssm:notifications-seen-change";

function subscribeSeen(onChange: () => void) {
  window.addEventListener(SEEN_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SEEN_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readSeen() {
  return window.localStorage.getItem(SEEN_KEY) ?? "";
}

/**
 * Updates about the student's own submissions only. There is deliberately
 * no messaging here: students never receive messages from other students.
 */
export function NotificationsBell({ items }: { items: StudentNotification[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const newest = items[0]?.at ?? "";
  const seen = useSyncExternalStore(subscribeSeen, readSeen, () => null);
  const unread = seen !== null && newest !== "" && newest > seen;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  function toggle() {
    setOpen((o) => !o);
    if (newest) {
      window.localStorage.setItem(SEEN_KEY, newest);
      window.dispatchEvent(new Event(SEEN_EVENT));
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread ? "Notifications (new)" : "Notifications"}
        aria-expanded={open}
        className="relative grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-lg hover:bg-white/10"
      >
        <span aria-hidden>🔔</span>
        {unread && (
          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-[#0b0b10]" />
        )}
      </button>
      {open && (
        <div className="animate-pop-in absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#1b1b25] shadow-2xl">
          <p className="border-b border-white/5 px-4 py-3 text-sm font-black">Updates</p>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-400">
              Nothing yet — upload your first shred! 🎸
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className={cn("flex gap-3 px-4 py-3 text-sm", "border-b border-white/5 last:border-0")}>
                  <span aria-hidden className="text-lg">{n.emoji}</span>
                  <span className="text-zinc-200">{n.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
