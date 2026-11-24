export const API_BASE = "https://income-engine-backend--delcapo.replit.app";

export type DataMode = "sample" | "live";

const MODE_KEY = "ie_data_mode";

export function getDataMode(): DataMode {
  if (typeof window === "undefined") return "sample";
  try {
    return window.localStorage.getItem(MODE_KEY) === "live" ? "live" : "sample";
  } catch {
    return "sample";
  }
}

export function setDataMode(mode: DataMode): void {
  try {
    window.localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* private mode — the switch just won't persist */
  }
}

// Single exit point for every backend call. Sample mode runs the five agents
// in the browser; live mode talks to the real pipeline.
export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  if (getDataMode() === "sample") {
    const { demoFetch } = await import("@/lib/demo/server");
    return demoFetch(path, init);
  }
  return fetch(`${API_BASE}${path}`, init);
}

export async function apiCall<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown | FormData,
  isFormData = false,
): Promise<T> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("sb-auth-token")
      : null;
  const headers: HeadersInit = {};
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await apiFetch(path, {
    method,
    headers,
    body: isFormData
      ? (body as FormData)
      : body
        ? JSON.stringify(body)
        : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `API Error: ${res.status}`);
  }

  const json = await res.json();

  // Handle wrapped {status, data} format
  if (
    json &&
    typeof json === "object" &&
    "status" in json &&
    "data" in json
  ) {
    if (json.status === "error")
      throw new Error(json.message || "API Error");
    return json.data as T;
  }

  // Handle raw PocketBase/FastAPI response (confirmed via /openapi.json)
  return json as T;
}

export async function downloadFile(path: string, filename: string) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("sb-auth-token")
      : null;
  const res = await apiFetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
