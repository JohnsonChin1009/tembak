"use client";

import clsx from "clsx";
import { AppWindow, ArrowUpRight, PanelRightOpen } from "lucide-react";
import type { App } from "@/lib/types";

export function AppCard({
  app,
  version,
  active,
  onOpen,
}: {
  app: App | undefined;
  version: number;
  active: boolean;
  onOpen: () => void;
}) {
  const live = app?.publishedVersion === version;
  return (
    <button
      onClick={onOpen}
      className={clsx(
        "group/card flex w-full max-w-md items-center gap-3 rounded-xl border p-3 text-left transition",
        active
          ? "border-accent/50 bg-accent-dim"
          : "border-line-strong bg-raised hover:border-accent/40 hover:bg-hover",
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
        <AppWindow className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-fg">{app?.title ?? "Loading app..."}</span>
        <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
          <span className="font-mono">v{version}</span>
          {app && app.latestVersion > version ? <span className="text-faint">· newer version available</span> : null}
          {live ? (
            <span className="flex items-center gap-1 text-accent">
              <span className="size-1.5 rounded-full bg-accent" /> Live
            </span>
          ) : (
            <span className="text-faint">Draft</span>
          )}
        </span>
      </span>
      <span className="flex items-center gap-1 rounded-md border border-line-strong px-2 py-1 text-xs font-medium text-muted transition group-hover/card:border-accent/40 group-hover/card:text-fg">
        {active ? <PanelRightOpen className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
        {active ? "Open" : "Preview"}
      </span>
    </button>
  );
}

export function AppChip({ app, version, onOpen }: { app: App | undefined; version: number; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2 py-0.5 text-xs text-muted transition hover:border-accent/40 hover:text-fg"
    >
      <AppWindow className="size-3 text-accent" />
      re: {app?.title ?? "app"} <span className="font-mono text-faint">v{version}</span>
    </button>
  );
}
