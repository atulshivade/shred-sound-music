import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect, signIn, TEACHER } from "./fixtures";
import {
  SCHEMA_FINGERPRINT,
  SCHEMA_STATEMENTS,
  ensureSchemaBootstrap,
} from "../../src/db/schema-bootstrap";
import {
  describePlacement,
  getRuntimePlacement,
  suggestedFunctionRegion,
} from "../../src/lib/runtime-placement";

/**
 * Performance regressions in this app are structural rather than
 * algorithmic: the server ends up far from the database, or a cold start
 * replays work it should have skipped. Both are invisible to the functional
 * suite — nothing errors, the app is just slow — so they get their own
 * checks here.
 */

/**
 * The cold-start fast path depends on the fingerprint changing whenever the
 * schema does. If it ever stopped tracking the statements, a deploy that
 * adds a column would silently skip the migration it needs.
 */
test.describe("Schema bootstrap cold-start fast path", () => {
  test("fingerprint covers the statement list and its contents", () => {
    expect(SCHEMA_FINGERPRINT).toMatch(/^\d+-[0-9a-f]{8}$/);
    expect(SCHEMA_FINGERPRINT.startsWith(`${SCHEMA_STATEMENTS.length}-`)).toBe(
      true,
    );
  });

  test("the statement list provisions the fingerprint bookkeeping table", () => {
    const bookkeeping = SCHEMA_STATEMENTS.find((statement) =>
      statement.includes(`CREATE TABLE IF NOT EXISTS "schema_state"`),
    );
    expect(
      bookkeeping,
      "without schema_state the fast path can never record a fingerprint",
    ).toBeTruthy();
  });

  test("a matching stored fingerprint skips every DDL statement", async () => {
    const executed: string[] = [];
    const result = await ensureSchemaBootstrap({
      execute: async (query: unknown) => {
        executed.push(String(query));
        return [{ value: SCHEMA_FINGERPRINT }];
      },
    });
    expect(result).toEqual({ applied: false, statements: 0 });
    expect(
      executed.length,
      "a warm database should cost exactly one round trip",
    ).toBe(1);
  });

  test("a stale stored fingerprint re-applies the full statement list", async () => {
    let calls = 0;
    const result = await ensureSchemaBootstrap({
      execute: async () => {
        calls += 1;
        return [{ value: "0-deadbeef" }];
      },
    });
    expect(result.applied).toBe(true);
    expect(result.statements).toBe(SCHEMA_STATEMENTS.length);
    // One lookup, every statement, then the fingerprint write.
    expect(calls).toBe(SCHEMA_STATEMENTS.length + 2);
  });

  test("a missing bookkeeping table is treated as 'not applied yet'", async () => {
    let lookups = 0;
    const result = await ensureSchemaBootstrap({
      execute: async () => {
        lookups += 1;
        if (lookups === 1) throw new Error('relation "schema_state" does not exist');
        return [];
      },
    });
    expect(result.applied).toBe(true);
    expect(result.statements).toBe(SCHEMA_STATEMENTS.length);
  });
});

/**
 * A function running in a different region from its database adds a network
 * hop to every query. Nothing fails, so only an explicit check catches it.
 */
test.describe("Runtime placement detection", () => {
  test("same-region deployments are not flagged", () => {
    const placement = getRuntimePlacement({
      VERCEL_REGION: "fra1",
      DATABASE_URL:
        "postgresql://u:p@ep-demo-pooler.eu-central-1.aws.neon.tech/db",
    });
    expect(placement.functionCloudRegion).toBe("eu-central-1");
    expect(placement.databaseCloudRegion).toBe("eu-central-1");
    expect(placement.isCrossRegion).toBe(false);
  });

  test("cross-region deployments are flagged with an actionable region", () => {
    const placement = getRuntimePlacement({
      VERCEL_REGION: "iad1",
      DATABASE_URL:
        "postgresql://u:p@ep-demo-pooler.eu-central-1.aws.neon.tech/db",
    });
    expect(placement.isCrossRegion).toBe(true);
    expect(suggestedFunctionRegion(placement)).toBe("fra1");
    expect(describePlacement(placement)).toContain("eu-central-1");
  });

  test("a Supabase pooler hostname is recognised too", () => {
    const placement = getRuntimePlacement({
      VERCEL_REGION: "iad1",
      DATABASE_URL:
        "postgresql://u:p@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
    });
    expect(placement.databaseCloudRegion).toBe("eu-central-1");
    expect(placement.isCrossRegion).toBe(true);
  });

  test("an unrecognised database host never reports a false mismatch", () => {
    const placement = getRuntimePlacement({
      VERCEL_REGION: "iad1",
      DATABASE_URL: "postgresql://u:p@db.internal:5432/postgres",
    });
    expect(placement.databaseCloudRegion).toBeUndefined();
    expect(placement.isCrossRegion).toBe(false);
  });

  test("a local deployment with no platform region is not flagged", () => {
    const placement = getRuntimePlacement({});
    expect(placement.isCrossRegion).toBe(false);
    expect(describePlacement(placement)).toContain("unknown");
  });
});

