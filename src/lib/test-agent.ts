import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  serviceNotices,
  testCaseResults,
  testRuns,
  type TestCaseResult,
} from "@/db/schema";
import {
  describePlacement,
  getRuntimePlacement,
  suggestedFunctionRegion,
} from "@/lib/runtime-placement";

type ProbeResult = {
  slug: string;
  title: string;
  ok: boolean;
  durationMs: number;
  publicSummary: string;
  adminDetail?: string;
};

const TERMINAL_STATUSES = ["PASSED", "FAILED", "TIMED_OUT"] as const;

/**
 * Latency budgets, in milliseconds. These are deliberately generous: they
 * exist to catch the structural regressions that make the app feel broken
 * (a database on another continent, a cold start replaying migrations),
 * not to police normal variance.
 */
const BUDGETS = {
  /** Median of several `select 1` round trips from the server to the DB. */
  dbRoundTrip: () => Number(process.env.PERF_BUDGET_DB_MS ?? 120),
  /** Time to first byte for a server-rendered page. */
  pageTtfb: () => Number(process.env.PERF_BUDGET_PAGE_MS ?? 2_000),
} as const;

/** Probe slugs whose failure means the app is unusable, not merely slow. */
const CRITICAL_SLUGS = ["smoke.db.ping", "smoke.db.schema", "smoke.api.session"];

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
  // VERCEL_URL is the per-deployment host, which sits behind Vercel's
  // deployment protection and answers every probe with a login page.
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
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

/**
 * Measures the server-to-database round trip. The first call is discarded
 * because it also pays for opening the connection; what we want to know is
 * the steady-state cost of a query, which is the number that gets multiplied
 * by every query on every page.
 */
async function measureDbRoundTrip(): Promise<number[]> {
  const samples: number[] = [];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const started = Date.now();
    await db.execute(sql`select 1`);
    if (attempt > 0) samples.push(Date.now() - started);
  }
  return samples.sort((a, b) => a - b);
}

/**
 * Connectivity and latency are reported as two separate checks on purpose.
 * An unreachable database means the app is down and everyone should be told;
 * a reachable but slow one means the app still works, so only teachers see
 * it. Folding them together would show students an outage banner whenever
 * the database was merely sluggish.
 */
async function probeDatabase(): Promise<ProbeResult[]> {
  const started = Date.now();
  let samples: number[];
  try {
    samples = await measureDbRoundTrip();
  } catch (error) {
    return [
      {
        slug: "smoke.db.ping",
        title: "Database connectivity",
        ok: false,
        durationMs: Date.now() - started,
        publicSummary: "The service is temporarily unavailable",
        adminDetail: redact(error),
      },
    ];
  }

  const median = samples[Math.floor(samples.length / 2)] ?? 0;
  const budget = BUDGETS.dbRoundTrip();
  const placement = getRuntimePlacement();
  const connectivity: ProbeResult = {
    slug: "smoke.db.ping",
    title: "Database connectivity",
    ok: true,
    durationMs: median,
    publicSummary: "Check passed",
    adminDetail: `Median query round trip ${median}ms. ${describePlacement(placement)}`,
  };

  const latency: ProbeResult =
    median > budget
      ? {
          slug: "perf.db.latency",
          title: "Database response time",
          ok: false,
          durationMs: median,
          publicSummary: "The service is responding slowly",
          adminDetail: [
            `Median query round trip ${median}ms exceeds the ${budget}ms budget (samples: ${samples.join(", ")}ms).`,
            describePlacement(placement),
            placement.isCrossRegion
              ? "The server and the database are in different regions, which is the usual cause."
              : "Check whether the database instance is suspended or under-provisioned.",
          ].join(" "),
        }
      : {
          slug: "perf.db.latency",
          title: "Database response time",
          ok: true,
          durationMs: median,
          publicSummary: "Check passed",
          adminDetail: `Median query round trip ${median}ms (budget ${budget}ms).`,
        };

  return [connectivity, latency];
}

