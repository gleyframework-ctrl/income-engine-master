// In-browser stand-in for the real pipeline API. Same paths, same response
// shapes, so the pages work unchanged.

import {
  PIPELINE_STEPS,
  normalizeLead,
  runCopywriter,
  runCustomerAvatar,
  runKeywordIntelligence,
  runRelevanceFilter,
  hashString,
  mulberry32,
  type EmailRow,
  type FilterResult,
  type KeywordRow,
  type Lead,
  type Offer,
} from "./agents";
import { decodeBase64, parseCsv, toCsv } from "./csv";
import {
  getState,
  newId,
  save,
  type Campaign,
  type Job,
  type StoredFile,
} from "./store";

export const PIPELINE_MS = 18000;
const CAMPAIGN_MS = 25000;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const notFound = (message: string) => json({ error: message }, 404);

const resultsCache = new Map<string, EmailRow[]>();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeResults(job: Job): {
  rows: EmailRow[];
  filter: FilterResult;
  keywords: KeywordRow[];
} {
  const cached = resultsCache.get(job.id);
  const state = getState();
  const file = state.files[job.file_id];
  const offer = state.offers[job.offer_id];
  if (!file || !offer) return { rows: cached ?? [], filter: emptyFilter(), keywords: [] };

  const keywords = runKeywordIntelligence(offer);
  const { avatars } = runCustomerAvatar(file.rows);
  const filter = runRelevanceFilter(file.rows);

  const rows: EmailRow[] = [];
  filter.kept.forEach((lead, i) => {
    const avatar = avatars[lead.email] ?? {
      stage: "Awareness" as const,
      reason: "No buying signal captured",
    };
    const keyword = keywords[i % keywords.length]?.keyword ?? "";
    rows.push(...runCopywriter(lead, offer, avatar, keyword, job.id));
  });

  resultsCache.set(job.id, rows);
  return { rows, filter, keywords };
}

function emptyFilter(): FilterResult {
  return { kept: [], removed: [], layers: [], flaggedFreeProvider: 0 };
}

function jobProgress(job: Job) {
  const elapsed = Date.now() - job.started_at;
  const ratio = Math.min(1, elapsed / PIPELINE_MS);
  const progress = Math.round(ratio * 100);
  const stepIndex = Math.min(
    PIPELINE_STEPS.length - 1,
    Math.floor(ratio * PIPELINE_STEPS.length),
  );
  return {
    elapsed,
    progress,
    stepIndex,
    complete: elapsed >= PIPELINE_MS,
  };
}

function campaignProgress(campaign: Campaign) {
  const elapsed = Date.now() - campaign.started_at;
  const ratio = Math.min(1, elapsed / CAMPAIGN_MS);
  const sent = Math.round(campaign.limit * ratio);
  const failed = Math.round(sent * 0.04);
  return {
    sent,
    failed,
    remaining: Math.max(0, campaign.limit - sent - failed),
    done: elapsed >= CAMPAIGN_MS,
  };
}

function trackingEvents(campaign: Campaign) {
  const job = getState().jobs[campaign.job_id];
  if (!job) return [];
  const rows = computeResults(job).rows;
  const emails = [...new Set(rows.map((r) => r.email))];
  const r = mulberry32(hashString(campaign.id));
  const events: { type: string; email: string; time: string }[] = [];
  const base = campaign.started_at;

  emails.forEach((email, i) => {
    const opened = r() < 0.62;
    if (!opened) return;
    events.push({
      type: "open",
      email,
      time: new Date(base + (i * 90 + r() * 400) * 1000).toISOString(),
    });
    if (r() < 0.34) {
      events.push({
        type: "click",
        email,
        time: new Date(base + (i * 90 + 600 + r() * 900) * 1000).toISOString(),
      });
    }
    if (r() < 0.11) {
      events.push({
        type: "reply",
        email,
        time: new Date(base + (i * 90 + 1800 + r() * 1800) * 1000).toISOString(),
      });
    }
  });
  return events.sort((a, b) => a.time.localeCompare(b.time));
}

const DOWNLOAD_COLUMNS = [
  "email",
  "first_name",
  "last_name",
  "city",
  "state",
  "company",
  "buyer_stage",
  "avatar_reason",
  "keyword",
  "icebreaker",
  "sequence_number",
  "day",
  "subject_a",
  "subject_b",
  "email_body",
];

