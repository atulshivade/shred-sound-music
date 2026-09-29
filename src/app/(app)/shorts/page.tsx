import { PlaySquare } from "lucide-react";
import { PerformanceCard } from "@/components/performance-card";
import { getPublishedPerformances } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ShortsPage() {
  const clips = await getPublishedPerformances();

  return (
    <section className="bg-ink text-ink-foreground">
      <header className="mx-auto flex max-w-lg items-center justify-center gap-2 px-4 py-4">
        <PlaySquare className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Shred Shorts</h1>
      </header>
      {clips.length === 0 ? (
        <div className="grid min-h-[60dvh] place-items-center px-6 text-center text-sm text-ink-foreground/70">
          Approved student performances will appear here.
        </div>
      ) : (
        // Full-height snapping is the point of Shorts on a phone, but on a
        // desktop viewport it strands one narrow card in a tall empty column.
        // From `md` up the same cards lay out as an ordinary gallery.
        <div className="mx-auto h-[calc(100dvh-7.5rem)] max-w-lg snap-y snap-mandatory overflow-y-auto px-3 pb-3 md:grid md:h-auto md:max-w-6xl md:grid-cols-2 md:snap-none md:gap-5 md:overflow-visible md:px-6 md:pb-12 lg:grid-cols-3">
          {clips.map((clip) => (
            <article
              key={clip.performance.id}
              className="flex min-h-full snap-start items-center py-3 md:min-h-0 md:py-0"
            >
              <PerformanceCard
                performance={clip.performance}
                student={clip.student}
                challenge={clip.challenge}
              />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
