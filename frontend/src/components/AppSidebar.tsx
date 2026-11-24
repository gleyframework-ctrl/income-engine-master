import { Link, useRouterState } from "@tanstack/react-router";
import {
  Target,
  Upload,
  Workflow,
  ListChecks,
  BarChart3,
  Settings,
  LogOut,
  Mail,
} from "lucide-react";
import { useCampaign, type CampaignState } from "@/context/CampaignContext";

type StepDot = "gray" | "cyan" | "gold";

interface Step {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  dot: (s: CampaignState) => StepDot;
}

const steps: Step[] = [
  {
    to: "/offer",
    label: "1. Offer",
    icon: Target,
    dot: (s) => (s.offerId ? "gold" : "gray"),
  },
  {
    to: "/upload",
    label: "2. Upload & Merge",
    icon: Upload,
    dot: (s) =>
      s.mergeStatus === "complete"
        ? "gold"
        : s.extractedFileId || s.validatedFileId
          ? "cyan"
          : "gray",
  },
  {
    to: "/pipeline",
    label: "3. Pipeline",
    icon: Workflow,
    dot: (s) => (s.jobId ? "cyan" : "gray"),
  },
  {
    to: "/results",
    label: "4. Results",
    icon: ListChecks,
    dot: (s) => (s.emails && s.emails.length > 0 ? "gold" : "gray"),
  },
  {
    to: "/analytics",
    label: "5. Command Center",
    icon: BarChart3,
    dot: () => "gray",
  },
];

function Dot({ kind }: { kind: StepDot }) {
  if (kind === "cyan") return <span className="dot-cyan" aria-label="active" />;
  if (kind === "gold") return <span className="dot-gold" aria-label="complete" />;
  return <span className="dot-gray" aria-label="idle" />;
}

export function AppSidebar() {
  const { state, reset } = useCampaign();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <aside className="w-64 shrink-0 border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] flex flex-col">
      <div className="px-5 py-5 border-b border-[var(--color-border-subtle)]">
        <div className="font-display text-lg font-semibold tracking-tight text-[var(--color-gold)]">
          Income Engine
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-secondary)] mt-1">
          Production MVP
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {steps.map((step) => {
          const active = pathname === step.to;
          const Icon = step.icon;
          return (
            <Link
              key={step.to}
              to={step.to}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{step.label}</span>
              <Dot kind={step.dot(state)} />
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-[var(--color-border-subtle)] space-y-1">
        <Link
          to="/senders"
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
            pathname === "/senders"
              ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          <Mail className="h-4 w-4" />
          <span>Senders</span>
        </Link>
        <Link
          to="/settings"
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
            pathname === "/settings"
              ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </Link>
        <button
          onClick={() => {
            reset();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Reset session</span>
        </button>
      </div>
    </aside>
  );
}
