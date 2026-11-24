import type { ReactNode } from "react";
import { useState } from "react";
import {
  API_BASE,
  getDataMode,
  setDataMode,
  type DataMode,
} from "@/lib/api";
import { AppSidebar } from "./AppSidebar";
import { StateBadges } from "./StateBadges";

function ModeBanner() {
  const [mode, setMode] = useState<DataMode>(() => getDataMode());

  const switchTo = (next: DataMode) => {
    setDataMode(next);
    setMode(next);
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-b border-[var(--color-purple)]/40 bg-[var(--color-purple)]/15 px-4 py-1 text-center font-mono text-xs text-[var(--color-purple)]">
      {mode === "sample" ? (
        <span>
          SAMPLE DATA — the five agents run in your browser. Nothing leaves this
          tab.
        </span>
      ) : (
        <span>DEV MODE — connected to {API_BASE}</span>
      )}
      <button
        onClick={() => switchTo(mode === "sample" ? "live" : "sample")}
        className="rounded border border-[var(--color-purple)]/40 px-2 py-0.5 hover:bg-[var(--color-purple)]/20"
      >
        {mode === "sample" ? "Switch to live backend" : "Switch to sample data"}
      </button>
    </div>
  );
}

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <ModeBanner />
      <div className="flex flex-1 min-h-0">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-[var(--color-border-subtle)] flex items-center justify-between px-6 bg-[var(--color-bg-surface)]">
            <h1 className="font-display text-base font-semibold">{title}</h1>
            <StateBadges />
          </header>
          <main className="flex-1 overflow-auto p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