/**
 * End-to-end latency budgets. Deliberately loose — they exist to catch a
 * page that has become structurally slow, not to measure milliseconds on a
 * developer laptop or a cold dev-server compile.
 */
test.describe("Page response budgets", () => {
  /** Warm the route first so we measure serving, not first compilation. */
  async function measureWarm(
    request: { get: (url: string) => Promise<{ status(): number }> },
    path: string,
  ) {
    await request.get(path);
    const started = Date.now();
    const response = await request.get(path);
    return { durationMs: Date.now() - started, status: response.status() };
  }

  test("the landing page responds within budget", async ({ request }) => {
    const { durationMs, status } = await measureWarm(request, "/");
    expect(status).toBe(200);
    expect(durationMs).toBeLessThan(3_000);
  });

  test("the session endpoint responds within budget", async ({ request }) => {
    const { durationMs, status } = await measureWarm(
      request,
      "/api/auth/session",
    );
    expect(status).toBe(200);
    expect(durationMs).toBeLessThan(2_000);
  });

  test("authenticated pages respond within budget", async ({ page }) => {
    await signIn(page, TEACHER);
    // Measure the server response rather than a full browser load: in dev the
    // latter is dominated by the unminified bundle and React's development
    // hydration, neither of which says anything about server-side latency.
    // The context's request handle reuses the signed-in cookie jar.
    const api = page.context().request;
    for (const path of ["/challenges", "/feed", "/admin"]) {
      const { durationMs, status } = await measureWarm(api, path);
      expect(status).toBe(200);
      expect(durationMs, `${path} took too long to render`).toBeLessThan(5_000);
    }
  });
});

/**
 * The feed and challenge lists are served from a shared cache, so the pages
 * are only as correct as the invalidation behind them. A mutation that
 * forgets to purge its tag leaves teachers and students looking at stale
 * rows — a correctness bug, not a cosmetic delay — and it would not show up
 * as a failure anywhere else in the suite.
 */
test.describe("Cached read models are invalidated by their writers", () => {
  const sourceFor = (relativePath: string) =>
    readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

  test("every performance mutation purges the performances tag", () => {
    const source = sourceFor("src/lib/actions.ts");
    // Each exported action that writes to `performance` must purge the tag.
    const writers = [
      "togglePerformanceLikeAction",
      "createPerformanceAction",
      "togglePerformanceFlagAction",
      "setPerformanceStatusAction",
      "toggleReactionAction",
    ];
    for (const writer of writers) {
      const body = source.slice(source.indexOf(`export async function ${writer}`));
      const end = body.indexOf("\nexport async function ");
      const scoped = end === -1 ? body : body.slice(0, end);
      expect(
        scoped,
        `${writer} writes performances but never purges the cache tag`,
      ).toContain("updateTag(CACHE_TAGS.performances)");
    }
    // Server actions must read their own writes: `revalidateTag(…, "max")`
    // is stale-while-revalidate and would show the old rows on reload.
    expect(source).not.toContain("revalidateTag(");
  });

  test("creating a challenge purges the challenges tag", () => {
    expect(
      sourceFor("src/app/(app)/admin/challenges/new/actions.ts"),
    ).toContain("updateTag(CACHE_TAGS.challenges)");
  });

  test("test runs purge the service-notice tag when they raise a notice", () => {
    expect(sourceFor("src/app/(app)/admin/health/actions.ts")).toContain(
      "updateTag(CACHE_TAGS.serviceNotices)",
    );
    expect(
      sourceFor("src/app/api/internal/test-runs/ingest/route.ts"),
    ).toContain("revalidateTag(CACHE_TAGS.serviceNotices");
  });
});
