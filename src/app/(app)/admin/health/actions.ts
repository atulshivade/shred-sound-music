"use server";

import { revalidatePath, updateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { testRuns } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/queries";
import {
  dispatchFullTestRun,
  executeSmokeRun,
  getFailedCases,
  getTestBaseUrl,
  hasActiveTestRun,
} from "@/lib/test-agent";

export type TestAgentActionResult =
  | { ok: true; runId: string; message: string }
  | { ok: false; error: string };

async function createRun(
  kind: "SMOKE" | "FULL_E2E" | "RETEST",
  adminId: string,
  parentRunId?: string,
) {
  const [run] = await db
    .insert(testRuns)
    .values({
      kind,
      triggeredById: adminId,
      parentRunId: parentRunId ?? null,
      baseUrl: getTestBaseUrl(),
    })
    .returning();
  if (!run) throw new Error("Could not create test run");
  return run;
}

export async function runSmokeTestsAction(): Promise<TestAgentActionResult> {
  try {
    const session = await requireAdmin();
    if (await hasActiveTestRun()) {
      return { ok: false, error: "Another automated test run is already active" };
    }
    const run = await createRun("SMOKE", session.user.id);
    const summary = await executeSmokeRun(run.id, session.user.id);
    // A run either raises or clears the service notice, so the cached
    // banner lookup must be refreshed before the next page render.
    updateTag(CACHE_TAGS.serviceNotices);
    revalidatePath("/admin/health");
    return {
      ok: true,
      runId: run.id,
      message: `${summary.passed} passed, ${summary.failed} failed`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Smoke test run failed",
    };
  }
}

export async function runAllTestsAction(): Promise<TestAgentActionResult> {
  try {
    const session = await requireAdmin();
    if (await hasActiveTestRun()) {
      return { ok: false, error: "Another automated test run is already active" };
    }
    const run = await createRun("FULL_E2E", session.user.id);
    try {
      await dispatchFullTestRun(run.id);
    } catch (error) {
      await db
        .update(testRuns)
        .set({
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Dispatch failed",
          finishedAt: new Date(),
        })
        .where(eq(testRuns.id, run.id));
      throw error;
    }
    revalidatePath("/admin/health");
    return {
      ok: true,
      runId: run.id,
      message: "Full browser suite queued",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Full test run failed",
    };
  }
}

export async function retestFailedAction(
  parentRunId: string,
): Promise<TestAgentActionResult> {
  try {
    const session = await requireAdmin();
    if (await hasActiveTestRun()) {
      return { ok: false, error: "Another automated test run is already active" };
    }
    const failures = await getFailedCases(parentRunId);
    if (!failures.length) return { ok: false, error: "This run has no failed tests" };
    const run = await createRun("RETEST", session.user.id, parentRunId);
    try {
      await dispatchFullTestRun(run.id, failures);
    } catch (error) {
      await db
        .update(testRuns)
        .set({
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Dispatch failed",
          finishedAt: new Date(),
        })
        .where(eq(testRuns.id, run.id));
      throw error;
    }
    revalidatePath("/admin/health");
    return { ok: true, runId: run.id, message: "Failed tests queued for retest" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Retest failed",
    };
  }
}
