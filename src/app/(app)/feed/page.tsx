import { and, desc, eq, inArray } from "drizzle-orm";
import { Crown, Music2, Sparkles, Filter } from "lucide-react";
import { db } from "@/db";
import {
  performances,
  performanceLikes,
  users,
  challenges,
} from "@/db/schema";
import type { Instrument, SkillLevel } from "@/db/schema";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PerformanceCard } from "@/components/performance-card";
import { InstrumentIcon } from "@/components/instrument-icon";
import {
  formatInstrument,
  formatSkillLevel,
} from "@/lib/utils";
import {
  INSTRUMENT_VALUES,
  SKILL_LEVEL_VALUES,
} from "@/lib/validators";

export const dynamic = "force-dynamic";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ instrument?: string; skill?: string }>;
}) {
  const { instrument: instParam, skill: skillParam } = await searchParams;
  const instrumentFilter =
    instParam && (INSTRUMENT_VALUES as readonly string[]).includes(instParam)
      ? (instParam as Instrument)
      : null;
  const skillFilter =
    skillParam && (SKILL_LEVEL_VALUES as readonly string[]).includes(skillParam)
      ? (skillParam as SkillLevel)
      : null;

  const baseSelect = db
    .select({
      performance: performances,
      student: { id: users.id, name: users.name, image: users.image },
      challenge: { id: challenges.id, title: challenges.title },
    })
    .from(performances)
    .innerJoin(users, eq(performances.studentId, users.id))
    .innerJoin(challenges, eq(performances.challengeId, challenges.id));

  // Pull all PUBLISHED performances; do filtering in JS (small dataset, easy
  // to combine multiple optional filters without conditional `where` builders).
  const all = (
    await baseSelect
      .where(eq(performances.status, "PUBLISHED"))
      .orderBy(desc(performances.submittedAt))
  ).filter(
    (r) =>
      (!instrumentFilter || r.performance.instrument === instrumentFilter) &&
      (!skillFilter || r.performance.skillLevel === skillFilter),
  );

  const bestPerformers = all.filter((r) => r.performance.isBestPerformer);
  const rest = all.filter((r) => !r.performance.isBestPerformer);

  // Pre-compute which performances the viewer has already liked so the
  // <LikeButton> renders in the correct initial state without extra round-trips.
  const session = await auth();
  const viewerId = session?.user?.id;
  const visibleIds = all.map((r) => r.performance.id);
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

  const filterPath = (extra: Record<string, string | null>) => {
    const sp = new URLSearchParams();
    if (instrumentFilter && extra.instrument === undefined)
      sp.set("instrument", instrumentFilter);
    if (skillFilter && extra.skill === undefined) sp.set("skill", skillFilter);
    for (const [k, v] of Object.entries(extra)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    const qs = sp.toString();
    return qs ? `/feed?${qs}` : "/feed";
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <Badge variant="accent" className="w-fit">
          <Sparkles className="mr-1 h-3 w-3" /> Live performances
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">Performance feed</h1>
        <p className="text-muted-foreground">
          Hear what your peers are playing. Filter by instrument or skill level
          to find your tribe.
        </p>
      </header>

      {/* Filters */}
      <section className="space-y-3 rounded-xl border bg-card/60 p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4 text-primary" /> Filter
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Instrument
          </p>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              href={filterPath({ instrument: null })}
              active={!instrumentFilter}
            >
              All
            </FilterChip>
            {INSTRUMENT_VALUES.map((inst) => (
              <FilterChip
                key={inst}
                href={filterPath({ instrument: inst })}
                active={instrumentFilter === inst}
              >
                <InstrumentIcon
                  instrument={inst as Instrument}
                  className="mr-1 h-3 w-3"
                />
                {formatInstrument(inst)}
              </FilterChip>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Skill
          </p>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              href={filterPath({ skill: null })}
              active={!skillFilter}
            >
              All
            </FilterChip>
            {SKILL_LEVEL_VALUES.map((sk) => (
              <FilterChip
                key={sk}
                href={filterPath({ skill: sk })}
                active={skillFilter === sk}
              >
                {formatSkillLevel(sk)}
              </FilterChip>
            ))}
          </div>
        </div>
      </section>

      {/* Best Performer spotlight */}
      {bestPerformers.length > 0 && (
        <section className="space-y-3">
          <header className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            <h2 className="text-xl font-semibold">Best Performer spotlight</h2>
            <Badge variant="warning">{bestPerformers.length}</Badge>
          </header>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {bestPerformers.slice(0, 6).map((r) => (
              <PerformanceCard
                key={r.performance.id}
                performance={r.performance}
                student={r.student}
                challenge={r.challenge}
                likedByMe={likedSet.has(r.performance.id)}
                canLike={!!viewerId}
              />
            ))}
          </div>
        </section>
      )}

      {/* Main feed */}
      <section className="space-y-3">
        <header className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Music2 className="h-5 w-5 text-primary" />
            All performances
            <Badge variant="secondary">{rest.length}</Badge>
          </h2>
        </header>
        <Separator />
        {all.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
            No performances yet — pick a challenge and be the first to perform.
          </p>
        ) : rest.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            All visible performances are featured above.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((r) => (
              <PerformanceCard
                key={r.performance.id}
                performance={r.performance}
                student={r.student}
                challenge={r.challenge}
                likedByMe={likedSet.has(r.performance.id)}
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
