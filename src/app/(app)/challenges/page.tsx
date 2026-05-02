import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { challenges } from "@/db/schema";
import { ChallengeCard } from "@/components/challenge-card";
import { Trophy, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ChallengesPage() {
  const active = await db
    .select()
    .from(challenges)
    .where(eq(challenges.status, "ACTIVE"))
    .orderBy(desc(challenges.createdAt));

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <Badge variant="accent" className="w-fit">
          <Sparkles className="mr-1 h-3 w-3" /> Live now
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">Active challenges</h1>
        <p className="text-muted-foreground">
          Pick a challenge, build something brilliant, and ship it before the deadline.
        </p>
      </header>

      {active.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((c) => (
            <Link key={c.id} href={`/challenges/${c.id}`}>
              <ChallengeCard challenge={c} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Trophy className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">No active challenges yet</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Check back soon — your team is cooking up the next one.
      </p>
    </div>
  );
}
