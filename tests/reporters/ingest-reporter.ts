import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

type CasePayload = {
  slug: string;
  title: string;
  status: "PASSED" | "FAILED" | "SKIPPED";
  projectName?: string;
  durationMs: number;
  publicSummary: string;
  adminDetail?: string;
};

class TestAgentReporter implements Reporter {
  private cases: CasePayload[] = [];

  private async send(
    status: "RUNNING" | "PASSED" | "FAILED",
    cases: CasePayload[],
  ) {
    const url = process.env.TEST_INGEST_URL;
    const secret = process.env.TEST_RUN_INGEST_SECRET;
    const runId = process.env.TEST_RUN_ID;
    if (!url || !secret || !runId) return;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Test-Ingest-Secret": secret,
      },
      body: JSON.stringify({
        runId,
        status,
        githubRunUrl: process.env.TEST_GITHUB_RUN_URL,
        cases,
      }),
    });
    if (!response.ok) {
      console.error(`Test Agent ingest failed with status ${response.status}`);
    }
  }

  async onBegin() {
    await this.send("RUNNING", []);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const titlePath = test.titlePath();
    const title = titlePath.slice(1).join(" › ");
    const status =
      result.status === "passed"
        ? "PASSED"
        : result.status === "skipped"
          ? "SKIPPED"
          : "FAILED";
    this.cases.push({
      slug: titlePath.join("::").slice(0, 500),
      title: title.slice(0, 500),
      status,
      projectName: test.parent.project()?.name,
      durationMs: result.duration,
      publicSummary: status === "PASSED" ? "Check passed" : "Automated scenario failed",
      adminDetail: result.error?.stack?.slice(0, 4_000),
    });
  }

  async onEnd(result: FullResult) {
    await this.send(result.status === "passed" ? "PASSED" : "FAILED", this.cases);
  }
}

export default TestAgentReporter;
