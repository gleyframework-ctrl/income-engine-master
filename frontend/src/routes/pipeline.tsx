import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useCampaign } from "@/context/CampaignContext";
import { apiFetch, downloadFile } from "@/lib/api";
import { usePolling } from "@/hooks/usePolling";

export const Route = createFileRoute("/pipeline")({
  ssr: false,
  component: PipelinePage,
});

type StatusValue = "pending" | "running" | "complete" | "failed" | (string & {});

interface StatusPayload {
  status: StatusValue;
  progress?: number;
  current_step?: string;
  error?: string;
  [k: string]: unknown;
}

function unwrap(json: unknown): Record<string, unknown> {
  if (json && typeof json === "object" && "data" in json && json.data !== null && typeof json.data === "object") {
    return json.data as Record<string, unknown>;
  }
  return (json ?? {}) as Record<string, unknown>;
}

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v) return v;
  }
  return null;
}

function pickEmailCount(obj: Record<string, unknown>): number | null {
  for (const k of ["email_count", "emails_generated", "total_emails", "email_total", "count", "total", "generated"]) {
    const v = obj[k];
    if (typeof v === "number") return v;
    if (typeof v === "string" && v && !Number.isNaN(Number(v))) return Number(v);
  }
  for (const k of ["emails", "results", "rows"]) {
    const v = obj[k];
    if (Array.isArray(v)) return v.length;
  }
  return null;
}

