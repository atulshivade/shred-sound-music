import Link from "next/link";

/** Sticky top bar used by every student screen. */
export function PageHeader({
  title,
  right,
  showLogo = false,
}: {
  title: React.ReactNode;
  right?: React.ReactNode;
  showLogo?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 bg-[#0b0b10]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-lg items-center gap-3 px-4">
        {showLogo ? (
          <Link href="/feed" aria-label="Shred Sound Music — home" className="flex shrink-0 items-center gap-1.5">
            <span aria-hidden className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 text-lg shadow-md shadow-orange-900/40">
              ⚡
            </span>
            <span className="text-[13px] font-black leading-[1.05] tracking-tight">
              SHRED
              <br />
              SOUND
            </span>
          </Link>
        ) : null}
        <h1 className={showLogo ? "flex-1 text-center text-lg font-black" : "flex-1 text-2xl font-black"}>
          {title}
        </h1>
        {right ?? (showLogo ? <span className="w-10" /> : null)}
      </div>
    </header>
  );
}

export function Pill({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-600/20 px-3 py-1.5 text-sm font-black text-violet-200 ring-1 ring-violet-500/40 ${className}`}>
      {children}
    </span>
  );
}
