"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  retestFailedAction,
  runAllTestsAction,
  runSmokeTestsAction,
} from "@/app/(app)/admin/health/actions";

export function TestAgentControls({
  activeRun,
  failedRunId,
  fullSuiteConfigured,
}: {
  activeRun: boolean;
  failedRunId?: string;
  fullSuiteConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const busy = pending || activeRun;

  useEffect(() => {
    if (!activeRun) return;
    const timer = window.setInterval(() => router.refresh(), 3_000);
    return () => window.clearInterval(timer);
  }, [activeRun, router]);

  const invoke = (
    action: () => Promise<{ ok: boolean; message?: string; error?: string }>,
  ) => {
    setMessage(undefined);
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? result.message : result.error);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => invoke(runSmokeTestsAction)}>
          <FlaskConical className="h-4 w-4" />
          Run safety checks
        </Button>
        <Button
          variant="outline"
          disabled={busy || !fullSuiteConfigured}
          onClick={() => invoke(runAllTestsAction)}
          title={
            fullSuiteConfigured
              ? "Run every Playwright test in CI"
              : "Configure GitHub test-agent environment variables first"
          }
        >
          <Play className="h-4 w-4" />
          Run all test cases
        </Button>
        {failedRunId && (
          <Button
            variant="secondary"
            disabled={busy || !fullSuiteConfigured}
            onClick={() => invoke(() => retestFailedAction(failedRunId))}
          >
            <RefreshCw className="h-4 w-4" />
            Retest failures
          </Button>
        )}
      </div>
      {activeRun && (
        <p className="text-sm text-muted-foreground">
          A test run is active. Results refresh automatically.
        </p>
      )}
      {message && <p className="text-sm" role="status">{message}</p>}
      {!fullSuiteConfigured && (
        <p className="text-xs text-muted-foreground">
          Full browser automation is disabled until GitHub dispatch is configured.
          Production-safe diagnostics are available now.
        </p>
      )}
    </div>
  );
}
