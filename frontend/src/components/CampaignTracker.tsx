import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { errMsg } from "@/lib/senders";
import { Spinner } from "./Spinner";

interface Status {
  sent?: number;
  failed?: number;
  remaining?: number;
  current_step?: string;
  status?: string;
}

export function CampaignTracker({
  campaignId,
  jobId,
  senderId,
  onClose,
}: {
  campaignId: string;
  jobId: string;
  senderId: string;
  onClose: () => void;
}) {
  const [st, setSt] = useState<Status | null>(null);
  const [pollErr, setPollErr] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await apiCall<Status>("GET", `/api/campaigns/${campaignId}/status`);
        if (!alive) return;
        setSt(r);
        setPollErr(null);
      } catch (e) {
        if (alive) setPollErr(errMsg(e));
      }
      if (alive) t = setTimeout(tick, 3000);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [campaignId]);

  const sent = Number(st?.sent ?? 0);
  const failed = Number(st?.failed ?? 0);
  const remaining = Number(st?.remaining ?? 0);
  const total = sent + failed + remaining;
  const pct = total > 0 ? Math.round((sent / total) * 100) : 0;

  const scheduleDay2 = async () => {
    setScheduling(true);
    try {
      const r = await apiCall<{ campaign_id?: string }>("POST", "/api/campaigns/send_day", {
        job_id: jobId,
        sender_id: senderId,
        day: 2,
        limit: 50,
      });
      toast.success(`Day 2 scheduled${r?.campaign_id ? ` (${r.campaign_id})` : ""}`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-[var(--color-success)]">Campaign Started!</h2>
            <div className="mt-1 font-mono text-xs text-[var(--color-text-secondary)]">
              campaign_id: <span className="text-[var(--color-text-primary)]">{campaignId}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]" aria-label="Close">✕</button>
        </div>

        <div>
          <div className="flex justify-between text-xs font-mono text-[var(--color-text-secondary)] mb-1">
            <span className="inline-flex items-center gap-2">
              <span className="dot-cyan" /> {st?.current_step ?? "Connecting…"}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
            <div className="h-full bg-[var(--color-success)] transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Sent" value={sent} color="var(--color-success)" />
          <Stat label="Failed" value={failed} color="var(--color-error)" />
          <Stat label="Remaining" value={remaining} color="var(--color-cyan)" />
        </div>

        {pollErr && <div className="text-xs text-[var(--color-error)]">{pollErr}</div>}

        <button onClick={scheduleDay2} disabled={scheduling} className="btn-gold w-full inline-flex items-center justify-center gap-2">
          {scheduling && <Spinner />} Schedule Day 2
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-[var(--color-bg-elevated)] p-3 text-center">
      <div className="font-display text-3xl font-semibold" style={{ color }}>{value}</div>
      <div className="text-xs uppercase tracking-wider font-mono text-[var(--color-text-secondary)]">{label}</div>
    </div>
  );
}
