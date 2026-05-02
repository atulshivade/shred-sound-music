import Link from "next/link";
import { count, eq, desc } from "drizzle-orm";
import {
  PlusCircle,
  ClipboardList,
  Users,
  Crown,
  Inbox,
  ArrowRight,
  Music2,
} from "lucide-react";
import { db } from "@/db";
import { challenges, performances, users } from "@/db/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [
    [{ totalChallenges }],
    [{ activeChallenges }],
    [{ totalPerformances }],
    [{ verifiedPerformances }],
    [{ bestPerformers }],
    [{ totalStudents }],
    recentChallenges,
  ] = await Promise.all([
    db.select({ totalChallenges: count() }).from(challenges),
    db
      .select({ activeChallenges: count() })
      .from(challenges)
      .where(eq(challenges.status, "ACTIVE")),
    db.select({ totalPerformances: count() }).from(performances),
    db
      .select({ verifiedPerformances: count() })
      .from(performances)
      .where(eq(performances.isVerified, true)),
    db
      .select({ bestPerformers: count() })
      .from(performances)
      .where(eq(performances.isBestPerformer, true)),
    db.select({ totalStudents: count() }).from(users).where(eq(users.role, "STUDENT")),
    db.select().from(challenges).orderBy(desc(challenges.createdAt)).limit(5),
  ]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teacher dashboard</h1>
          <p className="text-muted-foreground">
            Post music challenges, watch performances, leave timestamped
            feedback, and crown Best Performers.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/evaluate">
              <Inbox className="h-4 w-4" /> Evaluate
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/challenges/new">
              <PlusCircle className="h-4 w-4" /> New challenge
            </Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Total challenges"
          value={totalChallenges}
          hint={`${activeChallenges} active`}
        />
        <StatCard
          icon={<Music2 className="h-5 w-5" />}
          label="Performances"
          value={totalPerformances}
          hint={`${verifiedPerformances} verified`}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Students"
          value={totalStudents}
          hint="Active musicians"
        />
        <StatCard
          icon={<Crown className="h-5 w-5" />}
          label="Best Performers"
          value={bestPerformers}
          hint="Crowned this season"
        />
      </section>

      <section>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent challenges</CardTitle>
              <CardDescription>The five most recently created challenges.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/challenges">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentChallenges.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No challenges yet — create your first one.
              </p>
            ) : (
              <ul className="divide-y">
                {recentChallenges.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{c.title}</div>
                      <div className="text-xs text-muted-foreground">
                        Created {formatDate(c.createdAt)}
                      </div>
                    </div>
                    <Badge
                      variant={
                        c.status === "ACTIVE"
                          ? "success"
                          : c.status === "DRAFT"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {c.status.toLowerCase()}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="text-2xl font-semibold">{value}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
