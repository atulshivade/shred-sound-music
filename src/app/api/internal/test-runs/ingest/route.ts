import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { serviceNotices, testCaseResults, testRuns } from "@/db/schema";

export const runtime = "nodejs";

const payloadSchema = z.object({
  runId: z.string().uuid(),
  status: z.enum(["RUNNING", "PASSED", "FAILED"]),
  githubRunUrl: z.string().url().optional(),
  cases: z.array(
    z.object({
      slug: z.string().min(1).max(500),
      title: z.string().min(1).max(500),
      status: z.enum(["PASSED", "FAILED", "SKIPPED"]),
      projectName: z.string().max(100).optional(),
      durationMs: z.number().int().nonnegative().optional(),
      publicSummary: z.string().max(500).optional(),
      adminDetail: z.string().max(4_000).optional(),
    }),
  ).max(1_000),
});

function hasValidSecret(request: Request) {
  const expected = process.env.TEST_RUN_INGEST_SECRET;
  const supplied = request.headers.get("x-test-ingest-secret");
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!hasValidSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid test result payload" }, { status: 400 });
  }

  const [run] = await db
    .select()
    .from(testRuns)
    .where(eq(testRuns.id, parsed.data.runId))
    .limit(1);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  if (["PASSED", "FAILED", "TIMED_OUT"].includes(run.status)) {
    return NextResponse.json({ error: "Run is already complete" }, { status: 409 });
  }

  if (parsed.data.cases.length) {
    await db.insert(testCaseResults).values(
      parsed.data.cases.map((item) => ({
        runId: run.id,
        slug: item.slug,
        title: item.title,
        status: item.status,
        projectName: item.projectName ?? null,
        durationMs: item.durationMs ?? null,
        publicSummary: item.publicSummary ?? null,
        adminDetail: item.adminDetail ?? null,
        finishedAt: new Date(),
      })),
    );
  }

  const passedCount = parsed.data.cases.filter((item) => item.status === "PASSED").length;
  const failedCount = parsed.data.cases.filter((item) => item.status === "FAILED").length;
  const skippedCount = parsed.data.cases.filter((item) => item.status === "SKIPPED").length;
  await db
    .update(testRuns)
    .set({
      status: parsed.data.status,
      githubRunUrl: parsed.data.githubRunUrl ?? run.githubRunUrl,
      passedCount,
      failedCount,
      skippedCount,
      startedAt: run.startedAt ?? new Date(),
      finishedAt: parsed.data.status === "RUNNING" ? null : new Date(),
      errorMessage: failedCount ? `${failedCount} browser test(s) failed` : null,
    })
    .where(eq(testRuns.id, run.id));

  if (parsed.data.status === "FAILED") {
    await db.insert(serviceNotices).values({
      runId: run.id,
      createdById: run.triggeredById,
      audience: "ADMIN",
      publicMessage:
        "Automated regression testing detected an issue. Open Test Agent for details.",
      adminDetail: `${failedCount} browser test(s) failed`,
      endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  }
  return NextResponse.json({ ok: true });
}
