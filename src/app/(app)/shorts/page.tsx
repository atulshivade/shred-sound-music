import { desc, eq } from "drizzle-orm";
import { PlaySquare } from "lucide-react";
import { db } from "@/db";
import { challenges, performances, users } from "@/db/schema";
import { PerformanceCard } from "@/components/performance-card";

export const dynamic = "force-dynamic";

export default async function ShortsPage() {
  const clips = await db
    .select({
      performance: performances,
      student: { id: users.id, name: users.name, image: users.image },
      challenge: { id: challenges.id, title: challenges.title },
    })
    .from(performances)
    .innerJoin(users, eq(performances.studentId, users.id))
    .innerJoin(challenges, eq(performances.challengeId, challenges.id))
    .where(eq(performances.status, "PUBLISHED"))
    .orderBy(desc(performances.submittedAt));

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
        <div className="mx-auto h-[calc(100dvh-7.5rem)] max-w-lg snap-y snap-mandatory overflow-y-auto px-3 pb-3 md:h-[calc(100dvh-3.5rem)]">
          {clips.map((clip) => (
            <article
              key={clip.performance.id}
              className="flex min-h-full snap-start items-center py-3"
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
