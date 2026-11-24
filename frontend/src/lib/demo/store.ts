// Storage for the sample-data backend. Lives in localStorage so it survives a
// refresh or a new tab, the same way the campaign state does.

import type { Lead, Offer } from "./agents";

export interface StoredFile {
  id: string;
  filename: string;
  rows: Lead[];
  created_at: string;
}

export interface Job {
  id: string;
  file_id: string;
  offer_id: string;
  started_at: number;
}

export interface Campaign {
  id: string;
  job_id: string;
  sender_id: string;
  day: number;
  limit: number;
  started_at: number;
}

export interface SenderRecord {
  id: string;
  label: string;
  host: string;
  port: number;
  username: string;
  from_email: string;
  from_name: string;
  daily_cap: number;
  status: string;
  created_at: string;
}

export interface DemoState {
  offers: Record<string, Offer>;
  files: Record<string, StoredFile>;
  jobs: Record<string, Job>;
  campaigns: Record<string, Campaign>;
  senders: SenderRecord[];
  settings: Record<string, unknown> | null;
}

const KEY = "ie_demo_state";

const emptyState = (): DemoState => ({
  offers: {},
  files: {},
  jobs: {},
  campaigns: {},
  senders: [],
  settings: null,
});

function load(): DemoState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<DemoState>;
    return { ...emptyState(), ...parsed };
  } catch {
    return emptyState();
  }
}

let state: DemoState = load();

export function getState(): DemoState {
  return state;
}

export function save(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode — sample data stays in memory only */
  }
}

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}

export function resetDemoState(): void {
  state = emptyState();
  save();
}
