"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { MemberOnboarding, OnboardingPatch, OnboardingStep } from "@/lib/types";

export type OnboardingInit = {
  state: MemberOnboarding;
  /** Show the getting-started checklist (team workspaces, not the demo). */
  checklist: boolean;
  /** Someone else is already in the workspace, which counts as "invite a teammate". */
  teamJoined: boolean;
};

type Value = {
  checklist: boolean;
  dismissed: boolean;
  /** Steps that apply to this member; only owners get "invite". */
  steps: OnboardingStep[];
  isDone: (step: OnboardingStep) => boolean;
  record: (step: OnboardingStep) => void;
  dismiss: () => void;
  hintSeen: (id: string) => boolean;
  markHint: (id: string) => void;
  inviteOpen: boolean;
  setInviteOpen: (open: boolean) => void;
};

const OnboardingContext = createContext<Value | null>(null);

const ALL_STEPS: OnboardingStep[] = ["mention", "preview", "revise", "publish", "invite"];

export function OnboardingProvider({ init, children }: { init: OnboardingInit; children: React.ReactNode }) {
  const { api, workspace } = useWorkspace();
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
      dismissed: !!state.dismissed,
      steps: workspace.role === "owner" ? ALL_STEPS : ALL_STEPS.filter((s) => s !== "invite"),
      isDone,
      record(step) {
        if (isDone(step)) return;
        setState((s) => ({ ...s, steps: { ...s.steps, [step]: Date.now() } }));
        save({ step });
      },
      dismiss() {
        setState((s) => ({ ...s, dismissed: true }));
        save({ dismissed: true });
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
  }, [state, init.checklist, init.teamJoined, workspace.role, inviteOpen, save]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

/** Null outside a workspace, so shared components can use it optionally. */
export function useOnboarding(): Value | null {
  return useContext(OnboardingContext);
}
