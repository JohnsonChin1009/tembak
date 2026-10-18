"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { MemberOnboarding, OnboardingPatch, OnboardingStep } from "@/lib/types";

export type OnboardingInit = {
  state: MemberOnboarding;
  /** Guide new members in #getting-started (team workspaces, not the demo). */
  checklist: boolean;
  /** Someone else is already in the workspace, which counts as "invite a teammate". */
  teamJoined: boolean;
};

type Value = {
  checklist: boolean;
  record: (step: OnboardingStep) => void;
  hintSeen: (id: string) => boolean;
  markHint: (id: string) => void;
  inviteOpen: boolean;
  setInviteOpen: (open: boolean) => void;
};

const OnboardingContext = createContext<Value | null>(null);

export function OnboardingProvider({ init, children }: { init: OnboardingInit; children: React.ReactNode }) {
  const { api } = useWorkspace();
  const [state, setState] = useState(init.state);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Fire-and-forget: progress is a nicety, never worth blocking the UI on.
  const save = useCallback(
    (patch: OnboardingPatch) => {
      fetch(`${api}/me/onboarding`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      }).catch(() => {});
    },
    [api],
  );

  const value = useMemo<Value>(() => {
    const isDone = (step: OnboardingStep) => !!state.steps[step] || (step === "invite" && init.teamJoined);
    return {
      checklist: init.checklist,
      record(step) {
        if (isDone(step)) return;
        setState((s) => ({ ...s, steps: { ...s.steps, [step]: Date.now() } }));
        save({ step });
      },
      hintSeen: (id) => state.hints.includes(id),
      markHint(id) {
        if (state.hints.includes(id)) return;
        setState((s) => ({ ...s, hints: [...s.hints, id] }));
        save({ hint: id });
      },
      inviteOpen,
      setInviteOpen,
    };
  }, [state, init.checklist, init.teamJoined, inviteOpen, save]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

/** Null outside a workspace, so shared components can use it optionally. */
export function useOnboarding(): Value | null {
  return useContext(OnboardingContext);
}
