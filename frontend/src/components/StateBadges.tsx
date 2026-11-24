import { useCampaign } from "@/context/CampaignContext";

function Badge({ label, value }: { label: string; value: string | null }) {
  const active = value !== null;
  return (
    <div
      className={`font-mono text-[11px] px-2 py-1 rounded border ${
        active
          ? "border-[var(--color-gold)] text-[var(--color-gold)]"
          : "border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
      }`}
    >
      <span className="opacity-70">{label}:</span>{" "}
      <span>{value ? value.slice(0, 8) : "—"}</span>
    </div>
  );
}

export function StateBadges() {
  const { state } = useCampaign();
  return (
    <div className="flex items-center gap-2">
      <Badge label="offer" value={state.offerId} />
      <Badge label="file" value={state.fileId ?? state.extractedFileId} />
      <Badge label="job" value={state.jobId} />
    </div>
  );
}
