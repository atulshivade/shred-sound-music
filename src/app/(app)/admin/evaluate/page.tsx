import { and, desc, eq, inArray } from "drizzle-orm";
import { Inbox, MessageSquare, Clock } from "lucide-react";
import { db } from "@/db";
import {
  performances,
  performanceLikes,
  users,
  challenges,
  feedback as feedbackTable,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PerformanceCard } from "@/components/performance-card";
import { EvaluateRow } from "@/components/evaluate-row";
import { formatDate, formatSeconds } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EvaluatePage() {
  const session = await requireAdmin();

  const all = await db
    .select({
      performance: performances,
      student: { id: users.id, name: users.name, image: users.image },
      challenge: { id: challenges.id, title: challenges.title },
    })
    .from(performances)
    .innerJoin(users, eq(performances.studentId, users.id))
    .innerJoin(challenges, eq(performances.challengeId, challenges.id))
    .orderBy(desc(performances.submittedAt));

  // Batch fetch feedback for all visible performances.
  const ids = all.map((r) => r.performance.id);
  const feedbackRows =
    ids.length === 0
      ? []
      : await db
          .select({
            feedback: feedbackTable,
            teacher: { name: users.name },
          })
          .from(feedbackTable)
          .innerJoin(users, eq(feedbackTable.teacherId, users.id))
          .where(inArray(feedbackTable.performanceId, ids))
          .orderBy(desc(feedbackTable.createdAt));

  const feedbackByPerformance = new Map<string, typeof feedbackRows>();
  for (const f of feedbackRows) {
    const list = feedbackByPerformance.get(f.feedback.performanceId) ?? [];
    list.push(f);
    feedbackByPerformance.set(f.feedback.performanceId, list);
  }

  // Teachers can also like performances — pre-compute their like set.
  const likedSet = new Set<string>();
  if (ids.length > 0) {
    const liked = await db
      .select({ performanceId: performanceLikes.performanceId })
      .from(performanceLikes)
      .where(
        and(
          eq(performanceLikes.userId, session.user.id),
          inArray(performanceLikes.performanceId, ids),
        ),
      );
    for (const l of liked) likedSet.add(l.performanceId);
  }

  const byStatus = {
    pending: all.filter((r) => r.performance.status === "PENDING"),
    published: all.filter((r) => r.performance.status === "PUBLISHED"),
    rejected: all.filter((r) => r.performance.status === "REJECTED"),
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Evaluation studio</h1>
        <p className="text-muted-foreground">
          Watch performances, leave timestamped feedback, score on rhythm /
          technique / musicality, mark Verified, and crown the Best Performer.
        </p>
      </header>

      <Tabs defaultValue="published">
        <TabsList>
          <TabsTrigger value="pending">
            Pending <Badge variant="secondary" className="ml-2">{byStatus.pending.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="published">
            Published <Badge variant="success" className="ml-2">{byStatus.published.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected <Badge variant="destructive" className="ml-2">{byStatus.rejected.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {(["pending", "published", "rejected"] as const).map((key) => (
          <TabsContent key={key} value={key}>
            {byStatus[key].length === 0 ? (
              <EmptyQueue label={key} />
            ) : (
              <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                {byStatus[key].map((r) => {
                  const list = feedbackByPerformance.get(r.performance.id) ?? [];
                  return (
                    <EvaluateRow
                      key={r.performance.id}
                      performance={r.performance}
                      cardSlot={
                        <PerformanceCard
                          performance={r.performance}
                          student={r.student}
                          challenge={r.challenge}
                          likedByMe={likedSet.has(r.performance.id)}
                          canLike
                        />
                      }
                      feedbackSlot={
                        list.length === 0 ? null : (
                          <ul className="space-y-2 px-4 py-3 text-xs">
                            {list.map((n) => (
                              <li
                                key={n.feedback.id}
                                className="flex gap-2 rounded-md bg-muted/40 px-2 py-1.5"
                              >
                                <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                                <div className="min-w-0 flex-1">
                                  <p className="whitespace-pre-wrap break-words">
                                    {n.feedback.note}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-muted-foreground">
                                    {n.feedback.timestampSec != null && (
                                      <Badge variant="outline" className="gap-1 text-[10px]">
                                        <Clock className="h-2.5 w-2.5" />
                                        {formatSeconds(n.feedback.timestampSec)}
                                      </Badge>
                                    )}
                                    {n.feedback.rhythmScore != null && (
                                      <Badge variant="secondary" className="text-[10px]">
                                        Rhythm {n.feedback.rhythmScore}/10
                                      </Badge>
                                    )}
                                    {n.feedback.techniqueScore != null && (
                                      <Badge variant="secondary" className="text-[10px]">
                                        Technique {n.feedback.techniqueScore}/10
                                      </Badge>
                                    )}
                                    {n.feedback.musicalityScore != null && (
                                      <Badge variant="secondary" className="text-[10px]">
                                        Musicality {n.feedback.musicalityScore}/10
                                      </Badge>
                                    )}
                                    <span className="ml-auto">
                                      — {n.teacher.name ?? "Teacher"} ·{" "}
                                      {formatDate(n.feedback.createdAt)}
                                    </span>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )
                      }
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function EmptyQueue({ label }: { label: string }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Inbox className="h-6 w-6" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">No {label} performances.</p>
    </div>
  );
}
