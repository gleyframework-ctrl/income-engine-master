import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { apiCall } from "@/lib/api";

export const Route = createFileRoute("/settings")({
  ssr: false,
  component: SettingsPage,
});

function SettingsPage() {
  const [smtp, setSmtp] = useState({
    host: "",
    port: "587",
    username: "",
    password: "",
    from_email: "",
  });
  const [keys, setKeys] = useState({ minimax: "", openai: "" });
  const [showKeys, setShowKeys] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(
    null,
  );

  const save = async () => {
    setSaving(true);
    setToast(null);
    try {
      await apiCall("POST", "/api/settings", { smtp, api_keys: keys });
      setToast({ kind: "ok", msg: "Settings saved" });
    } catch (err) {
      setToast({ kind: "err", msg: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Settings">
      <div className="max-w-xl space-y-8">
        <section>
          <h2 className="font-display font-semibold mb-3">SMTP</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Host">
              <input
                className={inputCls}
                value={smtp.host}
                onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
              />
            </Field>
            <Field label="Port">
              <input
                className={inputCls}
                value={smtp.port}
                onChange={(e) => setSmtp({ ...smtp, port: e.target.value })}
              />
            </Field>
            <Field label="Username">
              <input
                className={inputCls}
                value={smtp.username}
                onChange={(e) => setSmtp({ ...smtp, username: e.target.value })}
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                className={inputCls}
                value={smtp.password}
                onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
              />
            </Field>
            <div className="col-span-2">
              <Field label="From email">
                <input
                  type="email"
                  className={inputCls}
                  value={smtp.from_email}
                  onChange={(e) =>
                    setSmtp({ ...smtp, from_email: e.target.value })
                  }
                />
              </Field>
            </div>
          </div>
        </section>

        <section>
          <button
            onClick={() => setShowKeys((v) => !v)}
            className="text-sm text-[var(--color-cyan)] font-mono"
          >
            {showKeys ? "▾" : "▸"} API keys
          </button>
          {showKeys && (
            <div className="mt-3 grid grid-cols-1 gap-4">
              <Field label="MiniMax">
                <input
                  type="password"
                  className={inputCls}
                  value={keys.minimax}
                  onChange={(e) => setKeys({ ...keys, minimax: e.target.value })}
                />
              </Field>
              <Field label="OpenAI">
                <input
                  type="password"
                  className={inputCls}
                  value={keys.openai}
                  onChange={(e) => setKeys({ ...keys, openai: e.target.value })}
                />
              </Field>
            </div>
          )}
        </section>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="btn-gold">
            {saving ? "Saving…" : "Save settings"}
          </button>
          {toast && (
            <span
              className={`text-sm ${
                toast.kind === "ok"
                  ? "text-[var(--color-success)]"
                  : "text-[var(--color-error)]"
              }`}
            >
              {toast.msg}
            </span>
          )}
        </div>
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
