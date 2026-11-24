// Minimal CSV reader/writer for the sample-data backend.

export function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^/, "");
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      current.push(field);
      field = "";
    } else if (ch === "\n") {
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
    } else if (ch === "\r") {
      // ignore carriage returns
    } else {
      field += ch;
    }
  }
  if (field !== "" || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return [];

  const header = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h] = (row[idx] ?? "").trim();
    });
    return obj;
  });
}

export function toCsv<T extends object>(
  rows: readonly T[],
  columns: string[],
): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map(esc).join(",")];
  for (const row of rows) {
    const rec = row as Record<string, unknown>;
    lines.push(columns.map((c) => esc(rec[c])).join(","));
  }
  return lines.join("\r\n");
}

export function decodeBase64(b64: string): string {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}
