"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/feed", emoji: "🏠", label: "Home" },
  { href: "/shorts", emoji: "🎬", label: "Shorts" },
  { href: "/challenges", emoji: "🏆", label: "Challenges" },
  { href: "/learn", emoji: "📚", label: "Learn" },
  { href: "/profile", emoji: "👤", label: "Profile" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-[#101017]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold transition-colors",
                  active ? "text-violet-400" : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                {active && (
                  <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-violet-500" />
                )}
                <span
                  aria-hidden
                  className={cn("text-xl leading-none transition-transform", active && "scale-110")}
                >
                  {tab.emoji}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
