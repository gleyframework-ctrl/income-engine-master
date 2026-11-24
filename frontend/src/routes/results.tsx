import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useCampaign } from "@/context/CampaignContext";
import { apiCall, downloadFile } from "@/lib/api";
import { toast } from "sonner";
import { Spinner } from "@/components/Spinner";
import { CampaignTracker } from "@/components/CampaignTracker";
import { errMsg, listSenders, type Sender } from "@/lib/senders";

export const Route = createFileRoute("/results")({
  ssr: false,
  component: ResultsPage,
});

interface EmailRow {
  email: string;
  subject_a?: string;
  subject_b?: string;
  email_body?: string;
  sequence_number?: string | number;
  [k: string]: unknown;
}

const PAGE_SIZE = 25;

function ResultsPage() {
  const { state, setState } = useCampaign();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [sendersLoading, setSendersLoading] = useState(true);
  const [senderId, setSenderId] = useState("");
  const [sending, setSending] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  useEffect(() => {
    listSenders()
      .then(setSenders)
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setSendersLoading(false));
  }, []);

  useEffect(() => {
    if (!state.jobId) {
      navigate({ to: "/pipeline", replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await apiCall<EmailRow[]>(
          "GET",
          `/api/results/${state.jobId}`,
        );
        if (!cancelled) setState((s) => ({ ...s, emails: rows }));
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.jobId]);

  const emails = (state.emails ?? []) as EmailRow[];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return emails;
    return emails.filter((row) => (row.email ?? "").toLowerCase().includes(q));
  }, [emails, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const subjectOf = (row: EmailRow) => {
    if (row.subject_a && String(row.subject_a).trim() !== "")
      return String(row.subject_a);
    if (row.subject_b && String(row.subject_b).trim() !== "")
      return String(row.subject_b);
    return "(no subject)";
  };

  const previewOf = (row: EmailRow) =>
    ((row.email_body ?? "").replace(/\r?\n/g, " ").slice(0, 90)) || "—";

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const startSend = async () => {
    if (!state.jobId || !senderId) return;
    setSending(true);
    try {
      const r = await apiCall<{ campaign_id?: string | number }>(
        "POST",
        "/api/campaigns/send_day",
        { job_id: state.jobId, sender_id: senderId, day: 1, limit: 50 },
      );
      if (r?.campaign_id == null) throw new Error("No campaign_id returned");
      setCampaignId(String(r.campaign_id));
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell title="Step 4 — Results">
      <div className="space-y-4">
        <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 flex flex-wrap items-end gap-4">
          <label className="block">
            <div className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-1 font-mono">
              Select sender
            </div>
            <select
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              className="min-w-64 px-3 py-2 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-sm"
            >
              <option value="">
                {sendersLoading ? "Loading senders…" : senders.length ? "Choose a sender" : "No senders — add one in Senders"}
              </option>
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label ?? s.from_email ?? s.id}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={startSend}
            disabled={!senderId || !state.jobId || sending}
            className="btn-gold px-6 py-3 text-base inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending && <Spinner />} Send Day 1 Emails (Pilot)
          </button>
        </div>
        {campaignId && state.jobId && (
          <CampaignTracker
            campaignId={campaignId}
            jobId={state.jobId}
            senderId={senderId}
            onClose={() => setCampaignId(null)}
          />
        )}
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-[var(--color-text-secondary)]">
            {loading
              ? "Loading…"
              : `${emails.length} email${emails.length === 1 ? "" : "s"} generated`}
          </div>
          {emails.length > 0 && state.jobId && (
            <button
              className="btn-gold"
              onClick={() =>
                downloadFile(
                  `/api/download/${state.jobId}`,
                  `results_${state.jobId}.csv`,
                )
              }
            >
              ⬇ Download CSV
            </button>
          )}
        </div>
        {error && <div className="text-sm text-[var(--color-error)]">{error}</div>}

        {!loading && emails.length > 0 && (
          <div>
            <input
              type="search"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by email…"
              className="w-full max-w-xs rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
          </div>
        )}

        <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-elevated)] text-left text-xs uppercase tracking-wider text-[var(--color-text-secondary)] font-mono">
              <tr>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2">Preview</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => (
                <tr
                  key={(safePage - 1) * PAGE_SIZE + i}
                  className="border-t border-[var(--color-border-subtle)]"
                >
                  <td className="px-4 py-2 font-mono text-xs">
                    <span className="inline-flex items-center gap-2">
                      {row.email}
                      {row.sequence_number !== undefined &&
                        row.sequence_number !== null &&
                        String(row.sequence_number) !== "" && (
                          <span className="inline-block rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-2 py-0.5 text-[10px] font-mono text-[var(--color-text-secondary)]">
                            Seq {row.sequence_number}
                          </span>
                        )}
                    </span>
                  </td>
                  <td className="px-4 py-2">{subjectOf(row)}</td>
                  <td className="px-4 py-2 text-[var(--color-text-secondary)] truncate max-w-md">
                    {previewOf(row)}
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]"
                  >
                    {emails.length === 0
                      ? "No results yet."
                      : "No emails match your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-xs text-[var(--color-text-secondary)]">
              Page {safePage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                className="btn-gold disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
              >
                ← Previous
              </button>
              <button
                className="btn-gold disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
