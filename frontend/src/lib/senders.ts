import { apiCall } from "@/lib/api";

export interface Sender {
  id: string;
  label?: string;
  host?: string;
  from_email?: string;
  daily_cap?: number;
  status?: string;
  [k: string]: unknown;
}

export async function listSenders(): Promise<Sender[]> {
  const r = await apiCall<unknown>("GET", "/api/senders");
  const arr = Array.isArray(r)
    ? r
    : r && typeof r === "object"
      ? ((r as Record<string, unknown>).senders ??
        (r as Record<string, unknown>).items ??
        [])
      : [];
  return (arr as Sender[]).map((s) => ({ ...s, id: String(s.id ?? (s as Record<string, unknown>)._id ?? "") }));
}

export function errMsg(err: unknown): string {
  const raw = (err as Error)?.message ?? String(err);
  try {
    const j = JSON.parse(raw);
    if (typeof j.detail === "string") return j.detail;
    if (j.detail) return JSON.stringify(j.detail);
    if (j.message) return j.message;
    if (j.error) return j.error;
  } catch {
    /* not json */
  }
  return raw;
}
