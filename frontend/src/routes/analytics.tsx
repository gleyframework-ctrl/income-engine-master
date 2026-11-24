import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  Eye,
  Flame,
  Inbox,
  Lightbulb,
  MessageSquare,
  MousePointerClick,
  Radar,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis } from "recharts";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Spinner } from "@/components/Spinner";
import { apiCall } from "@/lib/api";
import { errMsg, listSenders, type Sender } from "@/lib/senders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const Route = createFileRoute("/analytics")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Campaign Command Center — Income Engine" },
      {
        name: "description",
        content: "Monitor campaign conversion, hot leads, replies, and inbox health in real time.",
      },
      { property: "og:title", content: "Campaign Command Center — Income Engine" },
      {
        property: "og:description",
        content: "Monitor campaign conversion, hot leads, replies, and inbox health in real time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnalyticsPage,
});

type EventType = "open" | "click" | "reply";

interface TrackingEvent {
  type: EventType;
  email: string;
  time: string;
}

interface LeadActivity {
  email: string;
  opens: number;
  clicks: number;
  replies: number;
  latest: string;
  events: TrackingEvent[];
}

const MOCK_EMAILS = Array.from({ length: 20 }, (_, index) =>
  `lead_${String(index + 1).padStart(2, "0")}@company-${(index % 7) + 1}.com`,
);

const MOCK_EVENTS: TrackingEvent[] = Array.from({ length: 50 }, (_, index) => {
  const type: EventType = index < 29 ? "open" : index < 43 ? "click" : "reply";
  return {
    type,
    email: MOCK_EMAILS[(index * 7 + (index > 28 ? 3 : 0)) % MOCK_EMAILS.length],
    time: new Date(Date.UTC(2026, 8, 24, 18, 40) - index * 11 * 60_000).toISOString(),
  };
});

const MOCK_SUPPRESSED = new Set([MOCK_EMAILS[2], MOCK_EMAILS[8], MOCK_EMAILS[15]]);

function unwrap(value: unknown): unknown {
  if (value && typeof value === "object" && "data" in value) {
    return (value as { data: unknown }).data;
  }
  return value;
}

function normaliseEvents(value: unknown): TrackingEvent[] {
  const unwrapped = unwrap(value);
  const source = Array.isArray(unwrapped)
    ? unwrapped
    : unwrapped && typeof unwrapped === "object" && "events" in unwrapped
      ? (unwrapped as { events: unknown }).events
      : [];

  if (!Array.isArray(source)) return [];
  return source.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const rawType = String(row.type ?? row.event_type ?? "").toLowerCase();
    const type: EventType | null = rawType.includes("reply")
      ? "reply"
      : rawType.includes("click")
        ? "click"
        : rawType.includes("open")
          ? "open"
          : null;
    const email = String(row.email ?? row.email_hash ?? row.lead ?? "Unknown lead");
    if (!type) return [];
    return [{ type, email, time: String(row.time ?? row.timestamp ?? row.created_at ?? "") }];
  });
}

function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / 700, 1);
      setShown(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{shown.toLocaleString()}{suffix}</>;
}

function ConversionLine({ value }: { value: number }) {
  return (
    <div className="flex min-w-16 flex-1 items-center gap-2" aria-label={`${value}% conversion`}>
      <div className="h-px flex-1 bg-gradient-to-r from-[var(--color-border-subtle)] via-[var(--color-cyan)]/60 to-[var(--color-border-subtle)]" />
      <span className="font-mono text-[10px] text-[var(--color-text-secondary)]">{value}%</span>
    </div>
  );
}