/**
 * Verifies the database carries the schema this deploy expects. The cold
 * start bootstrap only logs its failures, so a deploy that adds tables can
 * leave every page that reads them broken with nothing visible to a teacher.
 * When the fingerprint is stale this re-applies the bootstrap, which both
 * repairs the database and surfaces the exact SQL error if it still fails.
 */
async function probeSchema(): Promise<ProbeResult> {
  const started = Date.now();
  const base = { slug: "smoke.db.schema", title: "Database schema is current" };
  try {
    const { ensureSchemaBootstrap, SCHEMA_FINGERPRINT } = await import(
      "@/db/schema-bootstrap"
    );
    const { applied, statements } = await ensureSchemaBootstrap(db);
    return {
      ...base,
      ok: true,
      durationMs: Date.now() - started,
      publicSummary: "Check passed",
      adminDetail: applied
        ? `Schema was out of date; re-applied ${statements} statements (fingerprint ${SCHEMA_FINGERPRINT}).`
        : `Schema fingerprint ${SCHEMA_FINGERPRINT} matches.`,
    };
  } catch (error) {
    return {
      ...base,
      ok: false,
      durationMs: Date.now() - started,
      publicSummary: "The service is temporarily unavailable",
      adminDetail: redact(error),
    };
  }
}

/**
 * Reports where the server runs relative to the database, and fails when
 * they are on different continents. Nothing errors in that configuration —
 * the app is just slow on every request — so without an explicit check it
 * goes unnoticed.
 */
function probeRuntimePlacement(): ProbeResult {
  const placement = getRuntimePlacement();
  if (!placement.isCrossRegion) {
    return {
      slug: "perf.runtime.placement",
      title: "Server and database placement",
      ok: true,
      durationMs: 0,
      publicSummary: "Check passed",
      adminDetail: describePlacement(placement),
    };
  }
  const suggestion = suggestedFunctionRegion(placement);
  return {
    slug: "perf.runtime.placement",
    title: "Server and database placement",
    ok: false,
    durationMs: 0,
    publicSummary: "The service is responding slowly",
    adminDetail: [
      describePlacement(placement),
      "Every database query crosses regions, which adds latency to every request.",
      suggestion
        ? `Set "regions": ["${suggestion}"] in vercel.json and redeploy, or move the database to ${placement.functionCloudRegion}.`
        : "Move the deployment and the database into the same region.",
    ].join(" "),
  };
}

/** Time to first byte for a server-rendered page, against its budget. */
async function probePageLatency(
  baseUrl: string,
  slug: string,
  title: string,
  path: string,
): Promise<ProbeResult> {
  const started = Date.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(
        Number(process.env.TEST_AGENT_SMOKE_TIMEOUT_MS ?? 30_000),
      ),
    });
    const durationMs = Date.now() - started;
    // A redirect is a valid, fast answer — this probe measures latency, not
    // authorisation, which the functional probes already cover.
    if (response.status >= 500) {
      throw new Error(`Expected a successful response, received ${response.status}`);
    }
    const budget = BUDGETS.pageTtfb();
    if (durationMs > budget) {
      return {
        slug,
        title,
        ok: false,
        durationMs,
        publicSummary: "The service is responding slowly",
        adminDetail: `Responded in ${durationMs}ms, over the ${budget}ms budget.`,
      };
    }
    return {
      slug,
      title,
      ok: true,
      durationMs,
      publicSummary: "Check passed",
      adminDetail: `Responded in ${durationMs}ms (budget ${budget}ms).`,
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
  const dbResults = await probeDatabase();
  if (dbResults[0]?.ok) dbResults.push(await probeSchema());

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
    probePageLatency(baseUrl, "perf.page.home", "Home page response time", "/"),
    probePageLatency(baseUrl, "perf.page.feed", "Feed response time", "/feed"),
    probePageLatency(
      baseUrl,
      "perf.page.challenges",
      "Challenges response time",
      "/challenges",
    ),
  ]);
  return [...dbResults, probeRuntimePlacement(), ...httpResults];
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
    const critical = failed.some((item) => CRITICAL_SLUGS.includes(item.slug));
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
