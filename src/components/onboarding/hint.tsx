"use client";

import clsx from "clsx";
import { Lightbulb } from "lucide-react";
import { useOnboarding } from "./onboarding-context";

/** A one-time tip next to the thing it explains. Gone for good once dismissed. */
export function Hint({
  id,
  show = true,
  className,
  children,
}: {
  id: string;
  /** Extra condition from the caller, e.g. "only after the builder hint". */
  show?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const onboarding = useOnboarding();
  if (!onboarding || !show || onboarding.hintSeen(id)) return null;
  return (
    <div
      role="status"
      data-hint={id}
      className={clsx(
        "flex items-start gap-2.5 rounded-lg border border-accent/30 bg-raised px-3 py-2.5 text-sm shadow-lg shadow-black/40",
        className,
      )}
    >
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" />
      <p className="min-w-0 flex-1 leading-snug text-muted">{children}</p>
      <button
        onClick={() => onboarding.markHint(id)}
        className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium text-accent hover:bg-accent-dim"
      >
        Got it
      </button>
    </div>
  );
}