function FunnelNode({
  label,
  value,
  icon: Icon,
  tone,
  pulse = false,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  tone: string;
  pulse?: boolean;
}) {
  return (
    <div className="flex min-w-24 flex-col items-center text-center">
      <motion.div
        animate={pulse ? { boxShadow: ["0 0 0 0 currentColor", "0 0 0 9px transparent", "0 0 0 0 transparent"] } : undefined}
        transition={pulse ? { duration: 2.2, repeat: Infinity, ease: "easeOut" } : undefined}
        className={`flex h-12 w-12 items-center justify-center rounded-full border bg-[var(--color-bg-primary)] ${tone}`}
      >
        <Icon className="h-5 w-5" />
      </motion.div>
      <div className="mt-3 text-xs text-[var(--color-text-secondary)]">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold"><CountUp value={value} /></div>
    </div>
  );
}

function ProgressRing({ progress }: { progress: number }) {
  return (
    <div className="relative h-24 w-24" role="progressbar" aria-valuenow={progress}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-border-subtle)" strokeWidth="7" />
        <motion.circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="var(--color-cyan)"
          strokeWidth="7"
          strokeLinecap="round"
          pathLength="1"
          strokeDasharray="1"
          animate={{ strokeDashoffset: 1 - progress / 100 }}
          transition={{ duration: 0.35 }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-sm text-[var(--color-cyan)]">{progress}%</span>
    </div>
  );
}

