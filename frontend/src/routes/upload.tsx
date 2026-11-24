import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useCampaign } from "@/context/CampaignContext";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/upload")({
  ssr: false,
  component: UploadPage,
});

type CardStatus =
  | { phase: "idle" }
  | { phase: "waking" }
  | { phase: "uploading" }
  | { phase: "success"; filename: string; rowCount: number | null; fileId: string }
  | { phase: "error"; message: string };

const idle: CardStatus = { phase: "idle" };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the "data:...;base64," prefix
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

function pickString(json: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = json[k];
    if (typeof v === "string" && v) return v;
  }
  return null;
}

function pickNumber(json: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = json[k];
    if (typeof v === "number") return v;
  }
  return null;
}

async function postUpload(filename: string, data: string): Promise<Response> {
  return apiFetch("/api/upload-json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, data }),
  });
}

function UploadPage() {
  const { state, setState } = useCampaign();
  const navigate = useNavigate();
  const [extracted, setExtracted] = useState<CardStatus>(idle);
  const [validated, setValidated] = useState<CardStatus>(idle);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [mergeDone, setMergeDone] = useState<{ matched: number | null; fileId: string | null } | null>(null);

  useEffect(() => {
    if (!state.offerId) navigate({ to: "/offer", replace: true });
  }, [state.offerId, navigate]);

  const upload = async (
    file: File,
    setCard: React.Dispatch<React.SetStateAction<CardStatus>>,
  ) => {
    setMergeDone(null);
    setMergeError(null);
    setCard({ phase: "waking" });
    // Wake-up ping — ignore all errors
    try {
      await apiFetch("/");
    } catch {
      /* server may be cold; ignore */
    }

    let base64: string;
    try {
      base64 = await fileToBase64(file);
    } catch (err) {
      setCard({ phase: "error", message: (err as Error).message });
      return;
    }

    setCard({ phase: "uploading" });

    const attempt = async (): Promise<{ fileId: string; rowCount: number | null }> => {
      let lastError: Error | null = null;
      for (let i = 0; i < 2; i++) {
        if (i === 1) await new Promise((r) => setTimeout(r, 2500));
        try {
          const res = await postUpload(file.name, base64);
          if (res.status === 502) {
            lastError = new Error("Server is still waking up (502)");
            continue;
          }
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(text || `Upload failed (${res.status})`);
          }
          const json = (await res.json()) as Record<string, unknown>;
          const payload =
            json && typeof json.data === "object" && json.data !== null
              ? (json.data as Record<string, unknown>)
              : json;
          const fileId = pickString(payload, "file_id", "fileId", "id");
          if (!fileId) throw new Error("Upload succeeded but no file id was returned");
          return { fileId, rowCount: pickNumber(payload, "row_count", "rowCount", "rows") };
        } catch (err) {
          // Network errors get one retry too; other errors rethrow
          if (err instanceof TypeError) {
            lastError = new Error("Network error — server unreachable");
            continue;
          }
          throw err;
        }
      }
      throw lastError ?? new Error("Upload failed");
    };

    try {
      const { fileId, rowCount } = await attempt();
      setCard({ phase: "success", filename: file.name, rowCount, fileId });
    } catch (err) {
      setCard({ phase: "error", message: (err as Error).message });
    }
  };

  const bothReady = extracted.phase === "success" && validated.phase === "success";

  const loadSampleLists = async () => {
    const { buildSampleLists } = await import("@/lib/demo/sampleLists");
    const {
      extractedCsv,
      validatedCsv,
      extractedFilename,
      validatedFilename,
    } = buildSampleLists();
    const toFile = (csv: string, name: string) =>
      new File([csv], name, { type: "text/csv" });
    await upload(toFile(extractedCsv, extractedFilename), setExtracted);
    await upload(toFile(validatedCsv, validatedFilename), setValidated);
  };

  const merge = async () => {
    if (extracted.phase !== "success" || validated.phase !== "success") return;
    setMerging(true);
    setMergeError(null);
    setMergeDone(null);
    try {
      const res = await apiFetch("/api/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extracted_file_id: extracted.fileId,
          validated_file_id: validated.fileId,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Merge failed (${res.status})`);
      }
      const json = (await res.json()) as Record<string, unknown>;
      const payload =
        json && typeof json.data === "object" && json.data !== null
          ? (json.data as Record<string, unknown>)
          : json;
      const fileId = pickString(payload, "file_id", "fileId", "merged_file_id", "id");
      const matched = pickNumber(payload, "matched", "leads_matched", "matched_count");
      setMergeDone({ matched, fileId });
      setState((s) => ({
        ...s,
        extractedFileId: extracted.fileId,
        validatedFileId: validated.fileId,
        fileId: fileId ?? s.fileId,
        mergeStatus: "complete",
        mergeResult: { matched: matched ?? 0, unmatched: 0, preview: [] },
      }));
    } catch (err) {
      setMergeError((err as Error).message);
    } finally {
      setMerging(false);
    }
  };

  const busy =
    extracted.phase === "waking" ||
    extracted.phase === "uploading" ||
    validated.phase === "waking" ||
    validated.phase === "uploading" ||
    merging;

  return (
    <AppShell title="Step 2 — Upload & merge">
      <div className="max-w-2xl space-y-6">
        {/* Progress checklist */}
        <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)]">
          <li className="flex items-center gap-1">
            <span className="text-[var(--color-gold)]">1 Offer</span>
            <span>✅</span>
          </li>
          <li aria-hidden>—</li>
          <li className="font-semibold text-[var(--color-text-primary)]">
            2 Upload &amp; Merge (you are here)
          </li>
          <li aria-hidden>—</li>
          <li>3 Pipeline</li>
          <li aria-hidden>—</li>
          <li>4 Results</li>
        </ol>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={loadSampleLists}
            disabled={busy}
            className="btn-outline"
          >
            Use sample lists
          </button>
          <span className="text-xs text-[var(--color-text-secondary)]">
            or choose your own two CSVs below
          </span>
        </div>

        <UploadCard
          title="Extracted list"
          status={extracted}
          disabled={busy}
          onFile={(f) => upload(f, setExtracted)}
        />
        <UploadCard
          title="Validated list"
          status={validated}
          disabled={busy}
          onFile={(f) => upload(f, setValidated)}
        />

        {bothReady && !mergeDone && (
          <button onClick={merge} disabled={merging} className="btn-gold">
            {merging ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Merging…
              </span>
            ) : (
              "Merge lists"
            )}
          </button>
        )}

        {mergeError && (
          <div className="rounded-lg border border-[var(--color-error)]/50 bg-[var(--color-error)]/10 p-4 text-sm text-[var(--color-error)]">
            {mergeError}
          </div>
        )}

        {mergeDone && (
          <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4 space-y-3">
            <div className="font-semibold text-green-400">
              🎉 Merge complete
              {mergeDone.matched !== null && ` — ${mergeDone.matched} leads matched`}
            </div>
            <button
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-green-50 hover:bg-green-500 transition-colors"
              onClick={() => navigate({ to: "/pipeline" })}
            >
              Continue to Pipeline →
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function UploadCard({
  title,
  status,
  disabled,
  onFile,
}: {
  title: string;
  status: CardStatus;
  disabled: boolean;
  onFile: (f: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const succeeded = status.phase === "success";
  const working = status.phase === "waking" || status.phase === "uploading";

  return (
    <div
      className={`rounded-lg border border-dashed p-6 ${
        succeeded
          ? "border-green-500/50 bg-green-500/5"
          : "border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-display font-semibold">{title}</div>

          {status.phase === "waking" && (
            <div className="text-xs text-[var(--color-text-secondary)] mt-2">
              ☀️ Waking server…
            </div>
          )}
          {status.phase === "uploading" && (
            <div className="text-xs text-[var(--color-text-secondary)] mt-2">
              ⏫ Uploading…
            </div>
          )}
          {status.phase === "success" && (
            <div className="mt-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-xs text-green-400">
              ✓ {status.filename}
              {status.rowCount !== null && ` — ${status.rowCount} rows`}
            </div>
          )}
          {status.phase === "error" && (
            <div className="mt-2 rounded-md border border-[var(--color-error)]/50 bg-[var(--color-error)]/10 px-3 py-2 text-xs text-[var(--color-error)]">
              {status.message} — please try again.
            </div>
          )}
        </div>

        <button
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="btn-outline shrink-0"
        >
          {working ? "Working…" : succeeded ? "Replace" : "Choose file"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