function PipelinePage() {
  const { state, setState } = useCampaign();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [finalStatus, setFinalStatus] = useState<StatusPayload | null>(null);

  useEffect(() => {
    if (!state.offerId || state.mergeStatus !== "complete") {
      navigate({ to: "/upload", replace: true });
    }
  }, [state.offerId, state.mergeStatus, navigate]);

  const fetchStatus = useCallback(async (): Promise<StatusPayload> => {
    if (!state.jobId) throw new Error("no job");
    const res = await apiFetch(`/api/status/${state.jobId}`);
    if (!res.ok) throw new Error(`Status check failed (${res.status})`);
    return unwrap(await res.json()) as StatusPayload;
  }, [state.jobId]);

  const shouldContinue = useCallback((d: StatusPayload) => {
    const s = (d.status ?? "").toLowerCase();
    return s === "pending" || s === "running";
  }, []);

  const onComplete = useCallback((d: StatusPayload) => {
    setFinalStatus(d);
  }, []);

  const { data, isPolling, start } = usePolling<StatusPayload>(
    fetchStatus,
    shouldContinue,
    onComplete,
    1200,
  );

  // Resume polling if we already have a job (e.g. page refresh).
  useEffect(() => {
    if (state.jobId && !isPolling && !finalStatus) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.jobId]);

  const startPipeline = async () => {
    if (!state.fileId || !state.offerId) return;
    setStarting(true);
    setError(null);
    setFinalStatus(null);
    try {
      const res = await apiFetch(
        `/api/process/${state.fileId}?offer_id=${encodeURIComponent(state.offerId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const payload = unwrap(await res.json().catch(() => ({})));
      if (!res.ok) {
        throw new Error(
          (typeof payload.error === "string" && payload.error) ||
            (typeof payload.message === "string" && payload.message) ||
            `Failed to start pipeline (${res.status})`,
        );
      }
      const jobId = pickString(payload, "job_id", "jobId", "id");
      if (!jobId) throw new Error("Pipeline started but no job id was returned");
      setState((s) => ({ ...s, jobId }));
      start();
    } catch (err) {
      setError(err instanceof TypeError ? "Network error — server unreachable" : (err as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const status = finalStatus ?? data;
  const statusValue = (status?.status ?? "").toLowerCase();
  const isComplete = statusValue === "complete";
  const isFailed = statusValue === "failed";
  const progress = Math.min(100, Math.max(0, status?.progress ?? 0));
  const step = status?.current_step ?? "Waiting to start…";
  const emailCount = status ? pickEmailCount(status) : null;
  const matched = state.mergeResult?.matched ?? null;

  const failureMessage =
    (status && typeof status.error === "string" && status.error) ||
    (status && typeof status.message === "string" && status.message) ||
    error;

  const download = () => {
    if (state.jobId) {
      downloadFile(
        `/api/download/${state.jobId}`,
        `results_${state.jobId}.csv`,
      ).catch((err) => setError((err as Error).message));
    }
  };

  return (
    <AppShell title="Step 3 — Run pipeline">
      <div className="max-w-2xl space-y-6">
        {!state.jobId ? (
          <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-6">
            <div className="font-display font-semibold">Ready to process</div>
            <div className="text-sm text-[var(--color-text-secondary)] mt-1">
              Merge is complete ({matched !== null ? matched : "—"} matched
              rows). Kick off the enrichment pipeline.
            </div>
            <button
              onClick={startPipeline}
              disabled={starting || !state.fileId || !state.offerId}
              className="btn-gold mt-4"
            >
              {starting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Starting…
                </span>
              ) : (
                "Start pipeline"
              )}
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-6">
            <div className="flex items-center justify-between">
              <div className="font-display font-semibold">
                Job {state.jobId.slice(0, 8)}
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-text-secondary)]">
                {isPolling && <span className="dot-cyan" />}
                {statusValue || "pending"}
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
              <div
                className="h-full bg-[var(--color-gold)] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 font-mono text-xs text-[var(--color-text-secondary)]">
              {progress}% · {step}
            </div>
          </div>
        )}

        {state.jobId && (
          <PipelineStepper
            status={status}
            progress={progress}
            complete={isComplete}
          />
        )}

        {isComplete && (
          <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-8 text-center space-y-4">
            <div className="text-4xl">🎉</div>
            <div className="font-display text-2xl font-semibold text-green-400">
              Pipeline complete
            </div>
            <div className="text-sm text-[var(--color-text-primary)]">
              {emailCount !== null
                ? `${emailCount} email${emailCount === 1 ? "" : "s"} generated`
                : "Your emails are ready to download."}
            </div>
            <button
              onClick={download}
              className="rounded-md bg-green-600 px-6 py-3 text-base font-semibold text-green-50 hover:bg-green-500 transition-colors"
            >
              ⬇ Download CSV
            </button>
          </div>
        )}

        {isFailed && (
          <div className="rounded-lg border border-[var(--color-error)]/50 bg-[var(--color-error)]/10 p-4 text-sm text-[var(--color-error)]">
            Pipeline failed{failureMessage ? `: ${failureMessage}` : "."}
          </div>
        )}

        {!isFailed && error && (
          <div className="text-sm text-[var(--color-error)]">{error}</div>
        )}
      </div>
    </AppShell>
  );
}

const AGENT_STEPS = [
  { label: "Keywords", match: "keyword" },
  { label: "Avatar", match: "avatar" },
  { label: "Filtering", match: "filter" },
  { label: "Icebreaker", match: "icebreaker" },
  { label: "Copywriter", match: "copywriter" },
];

function currentStepIndex(status: StatusPayload | null, progress: number) {
  const steps = status?.steps as
    | { state?: string; name?: string }[]
    | undefined;
  if (Array.isArray(steps) && steps.length > 0) {
    const active = steps.findIndex((s) => s?.state === "active");
    if (active >= 0) return active;
    const done = steps.filter((s) => s?.state === "complete").length;
    if (done > 0) return Math.min(done, steps.length - 1);
  }
  const name = String(status?.current_step ?? "").toLowerCase();
  const byName = AGENT_STEPS.findIndex((s) => name.includes(s.match));
  if (byName >= 0) return byName;
  return Math.min(
    AGENT_STEPS.length - 1,
    Math.floor(progress / (100 / AGENT_STEPS.length)),
  );
}

function PipelineStepper({
  status,
  progress,
  complete,
}: {
  status: StatusPayload | null;
  progress: number;
  complete: boolean;
}) {
  const current = currentStepIndex(status, progress);

  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {AGENT_STEPS.map((step, i) => {
        const kind =
          complete || i < current
            ? "complete"
            : i === current
              ? "active"
              : "pending";
        return (
          <li
            key={step.label}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-xs ${
              kind === "complete"
                ? "border-[var(--color-success)]/40 bg-[var(--color-success)]/10 text-[var(--color-success)]"
                : kind === "active"
                  ? "border-[var(--color-cyan)]/50 bg-[var(--color-cyan)]/10 text-[var(--color-cyan)]"
                  : "border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]"
            }`}
          >
            {kind === "complete" ? (
              <span aria-hidden>✓</span>
            ) : kind === "active" ? (
              <span className="dot-cyan" />
            ) : (
              <span className="dot-gray" />
            )}
            <span>
              {i + 1}. {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
