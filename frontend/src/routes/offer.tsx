import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useCampaign } from "@/context/CampaignContext";
import { apiCall } from "@/lib/api";

export const Route = createFileRoute("/offer")({
  ssr: false,
  component: OfferPage,
});

interface OfferResult {
  id: string;
}

function OfferPage() {
  const { state, setState } = useCampaign();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", url: "", payout: "", niche: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiCall<OfferResult>("POST", "/api/offers", {
        name: form.name,
        url: form.url,
        payout: Number(form.payout),
        niche: form.niche,
      });
      setState((s) => ({ ...s, offerId: result.id }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const clearOffer = () => {
    setState((s) => ({
      ...s,
      offerId: null,
      extractedFileId: null,
      validatedFileId: null,
      mergeStatus: "idle",
      mergeResult: null,
      jobId: null,
      emails: null,
    }));
    setForm({ name: "", url: "", payout: "", niche: "" });
  };

  return (
    <AppShell title="Step 1 — Define your offer">
      <div className="max-w-xl">
        {state.offerId ? (
          <div className="rounded-lg border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/5 p-6">
            <div className="text-sm text-[var(--color-text-secondary)]">
              Offer created
            </div>
            <div className="font-mono text-[var(--color-gold)] mt-1">
              {state.offerId}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                className="btn-gold"
                onClick={() => navigate({ to: "/upload" })}
              >
                Continue to Upload →
              </button>
              <button className="btn-outline" onClick={clearOffer}>
                Create new offer
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Offer name">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Offer URL">
              <input
                required
                type="url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Payout ($)">
              <input
                required
                type="number"
                step="0.01"
                value={form.payout}
                onChange={(e) => setForm({ ...form, payout: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Niche">
              <input
                required
                value={form.niche}
                onChange={(e) => setForm({ ...form, niche: e.target.value })}
                className={inputCls}
              />
            </Field>
            {error && (
              <div className="text-sm text-[var(--color-error)]">{error}</div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="btn-gold"
            >
              {submitting ? "Creating…" : "Create offer"}
            </button>
          </form>
        )}
      </div>
    </AppShell>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-sm focus:outline-none focus:border-[var(--color-cyan)]";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-1 font-mono">
        {label}
      </div>
      {children}
    </label>
  );
}
