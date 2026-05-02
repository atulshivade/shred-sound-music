import { notFound } from "next/navigation";
import { eq, desc, and, inArray } from "drizzle-orm";
import { Calendar, Trophy, Sparkles, Music2, Crown } from "lucide-react";
import { db } from "@/db";
import {
  challenges,
  performances,
  performanceLikes,
  users,
} from "@/db/schema";
import type { Instrument } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PerformanceCard } from "@/components/performance-card";
import { PerformanceUploader } from "@/components/performance-uploader";
import { InstrumentIcon } from "@/components/instrument-icon";
import {
  formatRelativeDeadline,
  formatDate,
  formatInstrument,
  formatSkillLevel,
} from "@/lib/utils";
import { INSTRUMENT_VALUES } from "@/lib/validators";

export const dynamic = "force-dynamic";

export default async function ChallengeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ instrument?: string }>;
}) {
  const { id } = await params;
  const { instrument: filterParam } = await searchParams;
  const filterInstrument =
    filterParam &&
    (INSTRUMENT_VALUES as readonly string[]).includes(filterParam)
      ? (filterParam as Instrument)
      : null;
  const session = await auth();

  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.id, id))
    .limit(1);

  if (!challenge) notFound();

  const where = filterInstrument
    ? and(
        eq(performances.challengeId, id),
        eq(performances.instrument, filterInstrument),
      )
    : eq(performances.challengeId, id);

  const subs = await db
    .select({
      performance: performances,
      student: { id: users.id, name: users.name, image: users.image },
    })
    .from(performances)
    .innerJoin(users, eq(performances.studentId, users.id))
    .where(where)
    .orderBy(desc(performances.isBestPerformer), desc(performances.submittedAt));

  // Distinct instruments present, used to render filter chips.
  const instrumentsPresent = Array.from(
    new Set(
      (
        await db
          .select({ instrument: performances.instrument })
          .from(performances)
          .where(eq(performances.challengeId, id))
      ).map((r) => r.instrument),
    ),
  ) as Instrument[];

  const deadlineLabel = formatRelativeDeadline(challenge.deadline);
  const closed = deadlineLabel === "Closed" || challenge.status !== "ACTIVE";
  const isAdmin = session?.user?.role === "ADMIN";
  const viewerId = session?.user?.id;
  const myOwn = viewerId
    ? subs.filter((s) => s.performance.studentId === viewerId)
    : [];
  const bestPerformers = subs.filter((s) => s.performance.isBestPerformer);

  // Pre-compute the viewer's likes for the visible cards.
  const visibleIds = subs.map((s) => s.performance.id);
  const likedSet = new Set<string>();
  if (viewerId && visibleIds.length > 0) {
    const liked = await db
      .select({ performanceId: performanceLikes.performanceId })
      .from(performanceLikes)
      .where(
        and(
          eq(performanceLikes.userId, viewerId),
          inArray(performanceLikes.performanceId, visibleIds),
        ),
      );
    for (const l of liked) likedSet.add(l.performanceId);
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <Card className="overflow-hidden border-border/60 bg-card/80">
        {challenge.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={challenge.coverImageUrl}
            alt=""
            className="h-48 w-full object-cover"
          />
        ) : (
          <div className="h-48 w-full bg-gradient-to-br from-primary/30 via-accent/20 to-primary/10" />
        )}
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={closed ? "secondary" : "success"}>{deadlineLabel}</Badge>
            <Badge variant="outline" className="gap-1">
              <Trophy className="h-3 w-3 text-amber-500" />
              {challenge.points} pts
            </Badge>
            {challenge.instrumentFocus && (
              <Badge variant="outline" className="gap-1">
                <InstrumentIcon
                  instrument={challenge.instrumentFocus}
                  className="h-3 w-3"
                />
                {formatInstrument(challenge.instrumentFocus)}
              </Badge>
            )}
            {challenge.skillLevelTarget && (
              <Badge variant="secondary">
                {formatSkillLevel(challenge.skillLevelTarget)}
              </Badge>
            )}
            <Badge variant="outline">{challenge.status.toLowerCase()}</Badge>
          </div>
          <CardTitle className="text-3xl">{challenge.title}</CardTitle>
          <CardDescription className="flex items-center gap-1.5 text-sm">
            <Calendar className="h-3.5 w-3.5" />
            Due{" "}
            {new Date(challenge.deadline).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            <span className="text-muted-foreground/60">·</span>
            Posted {formatDate(challenge.createdAt)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-foreground/90">
            {challenge.description}
          </div>
        </CardContent>
      </Card>

      {/* Best Performer highlight */}
      {bestPerformers.length > 0 && (
        <section className="space-y-3">
          <header className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            <h2 className="text-xl font-semibold">Best performers</h2>
            <Badge variant="warning">{bestPerformers.length}</Badge>
          </header>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {bestPerformers.map((s) => (
              <PerformanceCard
                key={s.performance.id}
                performance={s.performance}
                student={s.student}
                challenge={{ id: challenge.id, title: challenge.title }}
                likedByMe={likedSet.has(s.performance.id)}
                canLike={!!viewerId}
              />
            ))}
          </div>
        </section>
      )}

      {/* Submission form */}
      {session?.user && !isAdmin && (
        <Card className="border-primary/20 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Your performance
            </CardTitle>
            <CardDescription>
              {closed
                ? "This challenge has closed. New performances are no longer accepted."
                : myOwn.length > 0
                ? "You've already posted — feel free to add another take."
                : "Upload a video, or paste a YouTube / Vimeo link."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {closed ? (
              <p className="text-sm text-muted-foreground">
                Browse what your peers played below.
              </p>
            ) : (
              <PerformanceUploader
                challengeId={challenge.id}
                defaults={{
                  instrument: challenge.instrumentFocus,
                  skillLevel: challenge.skillLevelTarget,
                }}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Gallery + filters */}
      <section className="space-y-3">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Music2 className="h-5 w-5 text-primary" />
            Performances
            <Badge variant="secondary">{subs.length}</Badge>
          </h2>
          {instrumentsPresent.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <FilterChip href={`/challenges/${id}`} active={!filterInstrument}>
                All
              </FilterChip>
              {instrumentsPresent.map((inst) => (
                <FilterChip
                  key={inst}
                  href={`/challenges/${id}?instrument=${inst}`}
                  active={filterInstrument === inst}
                >
                  <InstrumentIcon instrument={inst} className="mr-1 h-3 w-3" />
                  {formatInstrument(inst)}
                </FilterChip>
              ))}
            </div>
          )}
        </header>
        <Separator />
        {subs.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
            {filterInstrument
              ? `No ${formatInstrument(filterInstrument)} performances yet.`
              : "Be the first to perform."}
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {subs.map((s) => (
              <PerformanceCard
                key={s.performance.id}
                performance={s.performance}
                student={s.student}
                challenge={{ id: challenge.id, title: challenge.title }}
                likedByMe={likedSet.has(s.performance.id)}
                canLike={!!viewerId}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      {children}
    </a>
  );
}
