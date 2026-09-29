import { desc, eq } from "drizzle-orm";
import { Activity, CheckCircle2, CircleX, Clock3 } from "lucide-react";
import { db } from "@/db";
import { testCaseResults, testRuns } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TestAgentControls } from "@/components/test-agent-controls";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TestAgentPage() {
  const runs = await db.select().from(testRuns).orderBy(desc(testRuns.createdAt)).limit(20);
  const latest = runs[0];
  const latestCases = latest
    ? await db
        .select()
        .from(testCaseResults)
        .where(eq(testCaseResults.runId, latest.id))
        .orderBy(testCaseResults.title)
    : [];
  const activeRun = runs.some((run) =>
    (["QUEUED", "RUNNING"] as const).includes(
      run.status as "QUEUED" | "RUNNING",
    ),
  );
  const failedRun = runs.find((run) => run.failedCount > 0);
  const fullSuiteConfigured =
    process.env.GITHUB_DISPATCH_ENABLED === "true" &&
    Boolean(process.env.GITHUB_API_TOKEN && process.env.GITHUB_REPO);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Activity className="h-7 w-7 text-primary" /> Test Agent
        </h1>
        <p className="mt-1 text-muted-foreground">
          Run production-safe diagnostics or the complete automated browser
          suite. Failures are stored and converted into role-safe service notices.
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Automated testing</CardTitle></CardHeader>
        <CardContent>
          <TestAgentControls
            activeRun={activeRun}
            failedRunId={failedRun?.id}
            fullSuiteConfigured={fullSuiteConfigured}
          />
        </CardContent>
      </Card>

      {latest && (
        <section className="grid gap-4 sm:grid-cols-3">
          <SummaryCard icon={CheckCircle2} label="Passed" value={latest.passedCount} />
          <SummaryCard icon={CircleX} label="Failed" value={latest.failedCount} />
          <SummaryCard icon={Clock3} label="Latest status" value={latest.status} />
        </section>
      )}

      <Card>
        <CardHeader><CardTitle>Latest case results</CardTitle></CardHeader>
        <CardContent>
          {!latestCases.length ? (
            <p className="text-sm text-muted-foreground">No case results yet.</p>
          ) : (
            <ul className="divide-y">
              {latestCases.map((item) => (
                <li key={item.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.slug} · {item.durationMs ?? 0} ms
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  {item.adminDetail && (
                    <details className="mt-2 rounded-md bg-muted/50 p-2 text-xs">
                      <summary className="cursor-pointer font-medium">Technical details</summary>
                      <pre className="mt-2 whitespace-pre-wrap break-all">{item.adminDetail}</pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Run history</CardTitle></CardHeader>
        <CardContent>
          {!runs.length ? (
            <p className="text-sm text-muted-foreground">No automated runs yet.</p>
          ) : (
            <ul className="divide-y">
              {runs.map((run) => (
                <li key={run.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{run.kind.replace("_", " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(run.createdAt)} · {run.passedCount} passed ·{" "}
                      {run.failedCount} failed
                    </p>
                    {run.errorMessage && (
                      <p className="mt-1 text-xs text-destructive">{run.errorMessage}</p>
                    )}
                  </div>
                  <StatusBadge status={run.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <Icon className="h-6 w-6 text-primary" />
        <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p></div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "PASSED" ? "success" : status === "FAILED" || status === "TIMED_OUT"
      ? "destructive" : "secondary";
  return <Badge variant={variant}>{status.toLowerCase()}</Badge>;
}
