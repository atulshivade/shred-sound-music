import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  serviceNotices,
  testCaseResults,
  testRuns,
  type TestCaseResult,
} from "@/db/schema";

type ProbeResult = {
  slug: string;
  title: string;
  ok: boolean;
  durationMs: number;
  publicSummary: string;
  adminDetail?: string;
};

const TERMINAL_STATUSES = ["PASSED", "FAILED", "TIMED_OUT"] as const;

function redact(value: unknown): string {
  let text = value instanceof Error ? value.stack ?? value.message : String(value);
  for (const secret of [
    process.env.AUTH_SECRET,
    process.env.DATABASE_URL,
    process.env.GITHUB_API_TOKEN,
    process.env.TEST_RUN_INGEST_SECRET,
  ]) {
    if (secret) text = text.replaceAll(secret, "[REDACTED]");
  }
  return text.slice(0, 4_000);
}

export function getTestBaseUrl(): string {
  const configured = process.env.TEST_BASE_URL || process.env.AUTH_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function httpProbe(
  baseUrl: string,
  slug: string,
  title: string,
  path: string,
  validate: (response: Response) => Promise<void> | void,
): Promise<ProbeResult> {
  const started = Date.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(
        Number(process.env.TEST_AGENT_SMOKE_TIMEOUT_MS ?? 30_000),
      ),
    });
    await validate(response);
    return {
      slug,
      title,
      ok: true,
      durationMs: Date.now() - started,
      publicSummary: "Check passed",
    };
  } catch (error) {
    return {
      slug,
      title,
      ok: false,
      durationMs: Date.now() - started,
      publicSummary: "A service check failed",
      adminDetail: redact(error),
    };
  }
}

async function runSmokeProbes(baseUrl: string): Promise<ProbeResult[]> {
  const dbStarted = Date.now();
  let dbResult: ProbeResult;
  try {
    await db.execute(sql`select 1`);
    dbResult = {
      slug: "smoke.db.ping",
      title: "Database connectivity",
      ok: true,
      durationMs: Date.now() - dbStarted,
      publicSummary: "Check passed",
    };
  } catch (error) {
    dbResult = {
      slug: "smoke.db.ping",
      title: "Database connectivity",
      ok: false,
      durationMs: Date.now() - dbStarted,
      publicSummary: "The service is temporarily unavailable",
      adminDetail: redact(error),
    };
  }

  const httpResults = await Promise.all([
    httpProbe(baseUrl, "smoke.page.home", "Public home page", "/", (r) => {
      if (!r.ok) throw new Error(`Expected 2xx, received ${r.status}`);
    }),
    httpProbe(
      baseUrl,
      "smoke.api.session",
      "Authentication session API",
      "/api/auth/session",
      async (r) => {
        if (!r.ok) throw new Error(`Expected 2xx, received ${r.status}`);
        const body = await r.json();
        // Auth.js returns JSON null for an anonymous session and an object
        // for an authenticated session; both are healthy responses.
        if (body !== null && typeof body !== "object") {
          throw new Error("Invalid JSON response");
        }
      },
    ),
    httpProbe(
      baseUrl,
      "smoke.api.upload-capabilities",
      "Video upload capability API",
      "/api/upload/capabilities",
      async (r) => {
        if (!r.ok) throw new Error(`Expected 2xx, received ${r.status}`);
        const body = (await r.json()) as { uploadsEnabled?: unknown };
        if (typeof body.uploadsEnabled !== "boolean") {
          throw new Error("uploadsEnabled is missing or invalid");
        }
      },
    ),
    httpProbe(
      baseUrl,
      "smoke.api.dbinit-guard",
      "Database bootstrap access guard",
      "/api/admin/dbinit",
      (r) => {
        if (r.status !== 401) throw new Error(`Expected 401, received ${r.status}`);
      },
    ),
  ]);
  return [dbResult, ...httpResults];
}

export async function executeSmokeRun(runId: string, adminId: string) {
  const [run] = await db
    .update(testRuns)
    .set({ status: "RUNNING", startedAt: new Date() })
    .where(eq(testRuns.id, runId))
    .returning();
  if (!run) throw new Error("Test run not found");

  const results = await runSmokeProbes(run.baseUrl);
  await db.insert(testCaseResults).values(
    results.map((result) => ({
      runId,
      slug: result.slug,
      title: result.title,
      status: result.ok ? ("PASSED" as const) : ("FAILED" as const),
      durationMs: result.durationMs,
      publicSummary: result.publicSummary,
      adminDetail: result.adminDetail ?? null,
      finishedAt: new Date(),
    })),
  );

  const failed = results.filter((result) => !result.ok);
  await db
    .update(testRuns)
    .set({
      status: failed.length ? "FAILED" : "PASSED",
      passedCount: results.length - failed.length,
      failedCount: failed.length,
      finishedAt: new Date(),
      errorMessage: failed.length ? `${failed.length} diagnostic check(s) failed` : null,
    })
    .where(eq(testRuns.id, runId));

  if (failed.length) {
    const critical = failed.some((item) =>
      ["smoke.db.ping", "smoke.api.session"].includes(item.slug),
    );
    await db.insert(serviceNotices).values({
      runId,
      createdById: adminId,
      audience: critical ? "ALL" : "ADMIN",
      publicMessage: critical
        ? "We are experiencing technical difficulties. Some features may be temporarily unavailable."
        : "Automated checks detected an issue. Teachers can view details in Test Agent.",
      adminDetail: failed.map((item) => `${item.title}: ${item.adminDetail}`).join("\n"),
      endsAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
    });
  } else {
    await db
      .update(serviceNotices)
      .set({ isActive: false })
      .where(and(eq(serviceNotices.isActive, true), isNotNull(serviceNotices.runId)));
  }
  return { passed: results.length - failed.length, failed: failed.length };
}

export async function dispatchFullTestRun(
  runId: string,
  failedCases: TestCaseResult[] = [],
) {
  if (
    process.env.GITHUB_DISPATCH_ENABLED !== "true" ||
    !process.env.GITHUB_API_TOKEN ||
    !process.env.GITHUB_REPO
  ) {
    throw new Error("Full test automation is not configured");
  }
  const workflow = process.env.GITHUB_WORKFLOW_FILE ?? "playwright-dispatch.yml";
  const response = await fetch(
    `https://api.github.com/repos/${process.env.GITHUB_REPO}/actions/workflows/${workflow}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${process.env.GITHUB_API_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: process.env.GITHUB_REF ?? "main",
        inputs: {
          run_id: runId,
          base_url: getTestBaseUrl(),
          ingest_url: `${getTestBaseUrl()}/api/internal/test-runs/ingest`,
          grep: failedCases
            .map((item) => item.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("|"),
        },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`GitHub workflow dispatch failed with ${response.status}`);
  }
}

export async function getFailedCases(runId: string) {
  return db
    .select()
    .from(testCaseResults)
    .where(
      and(
        eq(testCaseResults.runId, runId),
        eq(testCaseResults.status, "FAILED"),
      ),
    );
}

export async function hasActiveTestRun() {
  const [active] = await db
    .select({ id: testRuns.id })
    .from(testRuns)
    .where(inArray(testRuns.status, ["QUEUED", "RUNNING"]))
    .limit(1);
  return Boolean(active);
}

export async function getRecentTestRuns() {
  return db.select().from(testRuns).orderBy(desc(testRuns.createdAt)).limit(20);
}

export { TERMINAL_STATUSES };
