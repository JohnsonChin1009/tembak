"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, PartyPopper, Rocket, X } from "lucide-react";
import type { OnboardingStep } from "@/lib/types";
import { useOnboarding } from "./onboarding-context";

const STEPS: Record<OnboardingStep, { label: string; hint: string }> = {
  mention: {
    label: "Ask @tembak to build something",
    hint: "Use the suggestion above the message box, or describe what you need and tag @tembak.",
  },
  preview: { label: "Open the preview", hint: "Click the app card Tembak posts. It opens next to the chat." },
  revise: { label: "Ask for a change", hint: "Type a change under the preview, like “make the bars orange”." },
  publish: { label: "Publish it", hint: "Hit Publish to get a link your workspace can open. You can unpublish anytime." },
  invite: { label: "Invite a teammate", hint: "Tembak works best with your team." },
};

/** Getting-started progress pinned above the chat. Collapsible and dismissible. */
export function Checklist({ defaultOpen }: { defaultOpen: boolean }) {
  const onboarding = useOnboarding();
  const [open, setOpen] = useState(defaultOpen);
  if (!onboarding?.checklist || onboarding.dismissed) return null;

  const { steps, isDone } = onboarding;
  const done = steps.filter(isDone).length;
  const complete = done === steps.length;
  const next = steps.find((s) => !isDone(s));

  return (
    <section
      aria-label="Getting started"
      data-testid="checklist"
      className="mx-3 mt-3 shrink-0 rounded-xl border border-line-strong bg-panel sm:mx-5"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          {complete ? (
            <PartyPopper className="size-4 shrink-0 text-accent" />
          ) : (
            <Rocket className="size-4 shrink-0 text-accent" />
          )}
          <span className="truncate text-sm font-medium">
            {complete ? "You're all set. Nice work!" : "Get started with Tembak"}
          </span>
          <span className="shrink-0 font-mono text-xs text-faint" data-testid="checklist-count">
            {done} of {steps.length} done
          </span>
          <Progress value={done / steps.length} />
          <ChevronDown className={clsx("ml-auto size-4 shrink-0 text-faint transition", open && "rotate-180")} />
        </button>
        <button
          onClick={onboarding.dismiss}
          className="shrink-0 rounded-md p-1 text-faint hover:bg-hover hover:text-fg"
          aria-label="Dismiss getting started"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {open ? (
        <ol className="border-t border-line px-3 py-2">
          {steps.map((step) => {
            const ok = isDone(step);
            return (
              <li key={step} data-step={step} data-done={ok} className="flex items-start gap-2.5 py-1.5">
                <span
                  className={clsx(
                    "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                    ok ? "border-accent bg-accent text-accent-ink" : "border-line-strong",
                  )}
                >
                  {ok ? <Check className="size-3" strokeWidth={3} /> : null}
                </span>
                <div className="min-w-0 text-sm">
                  <p className={clsx(ok ? "text-faint line-through" : "font-medium")}>{STEPS[step].label}</p>
                  {step === next ? (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">
                      {STEPS[step].hint}
                      {step === "invite" ? (
                        <>
                          {" "}
                          <button
                            onClick={() => onboarding.setInviteOpen(true)}
                            className="font-medium text-accent hover:underline"
                          >
                            Copy your invite link
                          </button>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <span className="hidden h-1 w-16 shrink-0 overflow-hidden rounded-full bg-line sm:block" aria-hidden>
      <span className="block h-full rounded-full bg-accent transition-all" style={{ width: `${value * 100}%` }} />
    </span>
  );
}
