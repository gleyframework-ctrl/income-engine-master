import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Spinner } from "@/components/Spinner";
import { apiCall } from "@/lib/api";
import { errMsg, listSenders, type Sender } from "@/lib/senders";

export const Route = createFileRoute("/senders")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "SMTP Senders — Income Engine" },
      { name: "description", content: "Add, list and test SMTP senders for campaign delivery." },
      { property: "og:title", content: "SMTP Senders — Income Engine" },
      { property: "og:description", content: "Add, list and test SMTP senders for campaign delivery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SendersPage,
});

const empty = {
  label: "",
  host: "",
  port: 587,
  username: "",
  password: "",
  from_email: "",
  from_name: "",
  daily_cap: 50,
};

type TestResult = { ok: boolean; error?: string };

function SendersPage() {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TestResult>>({});

  const load = async () => {
    setLoading(true);
    try {
      setSenders(await listSenders());
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiCall("POST", "/api/senders", {
        ...form,
        port: Number(form.port),
        daily_cap: Number(form.daily_cap),
      });
      toast.success("Sender added");
      setForm(empty);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const test = async (id: string) => {
    setTesting(id);
    try {
      const r = await apiCall<TestResult>("POST", `/api/senders/${id}/test`, {});
      setResults((m) => ({ ...m, [id]: { ok: !!r?.ok, error: r?.error } }));
    } catch (err) {
      setResults((m) => ({ ...m, [id]: { ok: false, error: errMsg(err) } }));
    } finally {
      setTesting(null);
    }
  };

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <AppShell title="SMTP Senders">
      <div className="max-w-4xl space-y-8">
        <form
          onSubmit={submit}
          className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-6 space-y-4"
        >
          <h2 className="font-display font-semibold">Add sender</h2>
          <div className="grid grid-cols-2 gap-4">
            <F label="Label"><input required className={inp} value={form.label} onChange={set("label")} /></F>
            <F label="Host"><input required className={inp} value={form.host} onChange={set("host")} /></F>
            <F label="Port"><input required type="number" className={inp} value={form.port} onChange={set("port")} /></F>
            <F label="Username"><input required className={inp} value={form.username} onChange={set("username")} /></F>
            <F label="Password"><input required type="password" className={inp} value={form.password} onChange={set("password")} /></F>
            <F label="From email"><input required type="email" className={inp} value={form.from_email} onChange={set("from_email")} /></F>
            <F label="From name"><input className={inp} value={form.from_name} onChange={set("from_name")} /></F>
            <F label="Daily cap"><input required type="number" min={1} className={inp} value={form.daily_cap} onChange={set("daily_cap")} /></F>
          </div>
          <button type="submit" disabled={saving} className="btn-gold inline-flex items-center gap-2">
            {saving && <Spinner />} {saving ? "Saving…" : "Add sender"}
          </button>
        </form>

        <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)]">
            <h2 className="font-display font-semibold">Senders</h2>
            <button onClick={load} className="text-xs font-mono text-[var(--color-cyan)] inline-flex items-center gap-2">
              {loading && <Spinner className="h-3 w-3" />} Refresh
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-elevated)] text-left text-xs uppercase tracking-wider text-[var(--color-text-secondary)] font-mono">
              <tr>
                <th className="px-4 py-2">Label</th>
                <th className="px-4 py-2">Host</th>
                <th className="px-4 py-2">From</th>
                <th className="px-4 py-2">Cap</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {senders.map((s) => {
                const r = results[s.id];
                return (
                  <tr key={s.id} className="border-t border-[var(--color-border-subtle)] align-top">
                    <td className="px-4 py-2">{s.label}</td>
                    <td className="px-4 py-2 font-mono text-xs">{s.host}</td>
                    <td className="px-4 py-2 font-mono text-xs">{s.from_email}</td>
                    <td className="px-4 py-2">{s.daily_cap}</td>
                    <td className="px-4 py-2 text-[var(--color-text-secondary)]">{s.status ?? "—"}</td>
                    <td className="px-4 py-2 text-right space-y-1">
                      <button
                        onClick={() => test(s.id)}
                        disabled={testing === s.id}
                        className="rounded-md border border-[var(--color-border-subtle)] px-3 py-1 text-xs hover:bg-[var(--color-bg-elevated)] inline-flex items-center gap-2"
                      >
                        {testing === s.id && <Spinner className="h-3 w-3" />} Test
                      </button>
                      {r && (
                        <div
                          className={`text-xs rounded px-2 py-1 text-left ${
                            r.ok
                              ? "bg-[var(--color-success)]/15 text-[var(--color-success)]"
                              : "bg-[var(--color-error)]/15 text-[var(--color-error)]"
                          }`}
                        >
                          {r.ok ? "Connection Successful" : `Failed${r.error ? `: ${r.error}` : ""}`}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && senders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                    No senders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

const inp =
  "w-full px-3 py-2 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-sm focus:outline-none focus:border-[var(--color-cyan)]";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-1 font-mono">{label}</div>
      {children}
    </label>
  );
}