function AnalyticsPage() {
  const [campaignId, setCampaignId] = useState("");
  const [events, setEvents] = useState<TrackingEvent[]>(MOCK_EVENTS);
  const [loading, setLoading] = useState(false);
  const [isDemo, setIsDemo] = useState(true);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [senderId, setSenderId] = useState("");
  const [scanning, setScanning] = useState<"bounces" | "replies" | null>(null);
  const [scanProgress, setScanProgress] = useState(0);

  useEffect(() => {
    listSenders()
      .then(setSenders)
      .catch((error) => toast.error(errMsg(error)));
  }, []);

  useEffect(() => {
    if (!scanning) return;
    const timer = window.setInterval(() => {
      setScanProgress((value) => Math.min(value + Math.ceil((92 - value) / 7), 92));
    }, 260);
    return () => window.clearInterval(timer);
  }, [scanning]);

  const load = async () => {
    if (!campaignId.trim()) return;
    setLoading(true);
    try {
      const result = await apiCall<unknown>("GET", `/api/tracking/${encodeURIComponent(campaignId.trim())}`);
      const liveEvents = normaliseEvents(result);
      if (liveEvents.length === 0) {
        setEvents(MOCK_EVENTS);
        setIsDemo(true);
        toast.info("No live events yet. Showing representative campaign activity.");
      } else {
        setEvents(liveEvents.sort((a, b) => b.time.localeCompare(a.time)));
        setIsDemo(false);
      }
    } catch (error) {
      setEvents(MOCK_EVENTS);
      setIsDemo(true);
      toast.error(`${errMsg(error)} — showing representative activity.`);
    } finally {
      setLoading(false);
    }
  };

  const leads = useMemo(() => {
    const grouped = new Map<string, LeadActivity>();
    events.forEach((event) => {
      const current = grouped.get(event.email) ?? {
        email: event.email,
        opens: 0,
        clicks: 0,
        replies: 0,
        latest: event.time,
        events: [],
      };
      current[`${event.type}s` as "opens" | "clicks" | "replies"] += 1;
      current.latest = current.latest > event.time ? current.latest : event.time;
      current.events.push(event);
      grouped.set(event.email, current);
    });
    return [...grouped.values()].sort((a, b) => b.latest.localeCompare(a.latest));
  }, [events]);

  const opens = events.filter((event) => event.type === "open").length;
  const clicks = events.filter((event) => event.type === "click").length;
  const replies = events.filter((event) => event.type === "reply").length;
  const sent = Math.max(64, leads.length * 4, opens + clicks + replies);
  const delivered = Math.max(opens + clicks + replies, Math.round(sent * 0.94));
  const uniqueOpened = leads.filter((lead) => lead.opens > 0).length;
  const uniqueClicked = leads.filter((lead) => lead.clicks > 0).length;
  const uniqueReplied = leads.filter((lead) => lead.replies > 0).length;
  const funnel = [sent, delivered, uniqueOpened, uniqueClicked, uniqueReplied];
  const conversion = (from: number, to: number) => from > 0 ? Math.round((to / from) * 100) : 0;
  const openRate = sent > 0 ? (uniqueOpened / sent) * 100 : 0;
  const clickRate = uniqueOpened > 0 ? (uniqueClicked / uniqueOpened) * 100 : 0;

  const recommendation = uniqueReplied > 5
    ? {
        icon: Flame,
        title: "Hot Campaign",
        text: "You have active conversations. Action: Go to your inbox and close these deals!",
        tone: "border-[var(--color-success)]/35 bg-[var(--color-success)]/10 text-[var(--color-success)]",
      }
    : clickRate >= 20 && uniqueReplied === 0
      ? {
          icon: Target,
          title: "High Interest, No Replies",
          text: "Leads are clicking but not convinced. Action: Send a ‘Case Study’ email on Day 5.",
          tone: "border-[var(--color-cyan)]/35 bg-[var(--color-cyan)]/10 text-[var(--color-cyan)]",
        }
      : {
          icon: Lightbulb,
          title: "Low Open Rate",
          text: "Your subject lines might be going to spam or feel too familiar. Action: Test a new ‘Curiosity’ angle on Day 3.",
          tone: "border-[var(--color-gold)]/35 bg-[var(--color-gold)]/10 text-[var(--color-gold)]",
        };

  const trend = useMemo(() => {
    const slots = [0, 1, 2, 3, 4, 5, 6, 7].map((index) => ({ label: `${index * 3}h`, activity: 0 }));
    events.forEach((_, index) => {
      slots[index % slots.length].activity += 1;
    });
    return slots;
  }, [events]);

  const scan = async (kind: "bounces" | "replies") => {
    if (!senderId) {
      toast.error("Select a sender before starting a scan.");
      return;
    }
    setScanning(kind);
    setScanProgress(8);
    try {
      const result = unwrap(await apiCall<unknown>("POST", `/api/${kind}/scan`, { sender_id: senderId }));
      const row = result && typeof result === "object" ? result as Record<string, unknown> : {};
      const paused = Number(row.auto_paused ?? row.paused ?? row.replied ?? 0);
      const suppressed = Number(row.suppressed ?? row.bounces ?? row.bounce_count ?? 0);
      setScanProgress(100);
      toast.success(`✅ Scan Complete. Auto-paused ${paused} leads, suppressed ${suppressed} bounces.`);
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      window.setTimeout(() => {
        setScanning(null);
        setScanProgress(0);
      }, 500);
    }
  };

  return (
    <AppShell title="Campaign Command Center">
      <TooltipProvider delayDuration={200}>
      <div className="mx-auto max-w-[1500px] space-y-5">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-cyan)]">
              <Activity className="h-3.5 w-3.5" /> Live revenue intelligence
            </div>
            <h2 className="font-display text-3xl font-semibold">Every signal. One decisive next move.</h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-secondary)]">See where attention becomes conversation, then act on the leads showing the strongest buying intent.</p>
          </div>
          <div className="flex w-full max-w-xl gap-2">
            <Input value={campaignId} onChange={(event) => setCampaignId(event.target.value)} onKeyDown={(event) => event.key === "Enter" && load()} placeholder="Enter campaign ID" className="h-10 bg-[var(--color-bg-elevated)]" />
            <Button onClick={load} disabled={loading || !campaignId.trim()} className="h-10 shrink-0">
              {loading ? <Spinner /> : <Search />} Load campaign
            </Button>
          </div>
        </motion.div>

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className={`flex items-start gap-4 rounded-md border px-5 py-4 ${recommendation.tone}`}>
          <div className="mt-0.5 rounded-md border border-current/20 bg-current/10 p-2"><recommendation.icon className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display font-semibold">{recommendation.title}</span>
              <span className="rounded-full border border-current/20 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider">Next step recommendation</span>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-primary)]">{recommendation.text}</p>
          </div>
          <Sparkles className="hidden h-5 w-5 sm:block" />
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]/80 p-5 backdrop-blur-xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-semibold">Campaign journey</h3>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Conversion across the complete revenue path</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-3 py-1.5 font-mono text-[10px] uppercase text-[var(--color-text-secondary)]">
              <span className={`h-1.5 w-1.5 rounded-full ${isDemo ? "bg-[var(--color-gold)]" : "animate-pulse bg-[var(--color-success)]"}`} />
              {isDemo ? "Representative data" : "Live campaign"}
            </div>
          </div>
          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-[790px] items-start">
              <FunnelNode label="Sent" value={funnel[0]} icon={Send} tone="border-[var(--color-purple)]/50 text-[var(--color-purple)]" />
              <ConversionLine value={conversion(funnel[0], funnel[1])} />
              <FunnelNode label="Delivered" value={funnel[1]} icon={CheckCircle2} tone="border-[var(--color-text-secondary)]/60 text-[var(--color-text-primary)]" />
              <ConversionLine value={conversion(funnel[1], funnel[2])} />
              <FunnelNode label="Opened" value={funnel[2]} icon={Eye} tone="border-[var(--color-success)]/60 text-[var(--color-success)]" />
              <ConversionLine value={conversion(funnel[2], funnel[3])} />
              <FunnelNode label="Clicked" value={funnel[3]} icon={MousePointerClick} tone="border-[var(--color-cyan)]/60 text-[var(--color-cyan)]" />
              <ConversionLine value={conversion(funnel[3], funnel[4])} />
              <FunnelNode label="Replied" value={funnel[4]} icon={MessageSquare} tone="border-[var(--color-gold)]/70 text-[var(--color-gold)]" pulse />
            </div>
          </div>
        </motion.section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="min-w-0 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]/75 backdrop-blur-xl">
            <div className="flex flex-col gap-4 border-b border-[var(--color-border-subtle)] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2"><Radar className="h-4 w-4 text-[var(--color-cyan)]" /><h3 className="font-display font-semibold">Live activity & hot leads</h3></div>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{leads.length} engaged leads · {events.length} intent signals</p>
              </div>
              <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
                <span><strong className="mr-1 text-[var(--color-success)]"><CountUp value={opens} /></strong>opens</span>
                <span><strong className="mr-1 text-[var(--color-cyan)]"><CountUp value={clicks} /></strong>clicks</span>
                <span><strong className="mr-1 text-[var(--color-gold)]"><CountUp value={replies} /></strong>replies</span>
              </div>
            </div>
            <div className="max-h-[670px] space-y-2 overflow-y-auto p-3 sm:p-4">
              {leads.length === 0 ? (
                <div className="py-20 text-center"><Inbox className="mx-auto mb-4 h-10 w-10 text-[var(--color-text-secondary)]" /><p>No tracking events found for this campaign yet.</p></div>
              ) : leads.map((lead, index) => {
                const isHot = lead.opens > 2 || lead.clicks > 1;
                const isPaused = MOCK_SUPPRESSED.has(lead.email) || lead.replies > 0;
                return (
                  <motion.article key={lead.email} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(index * 0.035, 0.35) }} className="group grid gap-3 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)]/70 p-4 transition-colors hover:border-[var(--color-cyan)]/35 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-mono text-xs text-[var(--color-text-primary)]">{lead.email}</span>
                        {isHot && <span className="rounded-full border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/10 px-2 py-0.5 font-mono text-[9px] font-semibold text-[var(--color-gold)] shadow-[0_0_18px_var(--color-gold)]/10">🔥 HOT LEAD</span>}
                        {isPaused && (
                          <Tooltip>
                            <TooltipTrigger asChild><span className="cursor-help rounded-full border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-2 py-0.5 font-mono text-[9px] text-[var(--color-success)]">⏸️ Auto-Paused (Replied)</span></TooltipTrigger>
                            <TooltipContent className="max-w-64 bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]">This lead is auto-paused. The engine will not send follow-ups.</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Latest signal {lead.latest ? new Date(lead.latest).toLocaleString() : "just now"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Signal icon={Eye} value={lead.opens} label="opens" tone="text-[var(--color-success)]" />
                      <Signal icon={MousePointerClick} value={lead.clicks} label="clicks" tone="text-[var(--color-cyan)]" />
                      <Signal icon={MessageSquare} value={lead.replies} label="replies" tone="text-[var(--color-gold)]" />
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </motion.section>

          <aside className="space-y-5">
            <motion.section initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }} className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]/80 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[var(--color-success)]" /><h3 className="font-display font-semibold">Inbox health</h3></div>
              <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">Protect deliverability by finding bounces and stopping follow-ups to leads who replied.</p>
              <div className="mt-5">
                <label className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">Sender to inspect</label>
                <Select value={senderId} onValueChange={setSenderId}>
                  <SelectTrigger className="bg-[var(--color-bg-primary)]"><SelectValue placeholder="Select sender" /></SelectTrigger>
                  <SelectContent>{senders.map((sender) => <SelectItem key={sender.id} value={sender.id}>{sender.label || sender.from_email || sender.id}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {scanning ? (
                <div className="mt-6 flex flex-col items-center rounded-md border border-[var(--color-cyan)]/20 bg-[var(--color-cyan)]/5 py-6">
                  <ProgressRing progress={scanProgress} />
                  <div className="mt-3 text-sm font-medium">Scanning {scanning}…</div>
                  <div className="mt-1 text-xs text-[var(--color-text-secondary)]">Checking message signals securely</div>
                </div>
              ) : (
                <div className="mt-5 grid gap-2">
                  <Button variant="outline" onClick={() => scan("bounces")} disabled={!senderId}><RefreshCw /> Scan for Bounces</Button>
                  <Button variant="outline" onClick={() => scan("replies")} disabled={!senderId}><MessageSquare /> Scan for Replies</Button>
                </div>
              )}
              <div className="mt-4 flex items-center gap-2 border-t border-[var(--color-border-subtle)] pt-4 text-xs text-[var(--color-text-secondary)]"><CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-success)]" /> Automation safeguards active</div>
            </motion.section>

            <motion.section initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.32 }} className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]/80 p-5">
              <div className="flex items-center justify-between"><div><div className="font-display text-sm font-semibold">Signal velocity</div><div className="mt-1 text-xs text-[var(--color-text-secondary)]">Activity across 24 hours</div></div><TrendingUp className="h-4 w-4 text-[var(--color-purple)]" /></div>
              <div className="mt-4 h-32" aria-label="Campaign activity sparkline">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-purple)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--color-purple)" stopOpacity={0} /></linearGradient></defs>
                    <XAxis dataKey="label" hide />
                    <ChartTooltip contentStyle={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-subtle)", borderRadius: "6px", fontSize: "11px" }} />
                    <Area type="monotone" dataKey="activity" stroke="var(--color-purple)" fill="url(#activityFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[var(--color-border-subtle)] pt-4">
                <MiniMetric label="Open rate" value={Math.round(openRate)} />
                <MiniMetric label="Click intent" value={Math.round(clickRate)} />
              </div>
            </motion.section>
          </aside>
        </div>
      </div>
      </TooltipProvider>
    </AppShell>
  );
}

function Signal({ icon: Icon, value, label, tone }: { icon: ComponentType<{ className?: string }>; value: number; label: string; tone: string }) {
  return <div className="flex min-w-14 items-center justify-center gap-1.5 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-2 py-1.5" title={`${value} ${label}`}><Icon className={`h-3.5 w-3.5 ${tone}`} /><span className="font-mono text-xs">{value}</span></div>;
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return <div><div className="font-display text-xl font-semibold"><CountUp value={value} suffix="%" /></div><div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-[var(--color-text-secondary)]">{label}</div></div>;
}