function readFileRows(body: {
  filename?: string;
  data?: string;
}): { rows: Lead[]; filename: string } {
  const filename = body.filename ?? "upload.csv";
  if (!body.data) throw new Error("No file data received");
  const text = decodeBase64(body.data);
  const raw = parseCsv(text);
  if (raw.length === 0) throw new Error("That file had no readable rows");
  const rows = raw.map(normalizeLead).filter((r) => r.email !== "");
  if (rows.length === 0) throw new Error("No email column found in that file");
  return { rows, filename };
}

export async function demoFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const [rawPath, query] = path.split("?");
  const method = (init?.method ?? "GET").toUpperCase();
  const params = new URLSearchParams(query ?? "");

  let body: Record<string, unknown> = {};
  if (typeof init?.body === "string" && init.body.trim() !== "") {
    try {
      body = JSON.parse(init.body) as Record<string, unknown>;
    } catch {
      body = {};
    }
  }

  await delay(120 + Math.random() * 180);

  const p = rawPath.replace(/\/+$/, "") || "/";

  /* ------------------------------- offers ------------------------------- */
  if (method === "POST" && p === "/api/offers") {
    const id = newId("off");
    const offer: Offer = {
      id,
      name: String(body.name ?? ""),
      url: String(body.url ?? ""),
      payout: Number(body.payout ?? 0),
      niche: String(body.niche ?? ""),
    };
    getState().offers[id] = offer;
    save();
    return json(offer);
  }

  /* ------------------------------- upload ------------------------------- */
  if (method === "POST" && p === "/api/upload-json") {
    try {
      const { rows, filename } = readFileRows(
        body as { filename?: string; data?: string },
      );
      const id = newId("file");
      const file: StoredFile = {
        id,
        filename,
        rows,
        created_at: new Date().toISOString(),
      };
      getState().files[id] = file;
      save();
      return json({
        file_id: id,
        filename,
        row_count: rows.length,
        status: "stored",
      });
    } catch (err) {
      return json({ error: (err as Error).message }, 400);
    }
  }

  /* -------------------------------- merge -------------------------------- */
  if (method === "POST" && p === "/api/merge") {
    const state = getState();
    const a = state.files[String(body.extracted_file_id ?? "")];
    const b = state.files[String(body.validated_file_id ?? "")];
    if (!a || !b) return notFound("One of the two lists is missing");

    const validated = new Map(b.rows.map((r) => [r.email.toLowerCase(), r]));
    const matched: Lead[] = [];
    const seen = new Set<string>();
    for (const row of a.rows) {
      const key = row.email.toLowerCase();
      if (seen.has(key)) continue;
      const hit = validated.get(key);
      if (hit) {
        seen.add(key);
        matched.push({ ...row, ...hit });
      }
    }
    const unmatched = a.rows.length - matched.length;
    const id = newId("merged");
    state.files[id] = {
      id,
      filename: "merged_final.csv",
      rows: matched,
      created_at: new Date().toISOString(),
    };
    save();
    return json({
      file_id: id,
      matched: matched.length,
      unmatched,
      filename: "merged_final.csv",
    });
  }

  /* ------------------------------- process ------------------------------- */
  if (method === "POST" && p.startsWith("/api/process/")) {
    const fileId = p.slice("/api/process/".length);
    const state = getState();
    const file = state.files[fileId];
    const offerId = params.get("offer_id") ?? "";
    const offer = state.offers[offerId];
    if (!file) return notFound("Merged file not found");
    if (!offer) return notFound("Offer not found — create one first");

    const id = newId("job");
    state.jobs[id] = {
      id,
      file_id: fileId,
      offer_id: offerId,
      started_at: Date.now(),
    };
    save();
    return json({ job_id: id, status: "pending", file_id: fileId });
  }

  /* -------------------------------- status ------------------------------- */
  if (method === "GET" && p.startsWith("/api/status/")) {
    const job = getState().jobs[p.slice("/api/status/".length)];
    if (!job) return notFound("Job not found");
    const { progress, stepIndex, complete } = jobProgress(job);
    const { rows, filter, keywords } = computeResults(job);
    const done = complete;

    return json({
      status: done ? "complete" : "running",
      progress,
      current_step: done
        ? "Complete"
        : PIPELINE_STEPS[stepIndex],
      current_step_index: stepIndex,
      steps: PIPELINE_STEPS.map((name, i) => ({
        name,
        state: done || i < stepIndex ? "complete" : i === stepIndex ? "active" : "pending",
      })),
      email_count: done ? rows.length : undefined,
      leads_in: filter.kept.length + filter.removed.length,
      leads_kept: filter.kept.length,
      leads_removed: filter.removed.length,
      keywords_found: keywords.length,
    });
  }

  /* ------------------------------- results ------------------------------- */
  if (method === "GET" && p.startsWith("/api/results/")) {
    const job = getState().jobs[p.slice("/api/results/".length)];
    if (!job) return notFound("Job not found");
    const { progress, complete } = jobProgress(job);
    if (!complete) {
      return json({
        error: `Pipeline still running (${progress}%). Wait for it to finish.`,
      }, 409);
    }
    return json(computeResults(job).rows);
  }

  /* ------------------------------- download ------------------------------ */
  if (method === "GET" && p.startsWith("/api/download/")) {
    const job = getState().jobs[p.slice("/api/download/".length)];
    if (!job) return notFound("Job not found");
    const rows = computeResults(job).rows;
    const csv = toCsv(rows, DOWNLOAD_COLUMNS);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="results_${job.id}.csv"`,
      },
    });
  }

  /* -------------------------------- senders ------------------------------ */
  if (method === "GET" && p === "/api/senders") {
    return json(getState().senders);
  }

  if (method === "POST" && p === "/api/senders") {
    const state = getState();
    const id = newId("snd");
    state.senders.push({
      id,
      label: String(body.label ?? "Sender"),
      host: String(body.host ?? ""),
      port: Number(body.port ?? 587),
      username: String(body.username ?? ""),
      from_email: String(body.from_email ?? ""),
      from_name: String(body.from_name ?? ""),
      daily_cap: Number(body.daily_cap ?? 50),
      status: "active",
      created_at: new Date().toISOString(),
    });
    save();
    return json({ id, status: "active" });
  }

  const senderTest = /^\/api\/senders\/([^/]+)\/test$/.exec(p);
  if (method === "POST" && senderTest) {
    const sender = getState().senders.find((s) => s.id === senderTest[1]);
    if (!sender) return notFound("Sender not found");
    return json({ ok: true, host: sender.host, port: sender.port });
  }

  /* ------------------------------- settings ------------------------------ */
  if (method === "POST" && p === "/api/settings") {
    getState().settings = body;
    save();
    return json({ status: "saved" });
  }

  /* ------------------------------- campaigns ----------------------------- */
  if (method === "POST" && p === "/api/campaigns/send_day") {
    const state = getState();
    const job = state.jobs[String(body.job_id ?? "")];
    if (!job) return notFound("Job not found");
    const id = newId("camp");
    const campaign: Campaign = {
      id,
      job_id: job.id,
      sender_id: String(body.sender_id ?? ""),
      day: Number(body.day ?? 1),
      limit: Number(body.limit ?? 50),
      started_at: Date.now(),
    };
    state.campaigns[id] = campaign;
    save();
    return json({ campaign_id: id, status: "sending", day: campaign.day });
  }

  const campaignStatus = /^\/api\/campaigns\/([^/]+)\/status$/.exec(p);
  if (method === "GET" && campaignStatus) {
    const campaign = getState().campaigns[campaignStatus[1]];
    if (!campaign) return notFound("Campaign not found");
    const { sent, failed, remaining, done } = campaignProgress(campaign);
    return json({
      status: done ? "complete" : "sending",
      sent,
      failed,
      remaining,
      current_step: done
        ? `Day ${campaign.day} delivered`
        : `Delivering day ${campaign.day} emails…`,
    });
  }

  /* ------------------------------- tracking ------------------------------ */
  if (method === "GET" && p.startsWith("/api/tracking/")) {
    const campaign = getState().campaigns[
      decodeURIComponent(p.slice("/api/tracking/".length))
    ];
    if (!campaign) return notFound("Campaign not found");
    return json({ events: trackingEvents(campaign) });
  }

  /* --------------------------------- scans ------------------------------- */
  if (method === "POST" && (p === "/api/bounces/scan" || p === "/api/replies/scan")) {
    const state = getState();
    const sender = state.senders.find((s) => s.id === String(body.sender_id ?? ""));
    if (!sender) return notFound("Sender not found");
    const r = mulberry32(hashString(sender.id + p + Math.floor(Date.now() / 60000)));
    if (p === "/api/bounces/scan") {
      return json({
        suppressed: Math.floor(r() * 6),
        auto_paused: Math.floor(r() * 3),
        scanned: sender.daily_cap,
      });
    }
    return json({
      replied: Math.floor(r() * 5) + 1,
      auto_paused: Math.floor(r() * 3) + 1,
      scanned: sender.daily_cap,
    });
  }

  /* ------------------------------ health ping ---------------------------- */
  if (p === "/" || p === "/api/health") {
    return json({ status: "ok", mode: "sample-data" });
  }

  return notFound(`Sample backend has no handler for ${method} ${p}`);
}
