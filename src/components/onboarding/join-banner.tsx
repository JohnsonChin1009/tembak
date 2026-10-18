"use client";

import { ArrowRight, PartyPopper, X } from "lucide-react";
import { useEffect, useEffectEvent } from "react";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { App } from "@/lib/types";
import { useOnboarding } from "./onboarding-context";

const AUTO_DISMISS_MS = 10_000;

/** Shown once to someone who joined a team workspace by invite; dismisses itself after 10s. */
export function JoinBanner({ apps, onOpenApp }: { apps: App[]; onOpenApp: (app: App) => void }) {
  const onboarding = useOnboarding();
  const { workspace } = useWorkspace();
  const visible = !!onboarding && !workspace.open && workspace.role !== "owner" && !onboarding.hintSeen("joined");
  const autoDismiss = useEffectEvent(() => onboarding?.markHint("joined"));

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(autoDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!onboarding || !visible) return null;
  const latest = [...apps].sort((a, b) => b.updatedAt - a.updatedAt)[0];

  return (
    <div
      role="status"
      data-testid="join-banner"
      className="mx-3 mt-3 flex shrink-0 items-start gap-2.5 rounded-xl border border-accent/30 bg-accent-dim px-3 py-2.5 text-sm sm:mx-5"
    >
      <PartyPopper className="mt-0.5 size-4 shrink-0 text-accent" />
      <p className="min-w-0 flex-1 leading-snug">
        You joined <strong>{workspace.name}</strong>.{" "}
        {latest ? (
          <button
            onClick={() => {
              onboarding.markHint("joined");
              onOpenApp(latest);
            }}
            className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
          >
            Here&apos;s what your team has built so far <ArrowRight className="size-3.5" />
          </button>
        ) : (
          <span className="text-muted">Say hi, then tag @tembak when your team needs something built.</span>
        )}
      </p>
      <button
        onClick={() => onboarding.markHint("joined")}
        className="shrink-0 rounded-md p-0.5 text-faint hover:text-fg"
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
